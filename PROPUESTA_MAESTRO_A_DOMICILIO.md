# Propuesta de adaptación para Maestro a Domicilio

## Enfoque

La solución deja de operar como un marketplace abierto y se convierte en un sistema de gestión y despacho para una central de servicios domiciliarios. Maestro a Domicilio conserva el control sobre la aprobación de técnicos, asignación, seguimiento y cierre de cada atención.

## Problemática por validar

Maestro a Domicilio podría presentar dificultades para centralizar, asignar y monitorear oportunamente solicitudes recibidas por diferentes canales, debido a la variedad de especialidades, técnicos y zonas de cobertura. Esto puede generar demoras, carga operativa y limitada trazabilidad.

Esta formulación es una hipótesis y debe validarse mediante entrevistas y medición del proceso actual.

## Pregunta de investigación

¿En qué medida la implementación de un sistema de asignación y monitoreo basado en geolocalización mejora la eficiencia operativa de los servicios técnicos domiciliarios de Maestro a Domicilio en Lima Metropolitana?

## Objetivo general

Implementar un sistema de asignación y monitoreo que centralice las solicitudes y optimice la coordinación entre la central de operaciones y los técnicos de Maestro a Domicilio.

## Actores

- Cliente: registra y consulta su solicitud, recibe información del técnico y valida el inicio mediante PIN.
- Operador: revisa la bandeja, selecciona técnicos, supervisa estados, atiende reasignaciones y valida cierres.
- Técnico: informa disponibilidad, recibe asignaciones, acepta o devuelve solicitudes, valida el PIN y registra evidencias.
- Administrador: gestiona operadores, políticas, especialidades y configuración institucional.

## Flujo del MVP

1. El cliente describe el problema, indica especialidad, urgencia, distrito y dirección.
2. La solicitud ingresa a la bandeja de la central con estado `PENDING_ASSIGNMENT`.
3. El sistema ordena técnicos aprobados y disponibles por especialidad, distancia, reputación y disponibilidad.
4. El operador confirma la asignación.
5. El técnico recibe una notificación y acepta o devuelve el servicio a la central.
6. El cliente consulta el avance y recibe un PIN de seguridad.
7. El técnico valida el PIN, realiza el trabajo y carga evidencia.
8. La central revisa la evidencia y cierra el servicio.

## Estados principales

- `PENDING_ASSIGNMENT`: solicitud nueva pendiente de la central.
- `REQUIRES_REASSIGNMENT`: el técnico seleccionado no puede atender.
- `PENDING`: técnico asignado, pendiente de aceptación.
- `ACCEPTED`: técnico en camino.
- `IN_PROGRESS`: PIN validado y servicio en ejecución.
- `COMPLETED`: técnico registró la culminación.
- `ARCHIVED`: central validó y cerró el servicio.
- `CANCELLED_BY_CLIENT` / `CANCELLED_BY_PROVIDER`: cancelación registrada.

## Indicadores sugeridos

- Tiempo promedio desde solicitud hasta asignación.
- Tiempo promedio de aceptación del técnico.
- Tiempo desde aceptación hasta llegada.
- Porcentaje de solicitudes reasignadas.
- Porcentaje de servicios completados.
- Cumplimiento del tiempo objetivo de atención.
- Cantidad de servicios gestionados por operador.
- Satisfacción del cliente.
- Porcentaje de servicios con trazabilidad y evidencia completa.

## Alcance posterior

- Integración oficial con WhatsApp Business.
- Registro de solicitudes telefónicas por el operador.
- Cotizaciones y aprobación de materiales.
- Pagos, comprobantes y liquidación a técnicos.
- Gestión de garantías e incidencias.
- Tablero analítico por distrito, especialidad y técnico.
