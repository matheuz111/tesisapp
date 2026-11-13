# Traspaso a producción: Maestro a Domicilio

Guía para pasar a producción todo lo desarrollado en la rama `feature/ui-redesign`. Está escrita para hacerse de arriba abajo, sin consultar a nadie. Cada paso dice **qué hacer**, **cómo comprobar que salió bien** y **qué hacer si falla**.

- Proyecto Firebase: `tesis-servicios` (plan gratuito Spark, sin Cloud Functions, sin facturación).
- Dominio público del panel: `https://tesis-servicios.web.app`
- Rama con el trabajo: `feature/ui-redesign`. Últimos commits relevantes: `59c84ef`, `1f079b2`, `223ef4c`.

## Reglas que no se rompen

1. **Desplegar siempre con `--only`** (`firestore:rules` o `hosting`). El `firebase.json` tiene un bloque `functions` que fallaría en el plan gratuito. Nunca `firebase deploy` a secas.
2. Si la consola pregunta si borra índices de `users` o cualquier índice que no está en el repositorio, responder **`n`**.
3. **Las credenciales no se guardan en el repositorio.** La contraseña del usuario `INTAKE` y la clave del script viven solo en las propiedades del Apps Script.
4. No activar facturación en Firebase. Nada de lo entregado la necesita.

## Resumen del orden

| Paso | Qué | Tiempo | Depende de |
| --- | --- | --- | --- |
| 0 | Preparar el entorno | 10 min | nada |
| 1 | Publicar reglas de Firestore | 5 min | 0 |
| 2 | Desplegar panel web con el QR en producción | 15 min | 1 |
| 3 | Probar el QR de garantías | 10 min | 2 |
| 4 | Entrada de WhatsApp: usuario `INTAKE` | 10 min | 1 |
| 5 | Entrada de WhatsApp: Google Form y Apps Script | 30 min | 4 |
| 6 | Probar WhatsApp de punta a punta | 15 min | 2 y 5 |
| 7 | Compilar y probar la app móvil | 1 h aprox. | 1 |
| 8 | Verificación final | 20 min | todos |

---

## Paso 0. Preparar el entorno

**Necesitas:** Node 20 o superior, Git, acceso como propietario o editor al proyecto `tesis-servicios` en Firebase, y una cuenta de Expo (EAS) con acceso al proyecto móvil.

```bash
git checkout feature/ui-redesign
git pull
npm install
cd admin-web && npm install && cd ..
npx firebase-tools login
npx firebase-tools use tesis-servicios
```

**Comprobar:**
```bash
npx firebase-tools projects:list
```
Debe aparecer `tesis-servicios` y quedar marcado como activo.

**Comprobar que el código está sano antes de desplegar:**
```bash
npm test
npx tsc --noEmit
cd admin-web && npm test && npx tsc -b && cd ..
```
Resultado esperado: 96 pruebas pasan en la app móvil, 57 en el panel, y `tsc` sin errores. Si algo falla, **detenerse** y revisar antes de seguir.

---

## Paso 1. Publicar las reglas de Firestore

Es el paso más importante: sin las reglas nuevas, el QR de garantías muestra "No se pudo consultar el certificado" y las solicitudes de WhatsApp fallan con `permission-denied`.

```bash
npx firebase-tools deploy --only firestore:rules
```

**Comprobar:** la salida termina con `Deploy complete!`. En Firebase Console → Firestore → Reglas, la fecha de publicación es la de hoy y el texto contiene `match /intake_requests/{intakeId}` y `isIntake()`.

**Si falla:**
- `Unexpected 'match'` o error de compilación: no editar a ciegas. Copiar el mensaje completo (con número de línea) y revisar el bloque indicado. Las reglas del repositorio compilan con llaves y paréntesis balanceados, así que normalmente el problema es que se pegó el archivo mal.
- Pregunta sobre borrar índices: responder `n`.

**Opcional, recomendado:** correr las pruebas de reglas con el emulador. Necesita Java 11 o superior y Firebase CLI.
```bash
npx firebase-tools emulators:exec --only firestore "node --test test/firestore.rules.test.cjs"
```
Nadie las ha podido ejecutar todavía, así que si fallan alguna, avisar con el detalle: puede ser un ajuste de la prueba o un error real de reglas.

---

## Paso 2. Desplegar el panel web con el QR apuntando a producción

### Por qué el QR solo funcionaba en local
El código QR se construye con la dirección desde la que se abre el panel. Si el certificado se generó abriendo el panel en `localhost`, el QR lleva `localhost` y nadie más puede abrirlo. La solución es fijar la dirección pública al compilar.

### Qué hacer
1. Verificar que `admin-web/.env.production` contiene exactamente esta línea (ya está en el repositorio; el archivo estaba vacío y se completó):
   ```
   VITE_PUBLIC_BASE_URL=https://tesis-servicios.web.app
   ```
   La configuración de Firebase del panel va en `admin-web/src/firebase.ts`, no en este archivo.
2. Compilar y desplegar:
   ```bash
   cd admin-web
   npm run build
   cd ..
   npx firebase-tools deploy --only hosting
   ```

**Comprobar:**
- La salida termina con `Deploy complete!` y muestra `Hosting URL: https://tesis-servicios.web.app`.
- Abrir `https://tesis-servicios.web.app` en el navegador: carga el login del panel.
- Abrir `https://tesis-servicios.web.app/verificar/prueba`: debe cargar la página de verificación (aunque diga que el código no existe) y **no** un error 404.
- Para confirmar que la dirección quedó dentro de la compilación (en Windows, desde Git Bash):
  ```bash
  grep -rl "tesis-servicios.web.app" admin-web/dist/assets | head
  ```
  Debe listar al menos un archivo.

**Si falla:**
- `Error: ... functions`: se olvidó el `--only hosting`.
- El panel carga en blanco: revisar la consola del navegador. Casi siempre es una compilación vieja; repetir `npm run build`.

> **Importante:** todo certificado generado antes de este paso tiene un QR con dirección local. Hay que **regenerarlo** desde el panel, porque el QR impreso no cambia solo.

---

## Paso 3. Probar el QR de garantías en producción

Hacerlo con un teléfono **conectado a datos móviles** (no a la wifi de la casa u oficina), para confirmar que funciona desde fuera.

1. Abrir `https://tesis-servicios.web.app` con un usuario ADMIN u OPERATOR.
2. Ir a una solicitud completada y generar el certificado de garantía.
3. Escanear el QR con el teléfono.

**Debe ocurrir:**
- Se abre `https://tesis-servicios.web.app/verificar/<código>`.
- La URL **no** contiene `localhost`, `127.0.0.1` ni una IP.
- Se ve el certificado con estado vigente y los datos del servicio, sin abrir sesión.
4. Desde el panel, **revocar** el certificado. Escanear de nuevo: debe indicar que está revocado.
5. Probar un código inexistente (cambiando una letra de la URL): debe decir que no se encontró, sin errores técnicos.

**Si falla:**
- "No se pudo consultar el certificado": las reglas del paso 1 no están publicadas. Repetir el paso 1.
- El QR abre una dirección local: se generó antes del paso 2. Regenerar el certificado.
- La página de verificación da 404: el hosting no quedó publicado; repetir el paso 2.

**Mantenimiento (informativo):** el plan gratuito no permite el borrado automático (TTL) de los registros de escaneo. La limpieza la hace la función `purgeExpiredScans()` del panel, una vez al día, cuando un operador lo abre. Las reglas ya lo permiten. No hay que configurar nada.

---

## Paso 4. WhatsApp: crear el usuario de entrada

Este usuario es la identidad con la que el Apps Script escribe en Firestore. Tiene permisos mínimos: solo puede **crear** entradas nuevas con un formato fijo.

1. Firebase Console → **Authentication** → **Usuarios** → **Agregar usuario**.
   - Correo: uno dedicado, por ejemplo `intake-whatsapp@<dominio-del-proyecto>`. No usar el correo de una persona.
   - Contraseña: larga (20 caracteres o más) y única. Guardarla en el gestor de contraseñas del equipo.
2. Copiar el **UID** del usuario recién creado.
3. Firebase Console → **Firestore Database** → colección `users` → **Agregar documento**.
   - ID del documento: el UID copiado (no autogenerar).
   - Campos:
     | Campo | Tipo | Valor |
     | --- | --- | --- |
     | `role` | string | `INTAKE` |
     | `name` | string | `Entrada WhatsApp` |
     | `is_verified` | boolean | `true` |

**Comprobar:** el documento existe con el UID exacto y `role` escrito en mayúsculas, sin espacios.

Este usuario no puede entrar al panel ni a la app: su rol no existe allí.

---

## Paso 5. WhatsApp: Google Form y Apps Script

### 5.1 Crear el formulario y su hoja
1. Crear un Google Form con estas preguntas. Respuesta corta, salvo las indicadas:

   | Pregunta | Encabezado en la hoja | Obligatoria |
   | --- | --- | --- |
   | Nombre completo | `Nombre_Cliente` | Sí |
   | Teléfono o WhatsApp | `Telefono_Cliente` | Sí |
   | Tipo de servicio (lista: Gasfitería, Electricidad, Pintura, Carpintería, Albañilería, Cerrajería, Línea blanca y técnico, Otro) | `Especialidad` | Sí |
   | Distrito | `Distrito` | Sí |
   | Dirección exacta | `Direccion` | Sí |
   | Referencia | `Referencia` | No |
   | Describe el problema (párrafo, mínimo 10 caracteres) | `Descripcion_Problema` | Sí |
   | ¿Cuándo lo necesitas? (lista: Lo antes posible, Hoy, Programar para otra fecha) | `Urgencia` | Sí |
   | Fecha preferida (tipo fecha) | `Fecha_Preferida` | No |
   | Hora preferida (tipo hora) | `Hora_Preferida` | No |

2. Pestaña **Respuestas** → **Vincular con Hojas de cálculo** → crear una hoja nueva.
3. En la hoja, renombrar los encabezados de la fila 1 a los nombres de la tabla (el script los reconoce por palabra clave, pero con estos nombres no hay dudas).

### 5.2 Instalar el script
1. En la hoja: **Extensiones → Apps Script**.
2. Borrar el contenido por defecto y pegar todo `integraciones/google-apps-script/Code.gs`. Guardar.
3. Engranaje **Configuración del proyecto** → **Propiedades del script** → agregar:

   | Propiedad | Valor |
   | --- | --- |
   | `FIREBASE_API_KEY` | La clave de API web del proyecto: Firebase Console → Configuración del proyecto → General → Tus apps → app web → `apiKey`. |
   | `INTAKE_EMAIL` | El correo del paso 4. |
   | `INTAKE_PASSWORD` | La contraseña del paso 4. |

   Estas tres propiedades **no** se escriben en el código ni en el repositorio.
4. Seleccionar la función `setupTriggers` y pulsar **Ejecutar**. Autorizar los permisos que pida (acceso a la hoja y a servicios externos).

**Comprobar:** en el menú **Activadores** (reloj) aparecen dos: uno "al enviar el formulario" para `onFormSubmit` y uno cada 10 minutos para `syncPendingRows`.

**Si falla:**
- "Authorization required" o "Se requiere autorización": ejecutar la función a mano una vez y aceptar.
- `signIn_` devuelve error: revisar `FIREBASE_API_KEY`, el correo y la contraseña sin espacios al final.

---

## Paso 6. Probar WhatsApp de punta a punta

1. Abrir el panel de producción (`https://tesis-servicios.web.app`) con un usuario OPERATOR o ADMIN y **dejarlo abierto**. Sin un panel abierto nadie convierte las entradas.
2. Enviar el formulario con datos de prueba válidos: urgencia "Lo antes posible" o "Hoy".

**Debe ocurrir, en menos de un minuto:**
- En la hoja, la fila queda con `Estado_Sync = SINCRONIZADO` y un `Codigo_Solicitud`.
- En el panel suena una alerta doble, aparece el aviso "Nueva solicitud por WhatsApp" y la solicitud entra a la bandeja como pendiente de asignación, con canal WhatsApp.
- En Firestore, `intake_requests/<id>` queda con `status: "PROCESSED"` y `requestCode`.

3. Pruebas de error (cada una debe quedar rechazada con un aviso rojo y `status: "REJECTED"`):
   - Teléfono vacío o con letras.
   - Descripción de menos de 10 caracteres.
   - Urgencia "Programar" con fecha pasada.
4. Reenviar o reejecutar `testLastRow`: no debe crear una solicitud duplicada (cada fila tiene un id fijo).
5. Borrar las solicitudes de prueba desde la consola de Firebase cuando termine.

**Si falla:**
- `permission-denied` en el Apps Script: reglas sin publicar (paso 1) o el documento `users/<uid>` no tiene `role: "INTAKE"` (paso 4).
- La fila queda en `ERROR: ...`: leer el mensaje; el script reintenta cada 10 minutos las filas con error.
- Queda en `NEW` y no se convierte: no hay ningún panel abierto con un operador conectado.

### Límites conocidos (por diseño, plan gratuito)
- La conversión necesita un panel abierto. La entrada queda guardada y se procesa cuando alguien lo abre.
- El bot de WhatsApp y el WhatsApp Flow (`integraciones/whatsapp/`) necesitan una plataforma intermedia (Make, n8n, Meta Business) que escriba la fila en la hoja. No son necesarios para que la entrada funcione; el Google Form con enlace ya es 100 % gratuito. Si se agregan después, el Apps Script no cambia.

---

## Paso 7. Compilar y probar la app móvil

### 7.1 Qué perfil de compilación usar
En `eas.json` el perfil `production` usa `EXPO_PUBLIC_NOTIFICATION_MODE=backend`, que supone un servidor de notificaciones que **no existe** en el plan gratuito. Con ese perfil las notificaciones push entre usuarios no funcionarían.

**Usar el perfil `preview`** (APK instalable, con `demo-direct` y `firestore-demo`, que es la configuración probada en este proyecto):
```bash
npx eas-cli login
npx eas-cli build --platform android --profile preview
```
Al terminar, EAS entrega un enlace de descarga del APK. Esta es la versión que se instala en los teléfonos.

> No hace falta cambiar `eas.json`. Si el equipo decide publicar en Play Store más adelante, hay que revisar el perfil `production` y declarar el permiso de ubicación en segundo plano (ver 7.4).

### 7.2 Por qué hay que compilar de nuevo
Esta sesión añadió módulos nativos y cambios que no están en un APK viejo ni en Expo Go: avisos locales (`expo-notifications`), `expo-blur` en la barra de pestañas y la tarea de ubicación. Se debe instalar la build nueva y desinstalar la anterior.

### 7.3 Pruebas en un teléfono real con la build instalada
**Ubicación apagada (técnico):**
1. Iniciar sesión como técnico y ponerse **disponible**.
2. Aceptar los permisos de ubicación (con "Permitir siempre" si se ofrece) y de notificaciones.
3. Dentro del horario laboral (lunes a sábado, 08:00 a 18:00, hora de Lima), apagar el GPS del teléfono.
4. **Debe ocurrir:** al volver a la app aparece un aviso con el botón "Activar ubicación"; y con la app en segundo plano llega una notificación local ("Enciende tu ubicación…"), como máximo una cada 15 minutos.
5. Pulsar el botón: en Android intenta encender el GPS; si no puede, abre los ajustes.
6. Fuera de ese horario no debe avisar.

**Chat:**
1. Abrir un servicio con cliente y técnico asignados y mandar mensajes de ambos lados.
2. **Debe ocurrir:** los mensajes del otro participante llevan la etiqueta "Cliente" (verde) o "Técnico" (azul); los mensajes de la central, "Central" (ámbar).
3. Comprobarlo en modo claro y en modo oscuro.

**Pantalla de la central (operador):**
- La tarjeta "Cotización enviada · Esperando al cliente (hace N días)" no se corta por el borde derecho.

### 7.4 Si se va a publicar en Google Play (opcional)
`ACCESS_BACKGROUND_LOCATION` está declarado en `app.config.js`. Google exige para ese permiso un formulario de declaración, un video demostrativo y la política de privacidad. Para un APK instalado por enlace (caso de la tesis) no hace falta.

### 7.5 Límite conocido
Si el técnico cierra la app por completo y apaga el GPS, no recibe aviso, porque eso necesita un proceso en servidor. La central lo ve en el chip **"Sin ubicación"** del panel (técnicos conectados con más de 20 minutos sin reportar, en horario laboral) y puede llamarlo desde ahí.

---

## Paso 8. Verificación final

Marcar cada punto:

- [ ] `https://tesis-servicios.web.app` carga el login y se entra con un usuario ADMIN.
- [ ] Reglas publicadas hoy, con `intake_requests` visible.
- [ ] Certificado nuevo: su QR abre `https://tesis-servicios.web.app/verificar/...` desde datos móviles.
- [ ] Revocar un certificado se refleja al escanearlo de nuevo.
- [ ] Un envío de formulario de prueba llegó al panel con sonido y quedó `SINCRONIZADO` en la hoja.
- [ ] Un envío inválido quedó `REJECTED` con aviso rojo.
- [ ] En el panel, el chip "Sin ubicación" solo aparece en horario laboral.
- [ ] La app nueva está instalada en al menos un teléfono de técnico y uno de cliente, y las pantallas se ven bien en modo claro y oscuro.
- [ ] El aviso de ubicación apagada funciona en el teléfono del técnico.
- [ ] Las solicitudes y certificados de prueba se borraron.
- [ ] No hay contraseñas ni claves nuevas dentro del repositorio: `git status` limpio y `git diff` sin secretos.

Cuando todo esté marcado, el sistema está en producción.

---

## Referencia: dónde está cada cosa

| Tema | Archivo |
| --- | --- |
| Guía técnica de WhatsApp y ubicación | `INTEGRACION_WHATSAPP_Y_UBICACION.md` |
| Guía técnica del QR de garantías | `VERIFICACION_GARANTIAS_QR.md` |
| Reglas de Firestore | `firestore.rules` |
| Script de Google | `integraciones/google-apps-script/Code.gs` |
| Bot y Flow de WhatsApp (opcional) | `integraciones/whatsapp/` |
| Dirección pública del QR | `admin-web/.env.production` |
| Perfiles de compilación móvil | `eas.json` |

## Pendientes que no bloquean producción

- Tipografía IBM Plex: no se aplicó.
- Que la app del operador también convierta las entradas de WhatsApp, para no depender del panel abierto.
- Aviso al técnico con la app cerrada: solo es posible con Cloud Functions (requiere plan de pago) o con un Apps Script programado que use una cuenta de servicio.
- 37 avisos de lint (0 errores), la mayoría anteriores a esta sesión.
