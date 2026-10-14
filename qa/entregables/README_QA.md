# 📦 PAQUETE INTEGRAL DE QA — MAESTRO A DOMICILIO PERÚ (2026)
## Tesis: “IMPLEMENTACIÓN DE APLICATIVO MÓVIL PARA MEJORAR LA EFICIENCIA OPERATIVA EN UNA EMPRESA MULTISERVICIOS DE LIMA, 2026”

Este directorio (`qa/`) concentra la auditoría técnica completa, suites de pruebas automatizadas, evidencias visuales, matrices de trazabilidad, plan de ejecución y los informes formales para la sustentación académica de la tesis.

---

## 📂 1. ESTRUCTURA DEL DIRECTORIO `qa/`

```text
qa/
├── entregables/
│   ├── Informe_QA_Integral_Movil_Web_Tesis_2026.docx   # Informe técnico formal en Word (Portada, índice, tablas, métricas)
│   ├── Informe_QA_Integral_Movil_Web_Tesis_2026.pdf    # Versión exportada en PDF de alta fidelidad
│   ├── Plan_Ejecucion_QA.xlsx                          # Cronograma, fases, recursos y bitácora detallada
│   ├── Matriz_Trazabilidad_QA.xlsx                     # Mapeo: Requisitos ↔ Componentes ↔ Casos de Prueba ↔ Evidencias
│   ├── Registro_Ejecuciones_QA.md                      # Log histórico de comandos, salidas y tiempos de ejecución
│   ├── Resumen_Incidencias_QA.md                       # Detalle de bugs encontrados, causas raíz y resoluciones
│   └── README_QA.md                                    # Esta guía de navegación y reproducción
└── evidencias/
    ├── movil/                                          # Capturas de pantalla de la app Android (Cliente y Técnico)
    ├── web/                                            # Capturas del panel web administrativo (Central de Operaciones)
    ├── integracion/                                    # Evidencias de flujos transversales Móvil ↔ Web
    └── incidencias/                                    # Capturas de errores previos a su resolución
```

---

## 🎯 2. RESUMEN DE COBERTURA Y RESULTADOS VERIFICABLES

| Componente | Framework / Motor | Batería Automatizada | Compilación / Linter | Estado Final |
| :--- | :--- | :---: | :---: | :---: |
| **App Móvil** | React Native 0.86.3 / Expo SDK 57 | **90 / 90 tests** (17 suites) | `npx tsc --noEmit` (0 err)<br>`expo lint` (0 err) | **APROBADO** |
| **Panel Web** | React 19.2.8 / Vite 8.3.0 | **18 / 18 tests** (4 suites) | `tsc -b` (0 err)<br>`oxlint` (0 err) | **APROBADO** |
| **Integración E2E** | Firebase Modular v12 / Local Node Runner | **11 / 11 tests** transversales | Contrato SPSS verificado | **APROBADO** |
| **TOTAL GENERAL** | Multi-entorno Node.js + Vite | **108 / 108 tests (100 % VERDE)** | **Cero errores de compilación** | **LISTO PARA PILOTO** |

---

## 🚀 3. COMANDOS PARA REPRODUCIR LA AUDITORÍA

### A. Pruebas Automatizadas Móvil y de Integración (90 Tests):
```powershell
npm test
```
*Ejecuta las 17 suites en `test/` mediante el runner nativo de Node.js en ~2.6 segundos.*

### B. Pruebas Automatizadas del Panel Web (18 Tests):
```powershell
node --test admin-web/test/canonical.test.mjs admin-web/test/filters.test.mjs admin-web/test/rbac.test.mjs admin-web/test/spss.test.mjs
```
*Valida RBAC (ADMIN/OPERATOR), filtros de bandeja, normalización de distritos de Lima y derivación de variables SPSS en ~150 ms.*

### C. Verificación Estática y Compilación de Producción:
```powershell
# Móvil:
npx tsc --noEmit
npm run lint

# Web:
npm --prefix admin-web run lint
npm --prefix admin-web run build
```

---

## 📊 4. VARIABLES METODOLÓGICAS DE LA TESIS (SPSS)

Cada servicio atendido calcula y almacena determinísticamente las variables requeridas para la contrastación de la hipótesis general y específicas:

1. `T_RESP_MIN`: Tiempo de respuesta (minutos desde solicitud del cliente hasta cotización formal de la central).
2. `T_ASIG_MIN`: Tiempo de asignación (minutos hasta selección del técnico disponible).
3. `T_VIS_MIN`: Tiempo a inicio de visita (minutos hasta llegada física y validación de PIN en sitio).
4. `T_TOTAL_MIN`: Tiempo total del ciclo (minutos hasta auditoría de evidencia y validación final).
5. `CAMBIOS_EST`: Cantidad total de transiciones registradas inmutablemente en `status_history`.
6. `TRAZ_COMP`: Indicador dicotómico (1 = trazabilidad completa con ≥ 7 hitos y validación central; 0 = incompleto).
7. `EVID_INI`: Indicador de evidencia fotográfica del diagnóstico inicial (1/0).
8. `EVID_FIN`: Indicador de evidencia fotográfica del trabajo culminado (1/0).
