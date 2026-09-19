import { useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { Download, FileSpreadsheet, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
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

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    setSuccessCount(null);
    setProgressText('Consultando solicitudes en Firestore...');

    try {
      const startTimestamp = new Date(startDate + 'T00:00:00');
      const endTimestamp = new Date(endDate + 'T23:59:59');

      // Consultar solicitudes disponibles
      const requestsRef = collection(db, 'service_requests');
      const querySnapshot = await getDocs(requestsRef);
      const docs = querySnapshot.docs;

      if (docs.length === 0) {
        throw new Error('No se encontraron solicitudes registradas en la base de datos.');
      }

      setProgressText(`Procesando ${docs.length} solicitudes y extrayendo historial...`);

      const rows: SpssRow[] = [];
      let processed = 0;

      for (const docSnap of docs) {
        const data = docSnap.data();

        // Filtro opcional por rango de fechas
        if (useDateFilter) {
          const t = toMillis(data.createdAt);
          if (t && (t < startTimestamp.getTime() || t > endTimestamp.getTime())) {
            continue;
          }
        }

        // Si se filtró solo por completadas y no lo está, saltar
        if (onlyCompleted && !['COMPLETED', 'VALIDATED'].includes(data.status)) {
          continue;
        }

        // Consultar la subcolección status_history de forma segura con try/catch
        let history: any[] = [];
        try {
          const historySnap = await getDocs(
            query(collection(db, 'service_requests', docSnap.id, 'status_history'), orderBy('timestamp', 'asc'))
          );
          history = historySnap.docs.map((h) => h.data());
        } catch (subErr) {
          console.warn('Lectura de status_history omitida o no permitida para', docSnap.id, subErr);
        }

        // Extraer y normalizar marcas de tiempo con respaldo en el historial
        const tCrea = toMillis(data.createdAt) || (history[0] ? toMillis(history[0].timestamp) : null);
        
        let tResp = toMillis(data.firstResponseAt);
        if (!tResp) {
          const respEvent = history.find((h) => ['QUOTED', 'REQUIRES_REASSIGNMENT', 'PENDING'].includes(h.toStatus));
          if (respEvent) tResp = toMillis(respEvent.timestamp);
        }

        let tAsig = toMillis(data.assignedAt);
        if (!tAsig) {
          const asigEvent = history.find((h) => h.toStatus === 'PENDING' || h.toStatus === 'ACCEPTED');
          if (asigEvent) tAsig = toMillis(asigEvent.timestamp);
        }

        let tInic = toMillis(data.startedAt) || toMillis(data.pinValidatedAt);
        if (!tInic) {
          const startEvent = history.find((h) => h.toStatus === 'IN_PROGRESS');
          if (startEvent) tInic = toMillis(startEvent.timestamp);
        }

        let tFin = toMillis(data.finishedAt);
        if (!tFin) {
          const finEvent = history.find((h) => h.toStatus === 'COMPLETED');
          if (finEvent) tFin = toMillis(finEvent.timestamp);
        }

        let tCier = toMillis(data.validatedAt) || toMillis(data.closedAt);
        if (!tCier) {
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
        const trazComp = (['COMPLETED', 'VALIDATED'].includes(data.status) && history.length >= 3) ? 1 : 0;
        const evidIni = data.issuePhoto ? 1 : 0;
        const evidFin = data.evidencePhoto ? 1 : 0;
        const cotAprob = data.quoteAccepted ? 'SI' : (data.quoteRejectedAt ? 'NO' : 'NO_APLICA');

        rows.push({
          COD_SOL: data.code || `SOL-POST-${String(rows.length + 1).padStart(4, '0')}`,
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
          CAMBIOS_EST: Math.max(1, history.length),
          TRAZ_COMP: trazComp,
          EVID_INI: evidIni,
          EVID_FIN: evidFin,
        });

        processed++;
        if (processed % 10 === 0) {
          setProgressText(`Procesadas ${processed} de ${docs.length} solicitudes...`);
        }
      }

      if (rows.length === 0) {
        throw new Error('No hay registros que coincidan con los filtros aplicados.');
      }

      // 4. Generar el contenido CSV con las 26 columnas exactas del Anexo 2
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

      // 5. Descargar con BOM UTF-8 (\uFEFF) para compatibilidad con Excel y SPSS
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
      console.error('Error al exportar SPSS:', err);
      setError(err.message || 'Error al exportar la matriz SPSS.');
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
            <FileSpreadsheet size={24} color="#0284c7" />
            <div>
              <h2>Exportador Matriz SPSS (Anexo 2)</h2>
              <p className="modal-subtitle">Generación de las 26 columnas científicas con tiempos NTP</p>
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
            <span>¡Matriz generada con éxito! Se exportaron {successCount} registros listos para SPSS.</span>
          </div>
        )}

        <div className="modal-body">
          <div className="info-box">
            <p>
              Este módulo extrae automáticamente las solicitudes de Firestore y audita la subcolección 
              <strong> status_history</strong> para calcular los indicadores:
            </p>
            <ul style={{ margin: '6px 0 0 16px', fontSize: 13 }}>
              <li><strong>T_RESP_MIN, T_ASIG_MIN, T_VIS_MIN, T_TOTAL_MIN</strong> en minutos sincronizados por servidor.</li>
              <li><strong>CAMBIOS_EST y TRAZ_COMP</strong> a partir del ciclo real de transiciones.</li>
              <li><strong>REG_CORR, DATOS_COMP, EVID_INI y EVID_FIN</strong> para validación de hipótesis.</li>
            </ul>
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="checkbox-label" style={{ fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={useDateFilter}
                onChange={(e) => setUseDateFilter(e.target.checked)}
                disabled={loading}
              />
              <span>Filtrar por rango de fechas específico (Ventana de Postest)</span>
            </label>
            <span style={{ fontSize: 11, color: '#64748b', marginLeft: 24 }}>
              Si no está marcado, se exportarán todos los registros disponibles en la base de datos.
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
            <label className="checkbox-label">
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
            <div className="progress-banner">
              <Loader2 size={18} className="spinner" />
              <span>{progressText}</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cerrar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExport}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="spinner" />
                <span>Generando matriz...</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>Descargar Archivo CSV para SPSS</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
