/**
 * Maestro a Domicilio — Sincronizador Google Forms/Sheets → Firestore
 *
 * Funciona SIN Cloud Functions (plan gratuito de Firebase):
 *   1. Inicia sesión en Firebase con un usuario dedicado de rol INTAKE (solo puede crear entradas).
 *   2. Escribe cada respuesta en la colección `intake_requests` usando la API REST de Firestore.
 *   3. El panel de la central la valida y la convierte en solicitud oficial (correlativo SOL-POST-xxxx y PIN).
 *
 * Las credenciales NO van en este archivo: se guardan en
 *   Configuración del proyecto (engranaje) → Propiedades de la secuencia de comandos:
 *     FIREBASE_API_KEY   clave de API web de Firebase (Configuración del proyecto → General)
 *     INTAKE_EMAIL       correo del usuario de Firebase con rol INTAKE
 *     INTAKE_PASSWORD    contraseña de ese usuario
 *
 * Instalación: ver INTEGRACION_WHATSAPP_Y_UBICACION.md en la raíz del proyecto.
 */

const PROJECT_ID = 'tesis-servicios';
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents';

// Columnas de control que el script agrega a la hoja si faltan.
const SYNC_STATUS_HEADER = 'Estado_Sync';
const SYNC_CODE_HEADER = 'Codigo_Solicitud';
const SYNCED = 'SINCRONIZADO';

// Límites que coinciden con las reglas de Firestore (ver firestore.rules → intake_requests).
const LIMITS = { clientName: 200, clientPhone: 60, specialty: 120, district: 120, address: 300, addressReference: 300, description: 1500, urgency: 80, preferredDate: 30, preferredTime: 30 };

/**
 * Cómo se reconoce cada columna del formulario. Se compara por el ENCABEZADO (sin tildes, en minúsculas),
 * no por la posición: así puedes reordenar preguntas o agregar otras sin romper la sincronización.
 */
const COLUMN_MATCHERS = {
  clientName: /nombre/,
  clientPhone: /telefono|celular|whatsapp|contacto/,
  specialty: /especialidad|servicio|tipo de/,
  district: /distrito/,
  address: /direccion/,
  addressReference: /referencia/,
  description: /descripcion|problema|detalle/,
  urgency: /urgencia|prioridad|cuando/,
  preferredDate: /fecha/,
  preferredTime: /hora|horario/,
};

/** Trigger instalable: se ejecuta cuando llega una respuesta nueva del formulario. */
function onFormSubmit(e) {
  const sheet = e && e.range ? e.range.getSheet() : SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const row = e && e.range ? e.range.getRow() : sheet.getLastRow();
  syncRow_(sheet, row);
}

/** Red de seguridad: reintenta las filas que no se sincronizaron (sin internet, error temporal…). */
function syncPendingRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    const columns = ensureControlColumns_(sheet);
    const last = sheet.getLastRow();
    for (let row = 2; row <= last; row++) {
      const status = String(sheet.getRange(row, columns.status).getValue() || '');
      if (status !== SYNCED && status.indexOf('RECHAZADO') !== 0) syncRow_(sheet, row);
    }
  } finally {
    lock.releaseLock();
  }
}

/** Ejecuta esta función UNA vez para crear los disparadores (formulario + reintento cada 10 minutos). */
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onFormSubmit').forSpreadsheet(SpreadsheetApp.getActive()).onFormSubmit().create();
  ScriptApp.newTrigger('syncPendingRows').timeBased().everyMinutes(10).create();
  Logger.log('Disparadores creados.');
}

/** Prueba de extremo a extremo sin necesidad de enviar el formulario: sincroniza la última fila. */
function testLastRow() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  syncRow_(sheet, sheet.getLastRow());
}

// ───────────────────────────── Lógica interna ─────────────────────────────

function syncRow_(sheet, row) {
  if (row < 2) return;
  const columns = ensureControlColumns_(sheet);
  const status = String(sheet.getRange(row, columns.status).getValue() || '');
  if (status === SYNCED) return; // ya procesada: evita duplicados

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const record = readRecord_(headers, values);

  try {
    const session = signIn_();
    const submittedAt = values[0] instanceof Date ? values[0].getTime() : Date.now();
    const docId = 'gs_' + sheet.getParent().getId().slice(0, 8) + '_' + row + '_' + submittedAt;
    const result = createIntake_(session, docId, record, row);

    if (result.ok || result.alreadyExists) {
      sheet.getRange(row, columns.status).setValue(SYNCED);
      sheet.getRange(row, columns.code).setValue('Recibida · en registro');
    } else {
      sheet.getRange(row, columns.status).setValue('ERROR: ' + result.message);
    }
  } catch (error) {
    // Error de red o de credenciales: queda marcada y syncPendingRows() la reintenta.
    sheet.getRange(row, columns.status).setValue('ERROR: ' + String(error).slice(0, 150));
  }
}

/** Convierte una fila en un objeto { clientName, clientPhone, … } según los encabezados. */
function readRecord_(headers, values) {
  const record = {};
  const folded = headers.map(function (h) { return fold_(String(h)); });
  Object.keys(COLUMN_MATCHERS).forEach(function (field) {
    const index = folded.findIndex(function (h) { return COLUMN_MATCHERS[field].test(h) && h !== fold_(SYNC_STATUS_HEADER) && h !== fold_(SYNC_CODE_HEADER); });
    if (index >= 0) {
      let value = values[index];
      if (value instanceof Date) {
        value = field === 'preferredTime'
          ? Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm')
          : Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      record[field] = String(value === undefined || value === null ? '' : value).trim();
    }
  });
  return record;
}

function fold_(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Agrega las columnas Estado_Sync y Codigo_Solicitud si no existen y devuelve su posición (base 1). */
function ensureControlColumns_(sheet) {
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
  function ensure(name) {
    let index = headers.indexOf(name);
    if (index < 0) {
      headers.push(name);
      index = headers.length - 1;
      sheet.getRange(1, index + 1).setValue(name).setFontWeight('bold');
    }
    return index + 1;
  }
  return { status: ensure(SYNC_STATUS_HEADER), code: ensure(SYNC_CODE_HEADER) };
}

/** Inicia sesión con el usuario INTAKE. El token dura 1 hora; se guarda 50 minutos en caché. */
function signIn_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('intake_session');
  if (cached) return JSON.parse(cached);

  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('FIREBASE_API_KEY');
  const email = props.getProperty('INTAKE_EMAIL');
  const password = props.getProperty('INTAKE_PASSWORD');
  if (!apiKey || !email || !password) {
    throw new Error('Faltan FIREBASE_API_KEY, INTAKE_EMAIL o INTAKE_PASSWORD en las propiedades del script.');
  }

  const response = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + encodeURIComponent(apiKey), {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ email: email, password: password, returnSecureToken: true }),
    muteHttpExceptions: true,
  });
  const body = JSON.parse(response.getContentText());
  if (response.getResponseCode() !== 200 || !body.idToken) {
    throw new Error('Inicio de sesión rechazado: ' + ((body.error && body.error.message) || response.getResponseCode()));
  }
  const session = { idToken: body.idToken, uid: body.localId };
  cache.put('intake_session', JSON.stringify(session), 3000);
  return session;
}

function text_(value, field) {
  return { stringValue: String(value || '').slice(0, LIMITS[field]) };
}

/** Crea la entrada con la API REST (commit). `exists:false` hace la operación idempotente: reintentar no duplica. */
function createIntake_(session, docId, record, row) {
  const fields = {
    source: { stringValue: 'GOOGLE_FORM' },
    channel: { stringValue: 'WHATSAPP' },
    status: { stringValue: 'NEW' },
    submittedBy: { stringValue: session.uid },
    sourceRow: { integerValue: String(row) },
    clientName: text_(record.clientName, 'clientName'),
    clientPhone: text_(record.clientPhone, 'clientPhone'),
    specialty: text_(record.specialty || 'Otro', 'specialty'),
    district: text_(record.district, 'district'),
    address: text_(record.address, 'address'),
    description: text_(record.description, 'description'),
    urgency: text_(record.urgency || 'TODAY', 'urgency'),
  };
  if (record.addressReference) fields.addressReference = text_(record.addressReference, 'addressReference');
  if (record.preferredDate) fields.preferredDate = text_(record.preferredDate, 'preferredDate');
  if (record.preferredTime) fields.preferredTime = text_(record.preferredTime, 'preferredTime');

  const body = {
    writes: [{
      update: { name: 'projects/' + PROJECT_ID + '/databases/(default)/documents/intake_requests/' + docId, fields: fields },
      updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
      currentDocument: { exists: false },
    }],
  };

  const response = UrlFetchApp.fetch(FIRESTORE_BASE + ':commit', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + session.idToken },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
  const code = response.getResponseCode();
  if (code === 200) return { ok: true };

  const parsed = safeJson_(response.getContentText());
  const status = parsed && parsed.error && parsed.error.status;
  if (code === 409 || status === 'ALREADY_EXISTS') return { alreadyExists: true };
  if (code === 401) CacheService.getScriptCache().remove('intake_session'); // token vencido: se renueva en el reintento
  const detail = (parsed && parsed.error && parsed.error.message) || response.getContentText();
  return { ok: false, message: (status || code) + ' ' + String(detail).slice(0, 120) };
}

function safeJson_(text) {
  try { return JSON.parse(text); } catch (e) { return null; }
}
