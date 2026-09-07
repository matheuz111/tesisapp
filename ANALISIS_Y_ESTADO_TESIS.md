# Maestro a Domicilio: implementación y defensa de tesis

Actualizado: 5 de septiembre de 2026.

## 1. Modelo implementado

La aplicación funciona como una central de servicios de una empresa. El cliente solicita atención y confirma un destino. La central cotiza, selecciona y asigna al trabajador; el trabajador acepta, valida la llegada con PIN, registra evidencia y termina. La central revisa la evidencia y cierra el servicio.

La tarifa es un precio de la empresa por servicio, no una tarifa que publique o negocie el trabajador. Se almacena en céntimos de sol para evitar errores de decimales; incluye alcance, operador responsable, fecha y versión. Cada modificación genera un registro de auditoría. Se exige una tarifa antes de asignar y queda bloqueada tras la aceptación del trabajador. El cliente y el trabajador pueden consultarla, pero las reglas de Firestore impiden que la modifiquen directamente. El total del historial del trabajador se presenta como importe de servicios, no como su remuneración.

El mapa se inicializa con GPS si existe permiso. El cliente puede tocar otro punto o arrastrar el marcador. La dirección se obtiene a partir del punto elegido; la referencia (piso, puerta, etc.) se guarda por separado. El destino confirmado es el mismo para los tres roles y se diferencia del GPS en vivo de cada participante. Una respuesta tardía del GPS no sustituye una selección manual.

La pantalla del trabajador utiliza encabezado, tarjetas y acciones consistentes con la del cliente. El servicio activo y el PIN están dentro de una pantalla desplazable que mantiene accesibles perfil, historial y cierre de sesión.

## 2. Notificaciones: lo verificado y sus límites

Se verificó en Expo/EAS la credencial FCM v1 del proyecto `tesis-servicios`; coincide con el archivo de cuenta de servicio proporcionado. Una petición de validación a FCM con un token ficticio devolvió el error esperado de token inválido. Esto comprueba que se puede llegar al endpoint de FCM, pero no sustituye una entrega real a un teléfono.

El entorno EAS Preview y el perfil del build incluyen `demo-direct`. No depende exclusivamente del `.env` local. El flujo de demostración utiliza Expo Push Service desde el teléfono que origina cada acción; no requiere Cloud Functions desplegadas para que el destinatario reciba un aviso con su aplicación en segundo plano.

Cobertura añadida o conservada:

| Evento | Destinatario |
| --- | --- |
| Nueva solicitud | Central |
| Tarifa fijada o modificada | Cliente y trabajador asignado, si existe |
| Asignación | Trabajador y cliente |
| Aceptación e inicio con PIN | Cliente |
| Rechazo o necesidad de reasignar | Central |
| Reasignación solicitada después de aceptar | Central y cliente |
| Cancelación del cliente | Central y trabajador asignado |
| Finalización con evidencia | Cliente y central |
| Validación y cierre | Cliente |
| Texto o imagen de chat | El otro participante |

La cola local conserva envíos fallidos y los reintenta con la aplicación abierta; no procesa pendientes pertenecientes a otra cuenta. Se consulta el resultado posterior de Expo (receipts) para detectar errores de FCM. El perfil permite actualizar el registro del teléfono y consultar avisos pendientes o errores. Los tokens se sincronizan con los servicios y se desvinculan al cerrar sesión. Un ticket aceptado por Expo no significa que el usuario haya recibido o leído el mensaje.

**Límite de arquitectura:** si el teléfono emisor se cierra antes de preparar/enviar un aviso, o permanece sin conexión, el modo directo no tiene un servidor independiente que complete inmediatamente ese envío. Los reintentos de la cola y la consulta de receipts requieren que la app vuelva a ejecutarse. Este modo es adecuado para la demostración controlada; para explotación comercial conviene trasladar la emisión a un backend con eventos persistentes, reintentos e idempotencia.

Android también puede bloquear la recepción cuando el usuario fuerza la detención de la aplicación; esto es distinto de enviarla al fondo o retirarla de recientes. Deben mantenerse habilitados los permisos de notificación y revisar las restricciones de batería del fabricante. [Comportamiento documentado por Firebase](https://firebase.google.com/docs/cloud-messaging/flutter/receive-messages). El servicio de Expo no cobra por enviar notificaciones. [Documentación oficial de Expo](https://docs.expo.dev/push-notifications/faq/).

## 3. Fotografías y despliegue

No se encontró un bucket de Storage ni Cloud Functions desplegadas. La versión Preview usa `firestore-demo`: comprime y redimensiona las fotos de solicitud y evidencia, con un máximo de 300.000 caracteres base64 por imagen, para guardarlas dentro del documento del servicio. No se da por finalizado un trabajo si su evidencia no pudo guardarse. La central ve la fotografía antes del cierre y no puede validar desde la interfaz un servicio sin evidencia.

Esto evita que la demostración dependa de un bucket que no existe. Para producción, las imágenes deben pasar a almacenamiento de objetos y los documentos guardar únicamente referencias. Firestore limita cada documento a 1 MiB. [Límites oficiales](https://firebase.google.com/docs/firestore/quotas).

Las reglas e índices de Firestore se desplegaron correctamente. Los índices remotos adicionales se conservaron. `.env` se retiró del seguimiento de Git conservando el archivo local. La cuenta de servicio, `.env` y las herramientas locales se excluyen del archivo de EAS; una inspección del paquete no encontró claves privadas.

Se recuperó `origin/upgrade/sdk-57`. Esa rama también revertía partes del flujo empresarial, por lo que se integraron sus versiones de dependencias y se adaptó el código actual, conservando la central, el monitoreo y las nuevas funcionalidades. Expo Doctor pasó 21/21 comprobaciones con SDK 57.

## 4. Evaluación: tracking sin abrir otra aplicación

**Sí, es viable mostrar la posición del trabajador dentro de la app con lo existente.** Ya se dispone de `expo-location`, un mapa nativo y listeners de Firestore. La central usa esta base para el monitoreo. Extenderla a la vista del cliente requeriría dar al cliente permiso de lectura de la ubicación del trabajador de su servicio y dibujar ese marcador, con hora de actualización, precisión y estado desactualizado. Esta extensión se deja como evaluación, tal como se solicitó.

Hay tres alcances distintos:

| Alcance | Qué se necesita | Evaluación de coste |
| --- | --- | --- |
| Ver un marcador que se mueve | GPS, mapa actual y sincronización de coordenadas | Viable dentro de las cuotas gratuitas para una demo pequeña |
| Mostrar ruta por calles y tiempo estimado | Servicio de cálculo de rutas, control de cuota y protección de credenciales | No viene incluido por dibujar un mapa; hay cuotas gratuitas y costes por exceso |
| Navegación giro a giro y GPS en segundo plano | Motor de navegación, tareas/permisos de ubicación y configuración nativa | Requiere trabajo adicional; no debe prometerse funcionamiento con la app forzada a detenerse |

La lista vigente de Google muestra Maps SDK con uso gratuito ilimitado en ese SKU, mientras Compute Routes Essentials tiene una cuota gratuita mensual de 10.000 eventos y tarifas posteriores. Son productos diferentes; otros servicios de mapas y sus requisitos de facturación no quedan cubiertos por esta afirmación. [Precios oficiales de Google Maps](https://developers.google.com/maps/billing-and-pricing/pricing).

Firestore ofrece 20.000 escrituras y 50.000 lecturas diarias en la cuota gratuita. Como estimación: un teléfono enviando una posición cada 10 segundos durante una hora produce hasta 360 escrituras; cliente y trabajador juntos, unas 720 por hora de servicio. Hay que sumar lecturas de cada observador, mensajes, cambios de estado y reconexiones. Esto permite una demostración pequeña, pero no significa capacidad ilimitada. [Cuotas oficiales de Firestore](https://firebase.google.com/docs/firestore/quotas).

La ubicación en segundo plano exige permisos y configuración adicionales. `expo-location` no la añade automáticamente por tener un mapa. [Documentación de ubicación](https://docs.expo.dev/versions/latest/sdk/location/).

## 5. Mejoras futuras de lógica de negocio

1. **Aprobación de cotización por el cliente.** Añadir un estado de cotización enviada/aceptada antes de asignar, con alcance y exclusiones. Hoy el precio lo establece la central y se informa al cliente; falta una aceptación explícita de la oferta.
2. **Adicionales y materiales.** Registrar presupuesto original y adicionales por separado, con motivo, aprobación y auditoría. No sobrescribir el precio de un servicio ya aceptado. Distinguir visita diagnóstica, mano de obra y materiales.
3. **Agenda y capacidad real.** Usar turnos, ausencias, intervalos reservados y duración estimada. La asignación actual evita nuevas dobles asignaciones usando una reserva transaccional por trabajador; la evolución natural es reservar franjas horarias.
4. **Tiempos de atención medibles.** Definir objetivos para cotizar, asignar, aceptar y llegar. Escalar automáticamente solicitudes sin respuesta y urgencias. Medir mediana y percentil 90, no solo promedios.
5. **Incidencias y garantías.** Abrir un caso separado por reclamo, visita fallida, retrabajo o garantía, relacionado con el servicio original y con responsable de seguimiento.
6. **Cobro y administración.** Separar precio, estado de pago, medio de pago y comprobante. La facturación del servicio no equivale al salario o liquidación del trabajador. La política concreta debe definirla la empresa.
7. **Backend de confianza.** Mover validación de transiciones, PIN, calificaciones, asignaciones y notificaciones a operaciones de servidor auditadas. Actualmente el PIN forma parte del documento que lee el trabajador: es una confirmación de flujo, no una prueba criptográfica independiente de presencia. Las reglas de perfil y la colección heredada de chats también necesitan endurecimiento antes de uso comercial.
8. **Privacidad y retención.** Limitar los datos públicos de perfiles, permisos por organización y tiempos de conservación de chat, fotografías y ubicaciones. Registrar quién accede a conversaciones desde la central. El monitor actual es de solo lectura y el GPS tiene control visible para el participante.
9. **Observabilidad y entrega.** Centralizar métricas de errores, recibos de push, latencia y reintentos; depurar tokens inválidos y alertar a operaciones. La cola local actual es una mitigación de demo, no una cola de servidor.
10. **Pruebas y sostenibilidad.** Mantener una sola rama de integración, releases identificables, pruebas automáticas por rol, pruebas de concurrencia y presupuesto de consumo. Revisar también las alertas de dependencias reportadas por npm antes de una publicación comercial.

## 6. Cómo presentarlo en la defensa

La contribución principal es digitalizar y hacer trazable el proceso de una empresa de servicios: selección y confirmación del destino, control central de tarifas y asignación, atención con PIN, evidencia y supervisión. El mapa y el chat son instrumentos del proceso, no el objetivo completo de la aplicación.

Puede evaluarse comparando el proceso anterior y el digital en tiempo de asignación, solicitudes sin atender, errores de dirección, cambios de tarifa sin autorización, tiempo de respuesta y proporción de servicios cerrados con evidencia. Una prueba de tres roles demuestra integración; no demuestra por sí sola escalabilidad, seguridad comercial ni entrega garantizada de todas las notificaciones.

Verificaciones realizadas: TypeScript, ESLint, bundle Android, Expo Doctor 21/21, 18 pruebas de lógica/cola/receipts/GPS/tarifas, 10 pruebas de reglas con el emulador y 4 pruebas del backend preparado. Se comprueba también la conversión de GeoPoint al formato del mapa nativo y el reintento independiente por dispositivo. Las pruebas físicas en tres celulares corresponden al usuario. El estado y enlace del APK se registran en `ENTREGA_APK.md` cuando finaliza EAS Build.
# Actualización de sesión y rendimiento

El aviso fijo de ubicación fue reemplazado por un popup descartable y configuración en el perfil. Se corrigieron el bucle de registro push, el cierre de sesión dependiente de Firestore y consultas repetidas del chat. Ver [correcciones y verificaciones](CORRECCION_SESION_Y_RENDIMIENTO.md). Esta actualización sustituye las descripciones anteriores de la franja de GPS y del cierre de sesión.
