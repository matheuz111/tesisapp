import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from 'recharts';
import type { ServiceRequest } from '../types';
import { BarChart3, PieChart as PieIcon, Activity, Layers, CheckCircle, Zap, Clock, ShieldCheck } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface Props {
  requests: ServiceRequest[];
}

const PALETTE = ['#0284c7', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

const STATUS_COLORS: Record<string, string> = {
  'Por Asignar': '#f59e0b',
  'En Curso': '#6366f1',
  'Culminado': '#10b981',
  'Cancelado': '#ef4444',
};

export const AnalyticsCharts = ({ requests }: Props) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const gridColor = isDark ? '#233055' : '#e2e8f0';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const tooltipBg = isDark ? '#131d38' : '#ffffff';
  const tooltipBorder = isDark ? '#233055' : '#cbd5e1';

  // 1. Datos por Estado
  const statusData = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let cancelled = 0;

    requests.forEach((r) => {
      if (['PENDING_ASSIGNMENT', 'QUOTED', 'REQUIRES_REASSIGNMENT'].includes(r.status)) pending++;
      else if (['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(r.status)) inProgress++;
      else if (['COMPLETED', 'VALIDATED'].includes(r.status)) completed++;
      else if (r.status.startsWith('CANCELLED')) cancelled++;
    });

    return [
      { name: 'Por Asignar', cantidad: pending, color: STATUS_COLORS['Por Asignar'] },
      { name: 'En Curso', cantidad: inProgress, color: STATUS_COLORS['En Curso'] },
      { name: 'Culminado', cantidad: completed, color: STATUS_COLORS['Culminado'] },
      { name: 'Cancelado', cantidad: cancelled, color: STATUS_COLORS['Cancelado'] },
    ];
  }, [requests]);

  // 2. Datos por Canal de Ingreso
  const channelData = useMemo(() => {
    const counts: Record<string, number> = {
      'App Móvil': 0,
      'WhatsApp': 0,
      'Llamada': 0,
      'Correo': 0,
    };

    requests.forEach((r) => {
      const ch = r.intakeChannel;
      if (ch === 'WHATSAPP') counts['WhatsApp']++;
      else if (ch === 'PHONE') counts['Llamada']++;
      else if (ch === 'EMAIL') counts['Correo']++;
      else counts['App Móvil']++;
    });

    return Object.entries(counts)
      .map(([name, valor]) => ({ name, valor }))
      .filter((item) => item.valor > 0);
  }, [requests]);

  // 3. Datos por Especialidad
  const specialtyData = useMemo(() => {
    const counts: Record<string, number> = {};

    requests.forEach((r) => {
      const spec = r.serviceLabel || r.specialty || 'Otros';
      counts[spec] = (counts[spec] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, cantidad]) => ({ name, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 6);
  }, [requests]);

  // 4. Desglose de 5 Fases Operativas en Minutos (Métricas SPSS)
  const avgTimesData = useMemo(() => {
    let rspSum = 0, rspCount = 0;
    let asgSum = 0, asgCount = 0;
    let lleSum = 0, lleCount = 0;
    let ejeSum = 0, ejeCount = 0;
    let valSum = 0, valCount = 0;
    let totSum = 0, totCount = 0;

    const toMillis = (val: any) => {
      if (!val) return null;
      if (val.toMillis) return val.toMillis();
      if (val.seconds) return val.seconds * 1000;
      const d = new Date(val).getTime();
      return isNaN(d) ? null : d;
    };

    requests.forEach((r) => {
      const tCrea = toMillis(r.createdAt);
      if (!tCrea) return;

      const tResp = toMillis(r.firstResponseAt);
      if (tResp && tResp >= tCrea) {
        rspSum += (tResp - tCrea) / 60000;
        rspCount++;
      }

      const tAsig = toMillis(r.assignedAt);
      if (tAsig && tAsig >= (tResp || tCrea)) {
        asgSum += (tAsig - (tResp || tCrea)) / 60000;
        asgCount++;
      }

      const tInic = toMillis(r.startedAt);
      if (tInic && tInic >= (tAsig || tCrea)) {
        lleSum += (tInic - (tAsig || tCrea)) / 60000;
        lleCount++;
      }

      const tFin = toMillis(r.finishedAt);
      if (tFin && tFin >= (tInic || tCrea)) {
        ejeSum += (tFin - (tInic || tCrea)) / 60000;
        ejeCount++;
      }

      const tVal = toMillis(r.validatedAt);
      if (tVal && tVal >= (tFin || tCrea)) {
        valSum += (tVal - (tFin || tCrea)) / 60000;
        valCount++;
      }

      const tCier = tVal || tFin;
      if (tCier && tCier >= tCrea) {
        totSum += (tCier - tCrea) / 60000;
        totCount++;
      }
    });

    return [
      { metrica: '1. Respuesta (T_RSP)', minutos: rspCount ? Number((rspSum / rspCount).toFixed(1)) : 0, color: '#0284c7' },
      { metrica: '2. Asignación (T_ASG)', minutos: asgCount ? Number((asgSum / asgCount).toFixed(1)) : 0, color: '#6366f1' },
      { metrica: '3. En Ruta / PIN (T_LLE)', minutos: lleCount ? Number((lleSum / lleCount).toFixed(1)) : 0, color: '#f59e0b' },
      { metrica: '4. Ejecución (T_EJE)', minutos: ejeCount ? Number((ejeSum / ejeCount).toFixed(1)) : 0, color: '#10b981' },
      { metrica: '5. Cierre (T_VAL)', minutos: valCount ? Number((valSum / valCount).toFixed(1)) : 0, color: '#8b5cf6' },
      { metrica: 'Total Ciclo (T_TOT)', minutos: totCount ? Number((totSum / totCount).toFixed(1)) : 0, color: '#ec4899' },
    ];
  }, [requests]);

  // 5. Métricas de Resumen Ejecutivo (KPI Pills)
  const summaryKPIs = useMemo(() => {
    const total = requests.length;
    if (total === 0) return null;

    const completed = requests.filter((r) => ['COMPLETED', 'VALIDATED'].includes(r.status)).length;
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(0) : '0';

    const photoEvidences = requests.filter((r) => r.issuePhoto || r.evidencePhoto || (r as any).evidence_photo).length;
    const auditRate = total > 0 ? ((photoEvidences / total) * 100).toFixed(0) : '0';

    const topChannel = channelData.length > 0
      ? channelData.reduce((prev, curr) => (curr.valor > prev.valor ? curr : prev), channelData[0])
      : { name: 'App Móvil', valor: 0 };

    return {
      completionRate: `${completionRate}%`,
      auditRate: `${auditRate}%`,
      topChannelName: topChannel.name,
      topChannelShare: total > 0 ? `${((topChannel.valor / total) * 100).toFixed(0)}%` : '0%',
      totalCount: total,
    };
  }, [requests, channelData]);

  if (requests.length === 0) return null;

  return (
    <div className="analytics-section">
      {/* Píldoras de Resumen Analítico */}
      {summaryKPIs && (
        <div className="analytics-summary-pills">
          <div className="summary-pill">
            <div className="pill-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
              <CheckCircle size={18} />
            </div>
            <div className="pill-info">
              <span className="pill-label">Tasa de Culminación</span>
              <span className="pill-value">{summaryKPIs.completionRate}</span>
            </div>
          </div>

          <div className="summary-pill">
            <div className="pill-icon" style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7' }}>
              <Zap size={18} />
            </div>
            <div className="pill-info">
              <span className="pill-label">Canal Principal</span>
              <span className="pill-value">{summaryKPIs.topChannelName} ({summaryKPIs.topChannelShare})</span>
            </div>
          </div>

          <div className="summary-pill">
            <div className="pill-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}>
              <ShieldCheck size={18} />
            </div>
            <div className="pill-info">
              <span className="pill-label">Auditoría con Evidencias</span>
              <span className="pill-value">{summaryKPIs.auditRate} con fotos</span>
            </div>
          </div>

          <div className="summary-pill">
            <div className="pill-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
              <Clock size={18} />
            </div>
            <div className="pill-info">
              <span className="pill-label">Tiempo Total Promedio</span>
              <span className="pill-value">{avgTimesData[5]?.minutos || 0} min</span>
            </div>
          </div>
        </div>
      )}

      <div className="analytics-grid">
        {/* Gráfico 1: Estado del Flujo */}
        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-header-title">
              <Layers size={18} color="#0284c7" />
              <h3>Distribución por Estado Operativo</h3>
            </div>
            <span className="chart-badge">Flujo en Vivo</span>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={statusData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: textColor }} stroke={gridColor} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: textColor }} stroke={gridColor} />
                <Tooltip
                  formatter={(val: any) => [`${val} solicitudes`, 'Total']}
                  contentStyle={{
                    borderRadius: 10,
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    color: isDark ? '#f8fafc' : '#0f172a',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                />
                <Bar dataKey="cantidad" radius={[6, 6, 0, 0]}>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Multicanalidad */}
        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-header-title">
              <PieIcon size={18} color="#10b981" />
              <h3>Canales de Ingreso (Multicanal)</h3>
            </div>
            <span className="chart-badge">Origen</span>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={channelData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="valor"
                  label={({ name, percent }: any) => (percent > 0 ? `${name} (${(percent * 100).toFixed(0)}%)` : '')}
                  labelLine={false}
                >
                  {channelData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`${val} pedidos`, 'Volumen']}
                  contentStyle={{
                    borderRadius: 10,
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    color: isDark ? '#f8fafc' : '#0f172a',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: textColor }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 3: Especialidades Más Solicitadas */}
        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-header-title">
              <BarChart3 size={18} color="#8b5cf6" />
              <h3>Demanda por Especialidad Técnica</h3>
            </div>
            <span className="chart-badge">Top Rubros</span>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={specialtyData} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: textColor }} stroke={gridColor} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: textColor }} width={90} stroke={gridColor} />
                <Tooltip
                  formatter={(val: any) => [`${val} atenciones`, 'Servicios']}
                  contentStyle={{
                    borderRadius: 10,
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    color: isDark ? '#f8fafc' : '#0f172a',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                />
                <Bar dataKey="cantidad" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 4: Tiempos Medios de Gestión (Fases SPSS) */}
        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-header-title">
              <Activity size={18} color="#ec4899" />
              <h3>Tiempos Medios de Gestión por Etapa (Minutos)</h3>
            </div>
            <span className="chart-badge">SPSS Deltas</span>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={avgTimesData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="metrica" tick={{ fontSize: 9.5, fill: textColor }} stroke={gridColor} />
                <YAxis tick={{ fontSize: 11, fill: textColor }} stroke={gridColor} />
                <Tooltip
                  formatter={(val: any) => [`${val} minutos`, 'Promedio']}
                  contentStyle={{
                    borderRadius: 10,
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    color: isDark ? '#f8fafc' : '#0f172a',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                />
                <Bar dataKey="minutos" radius={[6, 6, 0, 0]}>
                  {avgTimesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
