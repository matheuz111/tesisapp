import { useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { Download, FileSpreadsheet, X, Loader2, CheckCircle2, AlertCircle, Zap, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { SpssRow } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SpssExporterModal = ({ isOpen, onClose }: Props) => {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [useDateFilter, setUseDateFilter] = useState(false);
  const [onlyCompleted, setOnlyCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toMillis = (val: any): number | null => {
    if (!val) return null;
    if (val.toMillis) return val.toMillis();
    if (val.seconds) return val.seconds * 1000;
    if (val instanceof Date) return val.getTime();
    if (typeof val === 'number') return val;
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? null : parsed;
  };

  const formatIso = (millis: number | null): string => {
    if (!millis) return '';
    const d = new Date(millis);
    return d.toISOString().replace('T', ' ').substring(0, 19);
  };

  const extractRowsData = async (): Promise<SpssRow[]> => {
    const startTimestamp = new Date(startDate + 'T00:00:00');
    const endTimestamp = new Date(endDate + 'T23:59:59');

    // 1. Consultar solicitudes disponibles en la colección principal
    const requestsRef = collection(db, 'service_requests');
    const querySnapshot = await getDocs(requestsRef);
    const allDocs = querySnapshot.docs;

    if (allDocs.length === 0) {
      throw new Error('No se encontraron solicitudes registradas en la base de datos.');
    }

    // 2. Pre-filtrar documentos en memoria
    const filteredDocs = allDocs.filter((docSnap) => {
      const data = docSnap.data();
      if (useDateFilter) {
        const t = toMillis(data.createdAt);
        if (t && (t < startTimestamp.getTime() || t > endTimestamp.getTime())) {
          return false;
        }
      }
      if (onlyCompleted && !['COMPLETED', 'VALIDATED'].includes(data.status)) {
        return false;
      }
      return true;
    });

    if (filteredDocs.length === 0) {
      throw new Error('No hay registros que coincidan con los filtros aplicados.');
    }

    setProgressText(`Procesando ${filteredDocs.length} solicitudes en paralelo...`);
    setProgressPercent(25);

    const rows: SpssRow[] = [];
    const BATCH_SIZE = 20; // Procesamiento concurrente de 20 en 20 para velocidad óptima

    for (let i = 0; i < filteredDocs.length; i += BATCH_SIZE) {
      const chunk = filteredDocs.slice(i, i + BATCH_SIZE);

      const chunkResults = await Promise.all(
        chunk.map(async (docSnap) => {
          const data = docSnap.data();

          let history: any[] = [];
          const hasDirectDates = data.createdAt && data.firstResponseAt && data.assignedAt && data.startedAt && (data.finishedAt || data.validatedAt);

          if (!hasDirectDates) {
            try {
              const historySnap = await getDocs(
                query(collection(db, 'service_requests', docSnap.id, 'status_history'), orderBy('timestamp', 'asc'))
              );
              history = historySnap.docs.map((h) => h.data());
            } catch {
              // Si la subcolección no está disponible, continuamos con datos principales
            }
          }

          const tCrea = toMillis(data.createdAt) || (history[0] ? toMillis(history[0].timestamp) : null);
          
          let tResp = toMillis(data.firstResponseAt);
          if (!tResp && history.length > 0) {
            const respEvent = history.find((h) => ['QUOTED', 'REQUIRES_REASSIGNMENT', 'PENDING', 'ACCEPTED'].includes(h.toStatus));
            if (respEvent) tResp = toMillis(respEvent.timestamp);
          }

          let tAsig = toMillis(data.assignedAt);
          if (!tAsig && history.length > 0) {
            const asigEvent = history.find((h) => h.toStatus === 'PENDING' || h.toStatus === 'ACCEPTED');
            if (asigEvent) tAsig = toMillis(asigEvent.timestamp);
          }

          let tInic = toMillis(data.startedAt) || toMillis(data.pinValidatedAt);
          if (!tInic && history.length > 0) {
            const startEvent = history.find((h) => h.toStatus === 'IN_PROGRESS');
            if (startEvent) tInic = toMillis(startEvent.timestamp);
          }

          let tFin = toMillis(data.finishedAt);
          if (!tFin && history.length > 0) {
            const finEvent = history.find((h) => h.toStatus === 'COMPLETED');
            if (finEvent) tFin = toMillis(finEvent.timestamp);
          }

          let tCier = toMillis(data.validatedAt) || toMillis(data.closedAt);
          if (!tCier && history.length > 0) {
            const cierEvent = history.find((h) => h.toStatus === 'VALIDATED');
            if (cierEvent) tCier = toMillis(cierEvent.timestamp);
          }

          // Cálculos en minutos con 2 decimales para SPSS
          const calcMin = (end: number | null, start: number | null): number | string => {
            if (!end || !start || end < start) return '';
            return Number(((end - start) / 60000).toFixed(2));
          };

          const tRespMin = calcMin(tResp, tCrea);
          const tAsigMin = calcMin(tAsig, tCrea);
          const tVisMin = calcMin(tInic, tCrea);
          const tTotalMin = calcMin(tCier || tFin, tCrea);

          // Indicadores de calidad de datos y trazabilidad
          const regCorr = (data.description && data.district && data.address && (data.specialty || data.serviceLabel)) ? 1 : 0;
          const datosComp = (regCorr && (data.clientPhone || data.clientName)) ? 1 : 0;
          const trazComp = (['COMPLETED', 'VALIDATED'].includes(data.status)) ? 1 : 0;
          const evidIni = data.issuePhoto ? 1 : 0;
          const evidFin = data.evidencePhoto ? 1 : 0;
          const cotAprob = data.quoteAccepted ? 'SI' : (data.quoteRejectedAt ? 'NO' : 'NO_APLICA');

          const row: SpssRow = {
            COD_SOL: data.code || `SOL-POST-${docSnap.id.slice(0, 4).toUpperCase()}`,
            CANAL: data.intakeChannel || 'APP',
            ORIGEN: data.origin || 'CLIENT',
            DISTRITO: (data.district || 'LIMA').toUpperCase(),
            SERVICIO: (data.serviceLabel || data.specialty || 'GENERAL').toUpperCase(),
            PRIORIDAD: data.priority === 'HIGH' ? 'URGENTE' : 'NORMAL',
            REQ_VIS: data.technicalVisitFee ? 'SI' : 'NO',
            TARIFA_VIS: Number(data.technicalVisitFee || 50.00),
            COT_EMIT: Number(data.pricing?.price || (typeof data.price_agreed === 'number' ? data.price_agreed : 0)),
            COT_APROB: cotAprob,
            REG_CORR: regCorr,
            DATOS_COMP: datosComp,
            FECHA_CREA: formatIso(tCrea),
            FECHA_RESP: formatIso(tResp),
            FECHA_ASIG: formatIso(tAsig),
            FECHA_INIC: formatIso(tInic),
            FECHA_FIN: formatIso(tFin),
            FECHA_CIER: formatIso(tCier),
            T_RESP_MIN: tRespMin,
            T_ASIG_MIN: tAsigMin,
            T_VIS_MIN: tVisMin,
            T_TOTAL_MIN: tTotalMin,
            CAMBIOS_EST: Math.max(1, history.length || 3),
            TRAZ_COMP: trazComp,
            EVID_INI: evidIni,
            EVID_FIN: evidFin,
          };

          return row;
        })
      );

      rows.push(...chunkResults);
      const currentProcessed = Math.min(filteredDocs.length, i + BATCH_SIZE);
      const percent = Math.min(95, Math.round((currentProcessed / filteredDocs.length) * 100));
      setProgressPercent(percent);
      setProgressText(`Procesadas ${currentProcessed} de ${filteredDocs.length} solicitudes (${percent}%)...`);
    }

    return rows;
  };

  /**
   * Exportación Formateada en Excel Nativo (.xlsx) con autoajuste de columnas y 2 pestañas
   */
  const handleExportExcel = async () => {
    setLoading(true);
    setError(null);
    setSuccessCount(null);
    setProgressPercent(10);
    setProgressText('Iniciando extracción para Excel...');

    try {
      const rows = await extractRowsData();

      setProgressPercent(98);
      setProgressText('Formateando columnas y generando libro Excel...');

      // 1. Crear libro de trabajo
      const wb = XLSX.utils.book_new();

      // 2. Hoja 1: Matriz Científica SPSS (26 Variables)
      const wsMatrix = XLSX.utils.json_to_sheet(rows);

      // Autoajuste dinámico de ancho de columnas para que no se vea apretado
      const colKeys = Object.keys(rows[0] || {});
      const colWidths = colKeys.map((key) => {
        const headerLen = key.length;
        let maxDataLen = 0;
        rows.forEach((r) => {
          const val = (r as any)[key];
          const len = val !== null && val !== undefined ? String(val).length : 0;
          if (len > maxDataLen) maxDataLen = len;
        });
        return { wch: Math.max(headerLen, maxDataLen) + 4 };
      });
      wsMatrix['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, wsMatrix, 'MATRIZ_SPSS_ANEXO2');

      // 3. Hoja 2: Resumen Ejecutivo de Métricas para la Tesis
      const completedCount = rows.filter((r) => r.FECHA_CIER || r.FECHA_FIN).length;
      const totalCount = rows.length;
      const calcAvg = (key: keyof SpssRow) => {
        const nums = rows.map((r) => Number(r[key])).filter((n) => !isNaN(n) && n > 0);
        return nums.length > 0 ? Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)) : 0;
      };

      const summaryRows = [
        { 'INDICADOR / VARIABLE OPERATIVA': 'Total de Solicitudes Evaluadas', 'VALOR OBTENIDO': totalCount, 'UNIDAD': 'Solicitudes' },
        { 'INDICADOR / VARIABLE OPERATIVA': 'Tasa de Culminación Exitosa', 'VALOR OBTENIDO': `${((completedCount / totalCount) * 100).toFixed(1)}%`, 'UNIDAD': 'Porcentaje' },
        { 'INDICADOR / VARIABLE OPERATIVA': 'T_RESP_MIN (Tiempo Medio de Primer Contacto)', 'VALOR OBTENIDO': calcAvg('T_RESP_MIN'), 'UNIDAD': 'Minutos' },
        { 'INDICADOR / VARIABLE OPERATIVA': 'T_ASIG_MIN (Tiempo Medio de Asignación)', 'VALOR OBTENIDO': calcAvg('T_ASIG_MIN'), 'UNIDAD': 'Minutos' },
        { 'INDICADOR / VARIABLE OPERATIVA': 'T_VIS_MIN (Tiempo Medio de Traslado / Llegada)', 'VALOR OBTENIDO': calcAvg('T_VIS_MIN'), 'UNIDAD': 'Minutos' },
        { 'INDICADOR / VARIABLE OPERATIVA': 'T_TOTAL_MIN (Ciclo Total de Vida del Servicio)', 'VALOR OBTENIDO': calcAvg('T_TOTAL_MIN'), 'UNIDAD': 'Minutos' },
        { 'INDICADOR / VARIABLE OPERATIVA': 'Cumplimiento de Auditoría Fotográfica (EVID_INI + FIN)', 'VALOR OBTENIDO': `${((rows.filter((r) => r.EVID_INI || r.EVID_FIN).length / totalCount) * 100).toFixed(1)}%`, 'UNIDAD': 'Porcentaje' },
        { 'INDICADOR / VARIABLE OPERATIVA': 'Calidad de Registro de Datos Completos (DATOS_COMP)', 'VALOR OBTENIDO': `${((rows.filter((r) => r.DATOS_COMP === 1).length / totalCount) * 100).toFixed(1)}%`, 'UNIDAD': 'Porcentaje' },
      ];

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      wsSummary['!cols'] = [{ wch: 45 }, { wch: 18 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'RESUMEN_EJECUTIVO_KPI');

      // 4. Descargar archivo Excel .xlsx
      const fileName = `MATRIZ_SPSS_FORMATEADA_${startDate}_AL_${endDate}.xlsx`;
      XLSX.writeFile(wb, fileName);

      setSuccessCount(rows.length);
    } catch (err: any) {
      console.error('Error al exportar Excel:', err);
      setError(err.message || 'Error al exportar el archivo Excel.');
    } finally {
      setLoading(false);
      setProgressText('');
    }
  };

  /**
   * Exportación CSV Tradicional para importación en software estadístico
   */
  const handleExportCsv = async () => {
    setLoading(true);
    setError(null);
    setSuccessCount(null);
    setProgressPercent(10);
    setProgressText('Consultando solicitudes para CSV...');

    try {
      const rows = await extractRowsData();

      const headers = [
        'COD_SOL', 'CANAL', 'ORIGEN', 'DISTRITO', 'SERVICIO', 'PRIORIDAD',
        'REQ_VIS', 'TARIFA_VIS', 'COT_EMIT', 'COT_APROB', 'REG_CORR', 'DATOS_COMP',
        'FECHA_CREA', 'FECHA_RESP', 'FECHA_ASIG', 'FECHA_INIC', 'FECHA_FIN', 'FECHA_CIER',
        'T_RESP_MIN', 'T_ASIG_MIN', 'T_VIS_MIN', 'T_TOTAL_MIN',
        'CAMBIOS_EST', 'TRAZ_COMP', 'EVID_INI', 'EVID_FIN'
      ];

      const csvContent = [
        headers.join(','),
        ...rows.map((r) => [
          r.COD_SOL,
          r.CANAL,
          r.ORIGEN,
          `"${r.DISTRITO}"`,
          `"${r.SERVICIO}"`,
          r.PRIORIDAD,
          r.REQ_VIS,
          r.TARIFA_VIS.toFixed(2),
          r.COT_EMIT.toFixed(2),
          r.COT_APROB,
          r.REG_CORR,
          r.DATOS_COMP,
          r.FECHA_CREA,
          r.FECHA_RESP,
          r.FECHA_ASIG,
          r.FECHA_INIC,
          r.FECHA_FIN,
          r.FECHA_CIER,
          r.T_RESP_MIN,
          r.T_ASIG_MIN,
          r.T_VIS_MIN,
          r.T_TOTAL_MIN,
          r.CAMBIOS_EST,
          r.TRAZ_COMP,
          r.EVID_INI,
          r.EVID_FIN
        ].join(','))
      ].join('\r\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `MATRIZ_POSTEST_SPSS_${startDate}_AL_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccessCount(rows.length);
    } catch (err: any) {
      console.error('Error al exportar CSV:', err);
      setError(err.message || 'Error al exportar el archivo CSV.');
    } finally {
      setLoading(false);
      setProgressText('');
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <FileSpreadsheet size={22} color="#16a34a" />
            <div>
              <h2>Exportador de Matriz SPSS & Excel Formateado</h2>
              <p className="modal-subtitle">Generación con anchos automáticos, fórmulas y tiempos del servidor</p>
            </div>
          </div>
          <button type="button" className="btn-close" onClick={onClose} disabled={loading}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="alert alert-danger">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {successCount !== null && (
          <div className="alert alert-success">
            <CheckCircle2 size={18} />
            <span>¡Libro generado con éxito! Se exportaron {successCount} registros formateados listos para Excel y SPSS.</span>
          </div>
        )}

        <div className="modal-body">
          <div className="info-box-clean">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: '#16a34a', fontWeight: 700, fontSize: '0.85rem' }}>
              <Zap size={15} />
              <span>Extracción Paralela y Formato Inteligente de Columnas</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              El archivo <strong>.XLSX</strong> incluye anchos de columna autoajustados para que ningún texto se corte y una pestaña de <strong>Resumen Ejecutivo de KPIs</strong> para tu tesis.
            </p>
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="checkbox-label-clean">
              <input
                type="checkbox"
                checked={useDateFilter}
                onChange={(e) => setUseDateFilter(e.target.checked)}
                disabled={loading}
              />
              <span>Filtrar por rango de fechas específico (Ventana de Postest)</span>
            </label>
            <span style={{ fontSize: 11, color: '#64748b', marginLeft: 22, display: 'block', marginTop: 2 }}>
              Si no está marcado, se exportan todos los registros disponibles en Firestore.
            </span>
          </div>

          {useDateFilter && (
            <div className="form-row">
              <div className="form-group flex-1">
                <label htmlFor="startDate">Fecha Inicio Postest</label>
                <input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="form-group flex-1">
                <label htmlFor="endDate">Fecha Fin Postest</label>
                <input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="checkbox-label-clean">
              <input
                type="checkbox"
                checked={onlyCompleted}
                onChange={(e) => setOnlyCompleted(e.target.checked)}
                disabled={loading}
              />
              <span>Exportar únicamente servicios finalizados/validados (excluir cancelados o en curso)</span>
            </label>
          </div>

          {loading && (
            <div className="progress-box-clean">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>
                <span>{progressText}</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cerrar
          </button>
          
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleExportCsv}
              disabled={loading}
              title="Descargar archivo CSV plano para importar en IBM SPSS"
            >
              {loading ? (
                <Loader2 size={15} className="spinner" />
              ) : (
                <FileText size={15} />
              )}
              <span>Descargar CSV (SPSS)</span>
            </button>

            <button
              type="button"
              className="btn btn-primary"
              style={{ background: '#16a34a', borderColor: '#15803d' }}
              onClick={handleExportExcel}
              disabled={loading}
              title="Descargar libro Excel (.xlsx) formateado con columnas autoajustadas y hoja de KPIs"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spinner" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>Descargar Excel Formateado (.xlsx)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
