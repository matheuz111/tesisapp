# 🐛 RESUMEN DE INCIDENCIAS, DEFECTOS Y RESOLUCIONES — QA
**Proyecto:** Maestro a Domicilio Perú S.A.C.  
**Tesis:** Eficiencia Operativa en Empresa Multiservicios de Lima, 2026  
**Auditor:** QA Automation & Security Auditor  

---

## 1. CLASIFICACIÓN DE DEFECTOS ENCONTRADOS

| ID | Sistema | Severidad | Defecto / Vulnerabilidad | Estado | Archivo Implicado |
| :--- | :--- | :---: | :--- | :---: | :--- |
| **BUG-QA-001** | Móvil | **ALTA** | Dependencia `expo-task-manager` ausente en entorno local | **CORREGIDO** | `package.json` / `node_modules` |
| **BUG-QA-002** | Móvil | **MEDIA** | Tipado `any` implícito en callback de telemetría de fondo | **CORREGIDO** | `src/services/backgroundLocationTask.ts` |
| **BUG-QA-003** | Web | **ALTA** | Estado de asignación no sincronizado (`PENDING` vs `ASIGNADA`) | **CORREGIDO** | `admin-web/src/components/AssignWorkerModal.tsx` |
| **BUG-QA-004** | Web | **BAJA** | Fallo de renderizado en Lightbox si la evidencia fotográfica era nula | **CORREGIDO** | `admin-web/src/components/ImageLightboxModal.tsx` |
| **LIMIT-001** | Móvil | **LIMITACIÓN** | Optimización de batería de Android restringe push en detención forzada | **DOCUMENTADO** | Configuración nativa Android |
| **LIMIT-002** | Ambos | **LIMITACIÓN** | Límite de 300 KB en fotos base64 por documento de Firestore | **CONTROLADO** | Compresor de imágenes en cliente |

---

## 2. DETALLE DE DEFECTOS Y CORRECCIONES TÉCNICAS

### 🔴 BUG-QA-001: Desincronización del módulo `expo-task-manager`
- **Severidad:** ALTA
- **Precondiciones:** Compilación limpia de TypeScript con `npx tsc --noEmit`.
- **Comportamiento Inicial:** El compilador fallaba con `error TS2307: Cannot find module 'expo-task-manager'`.
- **Causa Raíz:** El paquete estaba declarado en `package.json` pero no se había ejecutado la sincronización en el árbol de dependencias local.
- **Corrección Implementada:** Ejecución controlada de `npm install` y verificación de `build/TaskManager.js`.
- **Verificación:** `npx tsc --noEmit` finaliza con Código 0 sin errores.

### 🟡 BUG-QA-002: Tipos no seguros en callback de tarea de geolocalización
- **Severidad:** MEDIA
- **Precondiciones:** Verificación con TypeScript estricto (`noImplicitAny`).
- **Comportamiento Inicial:** Los parámetros `({ data, error })` en `TaskManager.defineTask` carecían de tipado, arriesgando caídas de la app ante datos incompletos.
- **Causa Raíz:** Falta de importación del genérico de tarea de Expo Task Manager.
- **Corrección Implementada:** Anotación estricta con `TaskManager.TaskManagerTaskBody<{ locations?: Location.LocationObject[] }>`.
- **Verificación:** Código 0 en TypeScript y linter.

### 🔴 BUG-QA-003: Discrepancia en estado canónico durante asignación técnica
- **Severidad:** ALTA
- **Precondiciones:** Flujo de asignación de técnico desde la central web (`AssignWorkerModal.tsx`).
- **Comportamiento Inicial:** El modal actualizaba la orden con el estado en español `ASIGNADA`, rompiendo el contrato compartido con el aplicativo móvil que escuchaba el estado canónico `PENDING`.
- **Causa Raíz:** Implementación inicial no alineada con el archivo canónico de contratos de datos (`src/types/canonical.ts`).
- **Corrección Implementada:** Estandarización a `PENDING` e inclusión de `assignedAt` con `serverTimestamp()`.
- **Verificación:** Validado con la suite de pruebas unitarias `admin-web/test/canonical.test.mjs` y `crossPlatformIntegration.test.cjs`.

### 🟢 BUG-QA-004: Tolerancia a fallos en visor de evidencias (Lightbox)
- **Severidad:** BAJA
- **Precondiciones:** Apertura de modal de evidencia fotográfica sobre órdenes con imágenes en proceso de carga o URL inválida.
- **Comportamiento Inicial:** El modal rompía el ciclo de render si la propiedad `src` era nula o indefinida.
- **Causa Raíz:** Ausencia de validación perimetral y componente de fallback visual.
- **Corrección Implementada:** Renderizado condicional con estado de carga, indicador de error y botón de cierre seguro.
- **Verificación:** Aprobado en `npm --prefix admin-web run build`.

---

## 3. LIMITACIONES TÉCNICAS CONTROLADAS (USO ACADÉMICO / PILOTO)

1. **Notificaciones Push sin Cloud Functions Desplegadas:**  
   El aplicativo implementa un mecanismo directo de emisión mediante Expo Push API (`src/services/demoPushService.ts`), con cola local persistente de reintentos en AsyncStorage. Para uso comercial a gran escala, se recomienda implementar Google Cloud Functions v2 con triggers en Firestore.
2. **Capacidad de Almacenamiento en Firestore Demo:**  
   Al no disponer de un bucket comercial activo de Firebase Storage, las fotografías de diagnósticos y evidencias se comprimen en base64 (< 300 KB) dentro del documento. Esta solución es 100 % funcional para la sustentación y pruebas de campo con decenas de servicios, pero debe migrar a Storage para operaciones masivas.
