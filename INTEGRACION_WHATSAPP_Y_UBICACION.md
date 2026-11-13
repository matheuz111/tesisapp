# Integración: solicitudes por WhatsApp y control de ubicación

Implementación del plan "Eventos de Ubicación y WspForms", adaptada al **plan gratuito de Firebase** (sin Cloud Functions). Lo que en el plan original hacía una Cloud Function, aquí lo hacen Google Apps Script, las reglas de Firestore y el propio panel de la central.

## Qué cambió respecto al plan original

| Plan original | Esta implementación | Por qué |
| --- | --- | --- |
| Apps Script llama a una Cloud Function (`createRequestFromWebhook`) | Apps Script escribe en `intake_requests` por la API REST de Firestore con un usuario `INTAKE` | Las Cloud Functions exigen el plan de pago |
| La función crea la solicitud y el correlativo | El **panel de la central** valida y crea la solicitud (mismo correlativo atómico y PIN) | La lógica ya existe en el panel y pasa por reglas auditadas |
| Token compartido escrito en el script | Usuario Firebase de bajo privilegio; credenciales en las propiedades del script | Un token en el código lo ve cualquiera con acceso a la hoja |
| `onNewServiceRequest` envía push a los operadores | Alerta en el panel (aviso + sonido) y la solicitud aparece en tiempo real en la app del operador | No hay función que dispare notificaciones |
| Cron cada 15 min que avisa al técnico sin GPS | Aviso **local** en la app + lista **"Sin ubicación"** en el panel | No hay un proceso programado en el servidor |

---

## Evento 2: WhatsApp → Google Sheets → Firestore → Panel

```
Cliente en WhatsApp
   → Google Forms (o MaestroBot) → Google Sheets
   → Apps Script (onFormSubmit) → intake_requests  (Firestore, usuario INTAKE)
   → Panel de la central valida y crea service_requests (PENDING_ASSIGNMENT, SOL-POST-xxxx, PIN)
   → Aparece en la bandeja, con aviso y sonido, y en la app del operador
```

### Qué hace cada pieza

- **Formulario o bot** (`integraciones/whatsapp/`): captura nombre, teléfono, especialidad, distrito, dirección, referencia, descripción, urgencia y, si se programa, fecha y hora. `maestrobot-prompt.md` es el prompt del bot y `flow.json` la especificación del formulario nativo de WhatsApp.
- **Apps Script** (`integraciones/google-apps-script/Code.gs`): reconoce las columnas por su **encabezado**, no por su posición; marca cada fila (`SINCRONIZADO`, `ERROR: …`); reintenta cada 10 minutos las que fallaron; y no duplica nunca (cada fila tiene un id fijo).
- **Reglas** (`firestore.rules` → `intake_requests`): el usuario `INTAKE` solo puede **crear** documentos con un esquema fijo y estado `NEW`. No lee nada, no modifica nada. La central solo puede cerrar cada entrada una vez.
- **Panel** (`useWhatsappIntake`): al abrir el panel, cada entrada nueva se convierte sola en una transacción (reclama la entrada, toma el correlativo, crea la solicitud y su historial). Si dos paneles están abiertos, solo uno la procesa. Una entrada inválida se marca `REJECTED` con los motivos y salta un aviso rojo.
- **Validación** (`intakeModel.ts`): lo que llega de una hoja nunca es confiable. Normaliza teléfono (formato sin +51 que usa el panel), especialidad, urgencia y fechas; limpia caracteres de control y limita largos.

### Puesta en marcha (una sola vez)

**1. Crear el usuario de entrada**
1. Firebase Console → **Authentication** → *Add user*: correo `intake-whatsapp@tu-dominio.com` y una contraseña larga y única.
2. Copia su **UID**.
3. Firestore → colección `users` → documento con ese UID: `role: "INTAKE"`, `name: "Entrada WhatsApp"`, `is_verified: true`.
   Este usuario no puede iniciar sesión en el panel ni en la app: su rol no existe allí.

**2. Publicar las reglas**
```bash
npx firebase-tools deploy --only firestore:rules
```

**3. Instalar el script**
1. Crea el **Google Form** con las preguntas (ver tabla) y enlázalo a una hoja de respuestas.
2. En la hoja: *Extensiones → Apps Script*. Pega el contenido de `Code.gs`.
3. Engranaje *Configuración del proyecto* → **Propiedades del script**, agrega:
   - `FIREBASE_API_KEY`: la clave de API web (Firebase Console → Configuración → General).
   - `INTAKE_EMAIL` y `INTAKE_PASSWORD`: las credenciales del paso 1.
4. Ejecuta `setupTriggers` una vez y autoriza los permisos.
5. Prueba: envía el formulario o ejecuta `testLastRow`. La fila debe quedar `SINCRONIZADO` y, con el panel abierto, aparecer en la bandeja con el canal WhatsApp.

**Encabezados recomendados de la hoja** (se reconocen por palabra clave):

| Pregunta | Encabezado sugerido | Campo en Firestore |
| --- | --- | --- |
| Nombre completo | `Nombre_Cliente` | `clientName` |
| Teléfono / WhatsApp | `Telefono_Cliente` | `clientPhone` |
| Especialidad | `Especialidad` | `specialty` |
| Distrito | `Distrito` | `district` |
| Dirección exacta | `Direccion` | `address` |
| Referencia | `Referencia` | `addressReference` |
| Detalle de la falla | `Descripcion_Problema` | `description` |
| Urgencia | `Urgencia` | `urgency` |
| Fecha programada | `Fecha_Preferida` | `preferredDate` |
| Hora programada | `Hora_Preferida` | `preferredTime` |

El script agrega solo las columnas `Estado_Sync` y `Codigo_Solicitud`.

### Límites que conviene conocer

- **La conversión necesita un panel abierto.** Sin Cloud Functions, nadie procesa la entrada mientras ningún operador tiene el panel (o, en el futuro, la app del operador) abierto. La entrada queda guardada en `intake_requests` y se registra en cuanto alguien lo abre. En horario laboral, con la central trabajando, es inmediato.
- **WhatsApp Flows y el bot** necesitan una plataforma intermedia (Meta Business, Make, n8n o Zapier) para dejar la fila en la hoja. El **Google Form con enlace** es la única opción 100 % gratuita y sin intermediarios.
- La hora de llegada de la solicitud es la **real** (cuando el cliente envió el formulario), no la de la conversión, para que los tiempos de respuesta (T_RSP) de la tesis midan la espera verdadera.

---

## Evento 1: ubicación activa en horario laboral

**Regla:** un técnico **disponible**, de lunes a sábado de 08:00 a 18:00 (hora de Lima), debe tener los servicios de ubicación y el permiso activos.

### Capa en el teléfono (app móvil)
- `useLocationCompliance` revisa al abrir la app, al volver a ella y cada minuto.
- Si falla, la pantalla del técnico muestra un aviso con el botón **Activar ubicación** (en Android intenta encender el GPS; si no, abre los ajustes) y, si la app no está a la vista, lanza una **notificación local** ("Enciende tu ubicación…") como máximo cada 15 minutos.
- La tarea de ubicación en segundo plano también dispara ese aviso cuando deja de recibir señal.
- Al tocar la notificación, la app abre la pantalla del técnico, donde está el aviso.

### Capa en la central (panel web)
- En la franja de telemetría aparece **"Sin ubicación N"**: técnicos conectados que llevan más de 20 minutos sin reportar, con el tiempo sin señal y su teléfono para llamarlos. Se recalcula cada minuto y fuera de horario laboral no avisa a nadie.

### Qué NO cubre (y por qué)
La capa de servidor del plan original enviaba una notificación push al técnico aunque tuviera la app cerrada. **Eso requiere un proceso programado en el servidor**, que no existe en el plan gratuito. Si el técnico cerró la app por completo y apagó el GPS, no recibe aviso automático: la central lo ve en "Sin ubicación" y puede llamarlo. Si algún día activas Cloud Functions, esa capa se agrega sin cambiar nada de lo anterior.

---

## Archivos nuevos y modificados

- `integraciones/`: `google-apps-script/Code.gs`, `whatsapp/maestrobot-prompt.md`, `whatsapp/flow.json`
- Panel web: `services/intakeModel.ts`, `services/intakeService.ts`, `hooks/useWhatsappIntake.ts`, `hooks/useProviderSignal.ts`, `utils/providerSignal.ts`, `utils/alertSound.ts`, `components/dashboard/TelemetryBar.tsx`
- App móvil: `services/locationCompliance.ts`, `services/locationReminder.ts`, `hooks/useLocationCompliance.ts`, `components/ProviderDashboard.tsx`, `services/backgroundLocationTask.ts`
- `firestore.rules`: colección `intake_requests`
- Pruebas: `admin-web/test/intakeModel.test.mjs`, `admin-web/test/providerSignal.test.mjs`, `test/locationCompliance.test.cjs`, `test/firestore.rules.test.cjs` (reglas, requieren el emulador)
