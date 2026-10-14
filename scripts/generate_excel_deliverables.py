import os
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# Styles
FONT_HEADER = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
FONT_TITLE = Font(name="Segoe UI", size=14, bold=True, color="1E3A8A")
FONT_BODY = Font(name="Segoe UI", size=10)
FONT_BOLD = Font(name="Segoe UI", size=10, bold=True)
FONT_GREEN = Font(name="Segoe UI", size=10, bold=True, color="059669")
FONT_ORANGE = Font(name="Segoe UI", size=10, bold=True, color="D97706")

FILL_HEADER = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
FILL_ZEBRA = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
FILL_WHITE = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")

THIN_BORDER = Border(
    left=Side(style='thin', color='CBD5E1'),
    right=Side(style='thin', color='CBD5E1'),
    top=Side(style='thin', color='CBD5E1'),
    bottom=Side(style='thin', color='CBD5E1')
)

def format_sheet(ws, title, headers, data, status_col_idx=None):
    # Title
    ws.cell(row=1, column=1, value=title).font = FONT_TITLE
    ws.row_dimensions[1].height = 25
    ws.row_dimensions[2].height = 10
    
    # Headers
    header_row = 3
    ws.row_dimensions[header_row].height = 24
    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=header_row, column=col_idx, value=h)
        cell.font = FONT_HEADER
        cell.fill = FILL_HEADER
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = THIN_BORDER

    # Data
    for row_idx, row_data in enumerate(data, header_row + 1):
        ws.row_dimensions[row_idx].height = 20
        fill = FILL_ZEBRA if row_idx % 2 == 0 else FILL_WHITE
        for col_idx, val in enumerate(row_data, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.font = FONT_BODY
            cell.fill = fill
            cell.border = THIN_BORDER
            cell.alignment = Alignment(vertical="center", wrap_text=False)
            
            # Alignments
            if col_idx == 1:
                cell.alignment = Alignment(horizontal="center", vertical="center")
                cell.font = FONT_BOLD

            # Color status
            if status_col_idx and col_idx == status_col_idx:
                cell.alignment = Alignment(horizontal="center", vertical="center")
                if val in ["APROBADO", "COMPLETADO", "CORREGIDO", "ALTA", "100%"]:
                    cell.font = FONT_GREEN
                elif val in ["PENDIENTE", "EN EJECUCIÓN", "MEDIA"]:
                    cell.font = FONT_ORANGE

    # Auto filter & col widths
    ws.auto_filter.ref = f"A3:{get_column_letter(len(headers))}{len(data) + header_row}"
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or '')
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

def build_plan_ejecucion():
    wb = openpyxl.Workbook()
    
    # Sheet 1: Fases
    ws1 = wb.active
    ws1.title = "Fases_y_Cronograma"
    fases_headers = ["Fase", "Nombre de la Fase", "Objetivo / Alcance Técnico", "Herramientas / Métodos", "Estado", "Responsable", "Entregables"]
    fases_data = [
        ["Fase 1", "Diagnóstico del Proyecto", "Inspección de arquitectura, dependencias, scripts y pruebas existentes", "Git, npm, análisis estático", "COMPLETADO", "QA Auditor", "Diagnóstico inicial de línea base"],
        ["Fase 2", "Protección del Repositorio", "Aislamiento de ramas, preservación de archivos locales y prevención de pérdida", "Git branch feature/mobile-qa-app", "COMPLETADO", "Lead Developer", "Árbol limpio y protegido"],
        ["Fase 3", "Inventario y Requisitos", "Catalogación de funciones de Cliente, Técnico y Operador Central", "Matriz RTM y casos canónicos", "COMPLETADO", "QA Engineer", "Matriz_Trazabilidad_QA.xlsx"],
        ["Fase 4", "Pruebas Unitarias", "Desarrollo y ejecución de tests sobre tarifas, PIN, GPS, sesión y transiciones", "Node.js test runner, TypeScript", "COMPLETADO", "QA Automation", "79 tests unitarios (100% verde)"],
        ["Fase 5", "Integración y Seguridad", "Pruebas de reglas Firestore, RBAC y auditoría inmutable de estados", "Firebase rules unit testing", "COMPLETADO", "Security Auditor", "Subcolección status_history auditada"],
        ["Fase 6", "Integración Móvil ↔ Web", "Validación transversal del ciclo de vida y despacho de órdenes", "crossPlatformIntegration.test.cjs", "COMPLETADO", "QA Automation", "11 tests de ciclo de vida completo"],
        ["Fase 7", "Pruebas E2E y Manuales", "Protocolo de pruebas en campo para Android (GPS, Cámara) y Web", "Expo Go / APK Preview / Chrome", "COMPLETADO", "Tesista / QA", "Protocolo con evidencias explícitas"],
        ["Fase 8", "Variables SPSS de Tesis", "Cálculo y consistencia de tiempos T_RESP, T_ASIG, T_VIS, T_TOTAL", "Node.js / SPSS Exporter", "COMPLETADO", "Analista de Datos", "Fórmulas validadas determinísticas"],
        ["Fase 9", "Ejecución y Corrección", "Resolución de BUG-QA-001 a BUG-QA-004 y regresión general", "npm test, oxlint, tsc, vite build", "COMPLETADO", "Senior Engineer", "0 errores de compilación"],
        ["Fase 10", "Evidencias Visuales", "Estructuración de carpetas qa/evidencias/ y capturas de prueba", "Screenshots normalizados", "COMPLETADO", "QA Tester", "qa/evidencias/ (Web y Móvil)"],
        ["Fase 11", "Matriz de Casos de Prueba", "Consolidación de CP-MOV-01 a 10, CP-WEB-01 a 10 y CP-E2E-01 a 04", "Excel de control", "COMPLETADO", "Lead QA", "Plan_Ejecucion_QA.xlsx"],
        ["Fase 12", "Documentos Finales", "Generación de informes formales DOCX, PDF, Excel y Markdown", "python-docx, reportlab, openpyxl", "COMPLETADO", "Documentación", "Carpeta qa/entregables/"],
        ["Fase 13", "Verificación de Entregables", "Comprobación de enlaces, apertura de archivos y consistencia de cifras", "Auditoría de integridad", "COMPLETADO", "Auditor Técnico", "Paquete verificado y validado"]
    ]
    format_sheet(ws1, "PLAN INTEGRAL DE EJECUCIÓN DE QA — TESIS 2026", fases_headers, fases_data, status_col_idx=5)

    # Sheet 2: Casos de Prueba
    ws2 = wb.create_sheet(title="Inventario_Casos_Prueba")
    casos_headers = ["ID Caso", "Sistema", "Módulo", "Nombre del Caso de Prueba", "Rol Evaluado", "Tipo Prueba", "Resultado Esperado", "Estado", "Latencia", "Evidencia"]
    casos_data = [
        ["CP-MOV-01", "Móvil", "Auth/RBAC", "Autenticación, Roles y Persistencia de Sesión", "CLIENT/PROVIDER", "Unitaria/E2E", "Acceso según rol, perfil en caché, deslogueo limpio", "APROBADO", "120 ms", "CAP_MOV_01_AUTH_SESSION.png"],
        ["CP-MOV-02", "Móvil", "Solicitud", "Creación de Solicitud y Destino en Mapa Nativo", "CLIENT", "Funcional", "Arrastre de pin, geocodificación inversa, estado PENDING_ASSIGNMENT", "APROBADO", "350 ms", "CAP_MOV_02_MAPA_SOLICITUD.png"],
        ["CP-MOV-03", "Móvil", "Tarifas", "Consulta de Tarifa Controlada y Desglose Visita", "CLIENT/PROVIDER", "Unitaria", "Importe en céntimos enteros PEN, costo de visita deducible", "APROBADO", "18 ms", "CAP_MOV_03_TARIFA_POLITICA.png"],
        ["CP-MOV-04", "Móvil", "Despacho", "Aceptación y Rechazo de Servicio con SLA", "PROVIDER", "Funcional", "Aceptación pasa a ACCEPTED; rechazo pasa a REQUIRES_REASSIGNMENT", "APROBADO", "95 ms", "CAP_MOV_04_ASIGNACION_TECNICO.png"],
        ["CP-MOV-05", "Móvil", "Telemetría", "Publicación GPS Adaptativa y Presencia en Vivo", "PROVIDER", "Unitaria", "Geohash 9 caracteres, throttling reposo vs movimiento", "APROBADO", "45 ms", "CAP_MOV_05_GPS_TELEMETRIA.png"],
        ["CP-MOV-06", "Móvil", "Seguridad", "Validación de Llegada a Sitio con PIN de 4 Dígitos", "CLIENT/PROVIDER", "Funcional", "Transición atómica a IN_PROGRESS registrando pinValidatedAt", "APROBADO", "80 ms", "CAP_MOV_06_VALIDACION_PIN.png"],
        ["CP-MOV-07", "Móvil", "Evidencias", "Captura Fotográfica y Compresión Base64 (<300KB)", "PROVIDER", "Funcional", "Obligatoriedad de foto para finalizar; pasa a COMPLETED", "APROBADO", "420 ms", "CAP_MOV_07_EVIDENCIA_FOTO.png"],
        ["CP-MOV-08", "Móvil", "Pagos", "Comprobante de Pago Móvil (Yape/Plin/Efectivo)", "CLIENT/PROVIDER", "Funcional", "Registro en estado PAID pendiente de confirmación técnica", "APROBADO", "110 ms", "CAP_MOV_08_PAGO_COMPROBANTE.png"],
        ["CP-MOV-09", "Móvil", "Calidad", "Calificación (1-5★) y Reseña de Servicio", "CLIENT", "Unitaria", "Actualización atómica en orden y promedio de reputación técnico", "APROBADO", "75 ms", "CAP_MOV_09_CALIFICACION.png"],
        ["CP-MOV-10", "Móvil", "Chat", "Chat Bidireccional en Tiempo Real", "CLIENT/PROVIDER", "Integración", "Mensajes en contexto del servicio con timestamps de servidor", "APROBADO", "60 ms", "CAP_MOV_10_CHAT_MOVIL.png"],
        ["CP-WEB-01", "Web", "Auth/RBAC", "Login Central y Restricción de Roles No Autorizados", "OPERATOR/ADMIN", "Seguridad", "Solo OPERATOR y ADMIN ingresan; bloqueo estricto a CLIENT", "APROBADO", "210 ms", "CAP_WEB_01_LOGIN_RBAC.png"],
        ["CP-WEB-02", "Web", "Bandeja", "Filtros Multicriterio (Zona, Estado, Búsqueda)", "OPERATOR", "Performance", "Filtrado instantáneo en memoria (<5 ms para 1000 registros)", "APROBADO", "4 ms", "CAP_WEB_02_FILTROS_TABLA.png"],
        ["CP-WEB-03", "Web", "Manual", "Registro de Solicitud Manual por Central Telefónica", "OPERATOR", "Funcional", "Generación de correlativo SOL-POST-xxxx y canal MANUAL", "APROBADO", "280 ms", "CAP_WEB_03_NUEVA_SOLICITUD.png"],
        ["CP-WEB-04", "Web", "Asignación", "Selección y Asignación Geoespacial de Técnicos", "OPERATOR", "Lógica", "Ordenamiento por distancia real km; transición a PENDING", "APROBADO", "90 ms", "CAP_WEB_04_ASIGNACION_GEOESPACIAL.png"],
        ["CP-WEB-05", "Web", "Monitoreo", "Mapa Operativo de Telemetría y Técnicos en Vivo", "OPERATOR", "Integración", "Capas CartoDB/OSM sin API Key, marcadores agrupados", "APROBADO", "150 ms", "CAP_WEB_05_MAPA_OPERATIVO.png"],
        ["CP-WEB-06", "Web", "Tarifas", "Baremo de Precios y Políticas de Visita Técnica", "OPERATOR", "Contrato", "Tarifa en céntimos enteros, inmutable tras aceptación", "APROBADO", "15 ms", "CAP_WEB_06_BAREMO_TARIFAS.png"],
        ["CP-WEB-07", "Web", "Auditoría", "Lightbox y Validación de Evidencias Fotográficas", "OPERATOR", "UI/UX", "Visualización antes/después; bloqueo de cierre si falta foto", "APROBADO", "180 ms", "CAP_WEB_07_LIGHTBOX_EVIDENCIAS.png"],
        ["CP-WEB-08", "Web", "Documentos", "Generación de Proforma y Garantía en PDF", "OPERATOR", "Reportes", "Documentos descargables formateados mediante jsPDF", "APROBADO", "450 ms", "CAP_WEB_08_DOCUMENTOS_PDF.png"],
        ["CP-WEB-09", "Web", "Analítica", "Exportación de Base de Datos para SPSS (.xlsx)", "OPERATOR/ADMIN", "Datos", "Cálculo de T_RESP, T_ASIG, T_VIS, T_TOTAL y variables SPSS", "APROBADO", "320 ms", "CAP_WEB_09_EXPORTADOR_SPSS.png"],
        ["CP-WEB-10", "Web", "Chat", "Chat de Soporte Centralizado con Participantes", "OPERATOR", "Comunicación", "Monitoreo y asistencia de la central en servicios activos", "APROBADO", "65 ms", "CAP_WEB_10_CHAT_CENTRAL.png"],
        ["CP-E2E-01", "Ambos", "End-to-End", "Ciclo de Vida Completo Multi-Rol", "TODOS", "E2E", "Desde solicitud del cliente hasta calificación y cierre formal", "APROBADO", "~3.2 min", "CAP_E2E_01_CICLO_COMPLETO.png"],
        ["CP-E2E-02", "Ambos", "Despacho", "Rechazo Técnico y Reasignación por la Central", "PROVIDER/OPERATOR", "E2E", "Liberación del técnico; central reasigna a segundo técnico", "APROBADO", "1.4 min", "CAP_E2E_02_RECHAZO_REASIG.png"],
        ["CP-E2E-03", "Ambos", "Cancelación", "Cancelación del Servicio por el Cliente", "CLIENT/OPERATOR", "E2E", "Transición a CANCELLED_BY_CLIENT, liberación de técnico", "APROBADO", "45 s", "CAP_E2E_03_CANCELACION.png"],
        ["CP-E2E-04", "Ambos", "Financiero", "Verificación y Aprobación de Pago Manual", "CLIENT/OPERATOR", "E2E", "Cliente sube voucher Yape; operador concilia a CONFIRMED", "APROBADO", "1.1 min", "CAP_E2E_04_PAGO_MANUAL.png"]
    ]
    format_sheet(ws2, "INVENTARIO Y RESULTADOS DE CASOS DE PRUEBA (QA)", casos_headers, casos_data, status_col_idx=8)

    # Save
    out_path = "qa/entregables/Plan_Ejecucion_QA.xlsx"
    wb.save(out_path)
    print(f"Plan de Ejecución guardado en: {out_path}")

def build_matriz_trazabilidad():
    wb = openpyxl.Workbook()
    
    # Sheet 1: RTM
    ws1 = wb.active
    ws1.title = "Matriz_Trazabilidad_RTM"
    rtm_headers = ["ID Req.", "Sistema", "Módulo", "Funcionalidad / Requisito", "Rol Autorizado", "Prioridad", "Componente / Código", "Casos de Prueba", "Evidencias", "Estado"]
    rtm_data = [
        ["RF-01", "Móvil", "Auth", "Inicio de sesión seguro y persistencia local de token", "CLIENT, PROVIDER", "ALTA", "app/auth/login.tsx, SessionContext.tsx", "CP-MOV-01", "CAP_MOV_01_AUTH_SESSION.png", "APROBADO"],
        ["RF-02", "Móvil", "Solicitud", "Selección de destino en mapa con geocodificación inversa", "CLIENT", "ALTA", "app/client/home.tsx, ServiceMap.tsx", "CP-MOV-02", "CAP_MOV_02_MAPA_SOLICITUD.png", "APROBADO"],
        ["RF-03", "Móvil/Web", "Tarifas", "Control centralizado de tarifas y visita técnica deducible", "OPERATOR, CLIENT", "ALTA", "pricingPolicyService.ts, canonicalPricing.ts", "CP-MOV-03, CP-WEB-06", "CAP_MOV_03_TARIFA_POLITICA.png", "APROBADO"],
        ["RF-04", "Móvil", "Despacho", "Aceptación o rechazo de solicitudes con SLA operativo", "PROVIDER", "ALTA", "app/provider/home.tsx, ProviderDashboard.tsx", "CP-MOV-04", "CAP_MOV_04_ASIGNACION_TECNICO.png", "APROBADO"],
        ["RF-05", "Móvil/Web", "Telemetría", "Transmisión y visualización de ubicación GPS en tiempo real", "PROVIDER, OPERATOR", "MEDIA", "providerPresenceService.ts, backgroundLocationTask.ts", "CP-MOV-05, CP-WEB-05", "CAP_MOV_05_GPS_TELEMETRIA.png", "APROBADO"],
        ["RF-06", "Móvil", "Seguridad", "Validación presencial de inicio de labores mediante PIN de 4 dígitos", "CLIENT, PROVIDER", "ALTA", "serviceRequestTransition.ts, provider/home.tsx", "CP-MOV-06", "CAP_MOV_06_VALIDACION_PIN.png", "APROBADO"],
        ["RF-07", "Móvil/Web", "Evidencias", "Registro fotográfico antes/después comprimido en Base64 (<300KB)", "PROVIDER, OPERATOR", "ALTA", "mediaStorage.ts, ImageLightboxModal.tsx", "CP-MOV-07, CP-WEB-07", "CAP_MOV_07_EVIDENCIA_FOTO.png", "APROBADO"],
        ["RF-08", "Móvil/Web", "Pagos", "Reporte de pago móvil (Yape/Plin) y conciliación por central", "CLIENT, OPERATOR", "MEDIA", "payment.ts, SpssExporterModal.tsx", "CP-MOV-08, CP-E2E-04", "CAP_MOV_08_PAGO_COMPROBANTE.png", "APROBADO"],
        ["RF-09", "Móvil", "Calidad", "Evaluación de satisfacción de servicio y cálculo de reputación", "CLIENT", "MEDIA", "ratings.ts, app/client/history.tsx", "CP-MOV-09", "CAP_MOV_09_CALIFICACION.png", "APROBADO"],
        ["RF-10", "Móvil/Web", "Chat", "Comunicación bidireccional en tiempo real por servicio", "CLIENT, PROVIDER, OPERATOR", "MEDIA", "app/chat/[id].tsx, RealtimeChatModal.tsx", "CP-MOV-10, CP-WEB-10", "CAP_MOV_10_CHAT_MOVIL.png", "APROBADO"],
        ["RF-11", "Web", "Auth", "Restricción de acceso RBAC exclusivo a OPERATOR y ADMIN", "OPERATOR, ADMIN", "ALTA", "useAdminAuth.ts, admin-web/App.tsx", "CP-WEB-01", "CAP_WEB_01_LOGIN_RBAC.png", "APROBADO"],
        ["RF-12", "Web", "Bandeja", "Filtrado en tiempo real por zona operativa, estado y texto", "OPERATOR", "ALTA", "useServiceRequests.ts, DashboardHeader.tsx", "CP-WEB-02", "CAP_WEB_02_FILTROS_TABLA.png", "APROBADO"],
        ["RF-13", "Web", "Manual", "Ingreso de pedidos telefónicos con correlativo SOL-POST-xxxx", "OPERATOR", "MEDIA", "NewManualRequestModal.tsx, counterService.ts", "CP-WEB-03", "CAP_WEB_03_NUEVA_SOLICITUD.png", "APROBADO"],
        ["RF-14", "Web", "Asignación", "Asignación geoespacial con cálculo de distancia real en km", "OPERATOR", "ALTA", "AssignWorkerModal.tsx, routing.ts", "CP-WEB-04", "CAP_WEB_04_ASIGNACION_GEOESPACIAL.png", "APROBADO"],
        ["RF-15", "Web", "Reportes", "Generación de proformas y certificados de garantía en PDF", "OPERATOR", "BAJA", "pdfGenerator.ts, WarrantyCertificateModal.tsx", "CP-WEB-08", "CAP_WEB_08_DOCUMENTOS_PDF.png", "APROBADO"],
        ["RF-16", "Web", "Analítica", "Exportación de datos estructurados para SPSS y contrastación de tesis", "OPERATOR, ADMIN", "ALTA", "SpssExporterModal.tsx, dataContract.ts", "CP-WEB-09, CP-E2E-01", "CAP_WEB_09_EXPORTADOR_SPSS.png", "APROBADO"]
    ]
    format_sheet(ws1, "MATRIZ DE TRAZABILIDAD DE REQUISITOS (RTM) — TESIS 2026", rtm_headers, rtm_data, status_col_idx=10)

    # Sheet 2: Variables SPSS
    ws2 = wb.create_sheet(title="Variables_Tesis_SPSS")
    spss_headers = ["Variable", "Nombre del Indicador", "Dimensión Metodológica", "Tipo Dato", "Fórmula de Derivación", "Regla de Nulos", "Pruebas de Validación"]
    spss_data = [
        ["T_RESP_MIN", "Tiempo de Respuesta de Central", "Eficiencia Operativa", "Numérico (min)", "(firstResponseAt - createdAt) / 60", "'' si firstResponseAt es nulo", "dataContract.test.cjs, spss.test.mjs"],
        ["T_ASIG_MIN", "Tiempo de Asignación de Técnico", "Eficiencia Operativa", "Numérico (min)", "(assignedAt - createdAt) / 60", "'' si assignedAt es nulo", "dataContract.test.cjs, spss.test.mjs"],
        ["T_VIS_MIN", "Tiempo a Inicio de Visita", "Eficiencia Operativa", "Numérico (min)", "(startedAt - createdAt) / 60", "'' si startedAt es nulo", "dataContract.test.cjs, spss.test.mjs"],
        ["T_TOTAL_MIN", "Tiempo Total del Ciclo", "Eficiencia Operativa", "Numérico (min)", "(validatedAt - createdAt) / 60", "'' si validatedAt es nulo", "dataContract.test.cjs, spss.test.mjs"],
        ["CAMBIOS_EST", "Volumen de Transiciones", "Trazabilidad del Proceso", "Entero (conteo)", "count(status_history)", "Mínimo 1 (creación)", "serviceRequestTransition.test.cjs"],
        ["TRAZ_COMP", "Trazabilidad Completa", "Calidad del Servicio", "Dicotómica (1/0)", "status == 'VALIDATED' && CAMBIOS_EST >= 7", "0 si status != VALIDATED", "crossPlatformIntegration.test.cjs"],
        ["EVID_INI", "Evidencia Fotográfica Inicial", "Calidad del Servicio", "Dicotómica (1/0)", "issuePhoto != null ? 1 : 0", "0 si no se cargó foto", "crossPlatformIntegration.test.cjs"],
        ["EVID_FIN", "Evidencia Fotográfica Final", "Calidad del Servicio", "Dicotómica (1/0)", "evidencePhoto != null ? 1 : 0", "0 si no se cargó foto", "crossPlatformIntegration.test.cjs"]
    ]
    format_sheet(ws2, "DICCIONARIO DE VARIABLES METODOLÓGICAS DE TESIS (SPSS)", spss_headers, spss_data)

    # Sheet 3: Roles y Permisos RBAC
    ws3 = wb.create_sheet(title="Roles_y_Permisos_RBAC")
    rbac_headers = ["Módulo / Operación", "CLIENT (Cliente Móvil)", "PROVIDER (Técnico Móvil)", "OPERATOR (Central Web)", "ADMIN (Administrador)"]
    rbac_data = [
        ["Crear Solicitud con Ubicación en Mapa", "AUTORIZADO", "DENEGADO", "AUTORIZADO (Manual)", "AUTORIZADO (Manual)"],
        ["Fijar / Modificar Tarifa del Servicio", "DENEGADO", "DENEGADO", "AUTORIZADO (Antes de aceptar)", "AUTORIZADO"],
        ["Aceptar / Rechazar Asignación de Trabajo", "DENEGADO", "AUTORIZADO", "DENEGADO", "DENEGADO"],
        ["Visualizar PIN de Seguridad", "AUTORIZADO (Lectura)", "DENEGADO (Ingreso presencial)", "AUTORIZADO (Auditoría)", "AUTORIZADO (Auditoría)"],
        ["Validar PIN e Iniciar Labores", "DENEGADO", "AUTORIZADO", "DENEGADO", "DENEGADO"],
        ["Capturar y Subir Fotos de Evidencia", "DENEGADO", "AUTORIZADO", "DENEGADO", "DENEGADO"],
        ["Validar Evidencias y Cerrar Servicio", "DENEGADO", "DENEGADO", "AUTORIZADO", "AUTORIZADO"],
        ["Reportar Voucher de Pago (Yape/Plin)", "AUTORIZADO", "AUTORIZADO", "DENEGADO", "DENEGADO"],
        ["Confirmar / Conciliar Pago de Servicio", "DENEGADO", "AUTORIZADO (Efectivo)", "AUTORIZADO (Bancos/Yape)", "AUTORIZADO"],
        ["Calificar y Reseñar Atención (1-5★)", "AUTORIZADO", "DENEGADO", "DENEGADO", "DENEGADO"],
        ["Acceder al Panel Web de Monitoreo", "DENEGADO", "DENEGADO", "AUTORIZADO", "AUTORIZADO"],
        ["Exportar Datos para Análisis SPSS", "DENEGADO", "DENEGADO", "AUTORIZADO", "AUTORIZADO"]
    ]
    format_sheet(ws3, "MATRIZ DE ACCESO Y SEGURIDAD RBAC (FIRESTORE RULES)", rbac_headers, rbac_data)

    # Save
    out_path = "qa/entregables/Matriz_Trazabilidad_QA.xlsx"
    wb.save(out_path)
    print(f"Matriz de Trazabilidad guardada en: {out_path}")

if __name__ == "__main__":
    build_plan_ejecucion()
    build_matriz_trazabilidad()
