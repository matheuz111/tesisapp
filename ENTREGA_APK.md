# APK Preview — Maestro a Domicilio

Build solicitado el 5 de septiembre de 2026.

## Actualización: cierre de sesión, popup y rendimiento

- Build ID: `3af15e15-f3f4-4f39-b41d-9e360da73dd4`; `versionCode`: 5.
- Estado: compilación en curso en EAS.
- [Seguimiento de la versión 5](https://expo.dev/accounts/tesis-trio-de-tres-personas-con-tres-integrantes/projects/TesisApp/builds/3af15e15-f3f4-4f39-b41d-9e360da73dd4).

Sustituye la franja fija por un popup descartable y configuración en Mi perfil. Corrige el bloqueo al salir, el bucle de registro push, la carga de perfil y las peticiones repetidas del chat. TypeScript, lint, exportación Android/Hermes y 34 pruebas automatizadas correctos. [Detalle y límites](CORRECCION_SESION_Y_RENDIMIENTO.md).

## Actualización: espacio para la navegación del teléfono

- Build ID: `57fc107c-1a27-4ed1-b752-19d48eecb5a6`; `versionCode`: 4.
- Estado: compilación finalizada correctamente en EAS.
- [Descargar APK actualizada (versión 4)](https://expo.dev/artifacts/eas/pXqzTEQnCK-ChSj390P6rbmjBAfvuNXX01heDWQeebM.apk).
- [Seguimiento de la APK actualizada](https://expo.dev/accounts/tesis-trio-de-tres-personas-con-tres-integrantes/projects/TesisApp/builds/57fc107c-1a27-4ed1-b752-19d48eecb5a6).

El aviso de compartir ubicación reserva el margen inferior y lateral del sistema, para mantener su botón por encima de la navegación por botones o gestos. Su área táctil tiene una altura mínima de 48 puntos. Los avisos emergentes también respetan los márgenes superior e inferior. Verificación: TypeScript y lint correctos; las pruebas físicas corresponden al usuario.

## APK anterior

- Build ID: `c4a12556-6d71-4039-b140-01b88e147651`.
- Plataforma: Android; perfil Preview; distribución interna; APK.
- SDK: Expo 57; `versionCode`: 3.
- Estado: compilación finalizada correctamente en EAS.
- [Descargar APK](https://expo.dev/artifacts/eas/3-RzjwHnh1tXfyZQscZE0DAgA7Pdxks8RnJOvTTDnBw.apk).
- [Seguimiento del build](https://expo.dev/accounts/tesis-trio-de-tres-personas-con-tres-integrantes/projects/TesisApp/builds/c4a12556-6d71-4039-b140-01b88e147651).

Incluye los cambios locales de central, notificaciones, GPS, chat de monitoreo, tarifas y pantalla del trabajador. No es el APK antiguo del build SDK 57 de la rama recuperada.

Las variables de Preview incluyen `EXPO_PUBLIC_NOTIFICATION_MODE=demo-direct` y `EXPO_PUBLIC_MEDIA_MODE=firestore-demo`. FCM v1 y la firma Android se verificaron en EAS. Las reglas e índices de Firestore ya están desplegados.

Para las pruebas físicas que realizará el usuario, instalar este mismo APK en los tres teléfonos, iniciar sesión en cada rol y aceptar permisos de notificación. Si un equipo fue forzado a detener la aplicación desde Ajustes, volver a abrirla antes de evaluar recepción. El perfil permite actualizar el registro del teléfono y revisar problemas de envío.

En la nueva secuencia, la central fija la tarifa y el alcance antes de asignar. El trabajador mantiene acceso a su cuenta mientras espera el PIN. Compartir GPS con la central se activa desde el aviso visible durante el servicio.

El modo directo y el GPS tienen límites documentados en `ANALISIS_Y_ESTADO_TESIS.md`; no se realizaron las pruebas físicas en nombre del usuario.
