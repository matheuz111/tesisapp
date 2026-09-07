# Monitoreo de la central

En la bandeja de ADMIN u OPERATOR, abrir **Monitorear ubicación y chat** en una solicitud. La pantalla escucha los cambios del servicio, las ubicaciones y los mensajes de Firestore. Incluye texto, imágenes ampliables y carga de mensajes anteriores, en modo de solo lectura.

El mapa distingue el domicilio confirmado (rojo), GPS del cliente (verde) y GPS del trabajador (azul). No utiliza la dirección del domicilio como si fuera GPS del cliente. Muestra la hora de captura, precisión y antigüedad; después de 45 segundos sin datos recientes indica que la posición está desactualizada.

Durante un servicio activo, cliente y trabajador ven un aviso global sobre supervisión del chat y un botón para compartir o pausar GPS. La captura continúa al navegar al chat y se detiene al pasar la app a segundo plano, cerrar sesión, pausar o terminar el servicio. Al reabrir en la misma sesión se reanuda si estaba habilitada. No hay rastreo con la aplicación cerrada. La última posición queda conservada y no implica presencia actual.

Las posiciones se guardan en `service_requests/{requestId}/locations/{userId}`. Las reglas restringen escritura al propio participante en un servicio activo y lectura a la central o al propietario. Los participantes reasignados no pueden seguir enviando posiciones al servicio anterior.

## Para habilitarlo en los teléfonos

- Las reglas de `firestore.rules` ya se desplegaron en `tesis-servicios` el 5 de septiembre de 2026, después de probarlas con el emulador.
- El proyecto se reconcilió con SDK 57 conservando el flujo empresarial. Consultar `ENTREGA_APK.md` para el APK generado.
- Las pruebas en tres celulares las realiza el usuario: activar compartir GPS en cliente y trabajador, abrir el monitor en central, intercambiar texto/fotos, mover dispositivos, pausar GPS y finalizar el servicio.

Las verificaciones locales y del emulador no sustituyen la prueba física de recepción de notificaciones, permisos, cámara y GPS en los teléfonos del usuario.
