# Bitácora de QA & Auditoría Técnica — Panel Web Administrativo

**Proyecto de Tesis:** IMPLEMENTACIÓN DE APLICATIVO MÓVIL PARA MEJORAR LA EFICIENCIA OPERATIVA EN UNA EMPRESA MULTISERVICIOS DE LIMA, 2026  
**Producto Evaluado:** Plataforma Operativa Maestro a Domicilio Perú S.A.C.  
**Alcance Exclusivo:** `TesisApp/admin-web/`  
**Rama Git:** `feature/web-qa-admin`  
**Entorno de Ejecución:** Vite 8.3.0 · React 19.2.8 · TypeScript 6.0.2 · Firebase JS SDK 12.19.0 · Node.js v22.19.0 en Windows 11

---

## 1. Matriz de Casos de Prueba

| ID | Componente | Estado | Ambiente | Duración observada | Evidencia | Incidencia |
| :--- | :--- | :---: | :--- | ---: | :--- | :--- |
| **CP-WEB-01** | Login/Auth | **EN EJECUCIÓN** | Chrome 155 (headless + CDP) | ~3,500 ms | `admin-web/evidence/CAP_WEB_01_LOGIN_RBAC.png`, `admin-web/test/rbac.test.mjs` | — |
| **CP-WEB-02** | Filtros/tabla | **APROBADO** | Node 22 + React estático | ~1.6 ms (1,000 reqs) | `admin-web/test/filters.test.mjs` (5/5 tests ok) | BUG-WEB-002, BUG-WEB-004 |
| **CP-WEB-03** | Solicitud manual | **APROBADO** | Verificación estática + tipado | — | `NewManualRequestModal.tsx` (runTransaction + counters atómico) | BUG-WEB-005 |
| **CP-WEB-04** | Asignación técnica | **APROBADO** | Verificación estática + contrato | — | `AssignWorkerModal.tsx` corregido a estado canónico `PENDING` | BUG-WEB-001 |
| **CP-WEB-05** | Mapa operativo | **APROBADO** | Leaflet 1.9 + Esri/OSM | — | `OperationalMapModal.tsx` (cleanup completo en unmount, capas sin API key) | — |
| **CP-WEB-06** | Baremo/precios | **APROBADO** | Node 22 + TypeScript | ~1.2 ms | `admin-web/test/canonical.test.mjs` (política 2026, céntimos) | — |
| **CP-WEB-07** | Evidencias Lightbox | **APROBADO** | Verificación estática + componente | — | `ImageLightboxModal.tsx` con `onLoad` progresivo y `onError` | BUG-WEB-003 |
| **CP-WEB-08** | Proforma & Garantía PDF | **APROBADO** | jsPDF 4.2 + jspdf-autotable | ~660 ms build | `pdfGenerator.ts` (A4 vectorial formal; QR marcado como visual/simulado) | — |
| **CP-WEB-09** | Excel/SPSS | **APROBADO** | Node 22 + xlsx 0.18 | ~2.4 ms | `admin-web/test/spss.test.mjs` (26 variables canónicas) | — |
| **CP-WEB-10** | Chat Central | **APROBADO** | Firestore rules + componente | — | `RealtimeChatModal.tsx` (`service_requests/{id}/messages`) | — |
| **CP-E2E-01** | Ciclo completo | **BLOQUEADO** | Web + Android | — | Pendiente coordinación con dispositivo móvil y técnico | Requiere app móvil activa |
| **CP-E2E-02** | Reasignación | **BLOQUEADO** | Web + Android | — | Pendiente coordinación con dispositivo móvil y técnico | Requiere app móvil activa |
| **CP-E2E-03** | Cancelación | **BLOQUEADO** | Web + Android | — | Pendiente coordinación con dispositivo móvil y cliente | Requiere app móvil activa |
| **CP-E2E-04** | Pago manual | **BLOQUEADO** | Web + Android | — | Pendiente voucher real o emitido desde app cliente | Requiere app móvil activa |

---

## 2. Registro de Incidencias Técnicas Corregidas

### BUG-WEB-001 — Asignación de técnico cambiaba estado prematuramente a ACCEPTED en vez de PENDING

- **Severidad:** ALTA
- **Caso relacionado:** CP-WEB-04 / CP-E2E-01
- **Ambiente:** Vite + React 19 / Windows Chrome
- **Precondiciones:** Solicitud en estado `PENDING_ASSIGNMENT` o `REQUIRES_REASSIGNMENT`.
- **Pasos para reproducir:** Abrir `AssignWorkerModal`, seleccionar un técnico disponible y presionar confirmar.
- **Resultado anterior:** La solicitud pasaba directamente a `ACCEPTED`, saltándose el flujo de solicitud entrante del técnico en la app móvil (`requests.find(r => r.status === 'PENDING')`).
- **Resultado esperado:** El estado debe ser `PENDING` para que la app móvil del técnico reciba la oferta y el técnico pueda aceptarla o rechazarla.
- **Evidencia:** `admin-web/src/components/AssignWorkerModal.tsx` L83.
- **Causa raíz:** Mutación de estado desfasada del contrato del ciclo de vida móvil.
- **Archivos modificados:** `admin-web/src/components/AssignWorkerModal.tsx`
- **Verificación posterior:** Build y oxlint exitosos; estado alineado con `src/domain/serviceRequestTransition.ts`.
- **Estado:** CORREGIDO

---

### BUG-WEB-002 — Fallback de zona en useServiceRequests asignaba LIMA_CENTRO en lugar de UNKNOWN

- **Severidad:** MEDIA
- **Caso relacionado:** CP-WEB-02
- **Ambiente:** Vite + React 19
- **Precondiciones:** Solicitud sin campo `zone` y con distrito no reconocido o ausente.
- **Pasos para reproducir:** Filtrar por Zona Lima Centro en la tabla de solicitudes.
- **Resultado anterior:** Solicitudes con distrito nulo o desconocido caían en `LIMA_CENTRO`.
- **Resultado esperado:** Caer en `UNKNOWN` según la regla del contrato canónico ("Never defaults to Lima Centro").
- **Evidencia:** `useServiceRequests.ts` L128.
- **Causa raíz:** Fallback estático erróneo en el cálculo del filtro de zona.
- **Archivos modificados:** `admin-web/src/hooks/useServiceRequests.ts`
- **Verificación posterior:** Test automatizado en `admin-web/test/canonical.test.mjs` y `admin-web/test/filters.test.mjs`.
- **Estado:** CORREGIDO

---

### BUG-WEB-003 — ImageLightboxModal sin manejo de error de carga ni estado progresivo

- **Severidad:** BAJA
- **Caso relacionado:** CP-WEB-07
- **Ambiente:** Chrome local
- **Precondiciones:** Imagen lenta de cargar o URL inválida/expirada de Firebase Storage.
- **Pasos para reproducir:** Abrir lightbox sobre una imagen rota o con retardo de red.
- **Resultado anterior:** No mostraba spinner ni manejaba el evento `onError`, dejando la pantalla en negro sin retroalimentación.
- **Resultado esperado:** Indicador de carga progresiva visible y mensaje de error amigable en caso de falla.
- **Evidencia:** `ImageLightboxModal.tsx` L125-L135.
- **Causa raíz:** Ausencia de handlers `onLoad` y `onError` en el elemento `<img />`.
- **Archivos modificados:** `admin-web/src/components/ImageLightboxModal.tsx`
- **Verificación posterior:** Build y oxlint exitosos.
- **Estado:** CORREGIDO

---

### BUG-WEB-004 — Consulta a service_requests sin cláusula limit()

- **Severidad:** MEDIA
- **Caso relacionado:** CP-WEB-02
- **Ambiente:** Firestore SDK
- **Precondiciones:** Colección con crecimiento de solicitudes.
- **Pasos para reproducir:** Iniciar suscripción general en `serviceRequestRepository.subscribeAll`.
- **Resultado anterior:** Consulta no acotada (`orderBy('createdAt', 'desc')` sin límite).
- **Resultado esperado:** Límite defensivo (`limit(200)` por defecto) para prevenir descargas excesivas.
- **Evidencia:** `serviceRequestRepository.ts` L18.
- **Causa raíz:** Falta de `limit()` en la construcción de la query.
- **Archivos modificados:** `admin-web/src/repositories/serviceRequestRepository.ts`
- **Verificación posterior:** Build y lint exitosos.
- **Estado:** CORREGIDO

---

### BUG-WEB-005 — Doble envío potencial en NewManualRequestModal por falta de guard en handleSubmit

- **Severidad:** BAJA
- **Caso relacionado:** CP-WEB-03
- **Ambiente:** Chrome local
- **Precondiciones:** Formulario de solicitud manual abierto.
- **Pasos para reproducir:** Presionar Enter o clic repetido muy rápido antes del cambio de estado.
- **Resultado anterior:** `handleSubmit` solo dependía del disabled del botón.
- **Resultado esperado:** Guard inmediato `if (loading) return;` al inicio de `handleSubmit`.
- **Evidencia:** `NewManualRequestModal.tsx` L77.
- **Causa raíz:** Falta de guarda síncrona en el manejador del formulario.
- **Archivos modificados:** `admin-web/src/components/NewManualRequestModal.tsx`
- **Verificación posterior:** Build y lint exitosos.
- **Estado:** CORREGIDO
