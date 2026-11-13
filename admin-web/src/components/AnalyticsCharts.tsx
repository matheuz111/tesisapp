import { useMemo, useState, useEffect, memo } from 'react';
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
import { Activity, Layers, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface Props {
  requests: ServiceRequest[];
}

// Paleta de tokens WCAG 2.1 AA (Sin gradientes, sin opacidades ilegibles)
const MINIMAL_PALETTE = ['#0369a1', '#166534', '#d97706', '#475569', '#7c3aed', '#0891b2'];

const STATUS_COLORS: Record<string, string> = {
  'Por Asignar': '#d97706',
  'En Curso': '#0369a1',
  'Culminado': '#166534',
  'Cancelado': '#dc2626',
  'Otros': '#64748b',
};

// Catálogo canónico de especialidades para sanear datos atípicos (Resolves Bug c)
const CANONICAL_SPECIALTY_MAP: Record<string, string> = {
  gasfitero: 'Gasfitería',
  gasfiteria: 'Gasfitería',
  electricista: 'Electricidad',
  electricidad: 'Electricidad',
  pintor: 'Pintura',
  pintura: 'Pintura',
  carpintero: 'Carpintería',
  carpinteria: 'Carpintería',
  albanil: 'Albañilería',
  albanileria: 'Albañilería',
  cerrajero: 'Cerrajería',
  cerrajeria: 'Cerrajería',
  tecnico: 'Línea Blanca / TV',
  'linea blanca': 'Línea Blanca / TV',
  'linea blanca / tv': 'Línea Blanca / TV',
  otro: 'Otro Servicio',
  otros: 'Otro Servicio',
};

export const AnalyticsChartsComponent = ({ requests }: Props) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const gridColor = isDark ? '#1e293b' : '#f1f5f9';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const tooltipBg = isDark ? '#0f172a' : '#ffffff';
  const tooltipBorder = isDark ? '#334155' : '#e2e8f0';

  // Desactivar animaciones cuando prefers-reduced-motion está activo
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const [shouldAnimate, setShouldAnimate] = useState(() => !prefersReducedMotion);

  useEffect(() => {
    if (!prefersReducedMotion) {
      const timer = setTimeout(() => {
        setShouldAnimate(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [prefersReducedMotion]);

  // 1. Datos por Estado Operativo (Exhaustivo: Suma el 100% de requests, Resolves Bug b)
  const statusData = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let cancelled = 0;
    let others = 0;

    requests.forEach((r) => {
      const s = (r.status || '').toUpperCase();
      if (['PENDING_ASSIGNMENT', 'QUOTED', 'REQUIRES_REASSIGNMENT'].includes(s)) {
        pending++;
      } else if (['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(s)) {
        inProgress++;
      } else if (['COMPLETED', 'VALIDATED', 'ARCHIVED', 'CLOSED'].includes(s)) {
        completed++;
      } else if (s.startsWith('CANCELLED')) {
        cancelled++;
      } else {
        others++;
      }
    });

    const list = [
      { name: 'Por Asignar', cantidad: pending, color: STATUS_COLORS['Por Asignar'] },
      { name: 'En Curso', cantidad: inProgress, color: STATUS_COLORS['En Curso'] },
      { name: 'Culminado', cantidad: completed, color: STATUS_COLORS['Culminado'] },
      { name: 'Cancelado', cantidad: cancelled, color: STATUS_COLORS['Cancelado'] },
    ];

    if (others > 0) {
      list.push({ name: 'Otros', cantidad: others, color: STATUS_COLORS['Otros'] });
    }

    return list;
  }, [requests]);

  // 2. Datos por Canal de Ingreso (Donut centrado)
  const channelData = useMemo(() => {
    const counts: Record<string, number> = {
      'App Móvil': 0,
      'WhatsApp': 0,
      'Llamada': 0,
      'Portal Web': 0,
      'Correo': 0,
    };

    requests.forEach((r) => {
      const ch = r.intakeChannel;
      if (ch === 'WHATSAPP') counts['WhatsApp']++;
      else if (ch === 'PHONE') counts['Llamada']++;
      else if (ch === 'WEB') counts['Portal Web']++;
      else if (ch === 'EMAIL') counts['Correo']++;
      else counts['App Móvil']++;
    });

    return Object.entries(counts)
      .map(([name, valor]) => ({ name, valor }))
      .filter((item) => item.valor > 0);
  }, [requests]);

  // 3. Datos por Especialidad con Normalización contra Catálogo (Resolves Bug c)
  const specialtyData = useMemo(() => {
    const counts: Record<string, number> = {};

    requests.forEach((r) => {
      const raw = (r.serviceLabel || r.specialty || 'Otro Servicio').trim();
      const rawNormalized = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      // Mapear al catálogo canónico; si es texto anómalo (ej: 'Doxeador'), agrupar bajo 'Otro Servicio'
      const canonicalName = CANONICAL_SPECIALTY_MAP[rawNormalized] || (raw.length > 20 ? 'Otro Servicio' : raw);
      counts[canonicalName] = (counts[canonicalName] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, cantidad]) => ({ name, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);
  }, [requests]);

  // 4. Desglose de Diagnóstico de Cancelaciones (Resolves Bug d)
  const cancellationData = useMemo(() => {
    const reasonCounts: Record<string, number> = {};
    let totalCancelled = 0;

    requests.forEach((r) => {
      if ((r.status || '').startsWith('CANCELLED')) {
        totalCancelled++;
        const reason = (
          r.cancelReason ||
          r.rejectionReason ||
          r.rejectionReasonText ||
          r.quoteRejectionReason ||
          r.providerRejectionReason ||
          'Sin motivo reportado'
        ).trim();
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      }
    });

    if (totalCancelled === 0) return null;

    const list = Object.entries(reasonCounts)
      .map(([motivo, cantidad]) => ({
        motivo: motivo.length > 28 ? `${motivo.slice(0, 26)}...` : motivo,
        motivoCompleto: motivo,
        cantidad,
        porcentaje: Number(((cantidad / totalCancelled) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);

    return { totalCancelled, list };
  }, [requests]);

  // 5. Desglose de Fases Operativas en Minutos (Métricas SPSS)
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
      { metrica: '1. Respuesta de la central', minutos: rspCount ? Number((rspSum / rspCount).toFixed(1)) : 0, color: '#0369a1' },
      { metrica: '2. Asignación de técnico', minutos: asgCount ? Number((asgSum / asgCount).toFixed(1)) : 0, color: '#0284c7' },
      { metrica: '3. Traslado al domicilio', minutos: lleCount ? Number((lleSum / lleCount).toFixed(1)) : 0, color: '#d97706' },
      { metrica: '4. Trabajo en el domicilio', minutos: ejeCount ? Number((ejeSum / ejeCount).toFixed(1)) : 0, color: '#166534' },
      { metrica: '5. Validación del cierre', minutos: valCount ? Number((valSum / valCount).toFixed(1)) : 0, color: '#475569' },
      { metrica: 'Tiempo total', minutos: totCount ? Number((totSum / totCount).toFixed(1)) : 0, color: '#0f172a' },
    ];
  }, [requests]);

  if (requests.length === 0) {
    return (
      <div className="sidepanel-card" style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)' }}>
        No hay datos de servicios disponibles para generar analíticas.
      </div>
    );
  }

  const totalEvaluated = statusData.reduce((acc, curr) => acc + curr.cantidad, 0);

  return (
    <div className="analytics-section" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Grilla 2x2 de analítica */}
      <div className="analytics-grid-2x2">
        {/* Gráfico 1: Estado del Flujo (Totalmente consolidado) */}
        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-header-title">
              <Layers size={16} color="var(--primary)" />
              <h3 style={{ fontSize: 13, fontWeight: 700 }}>Flujo de Estados Operativos</h3>
            </div>
            <span className="chart-badge mono-tabular">Total N = {totalEvaluated}</span>
          </div>

          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={statusData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="name" stroke={textColor} fontSize={11} tickLine={false} />
                <YAxis stroke={textColor} fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    borderRadius: '6px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    color: isDark ? '#f8fafc' : '#0f172a',
                  }}
                  formatter={(value: any) => [`${value} servicios (${((Number(value) / totalEvaluated) * 100).toFixed(1)}%)`, 'Cantidad']}
                />
                <Bar
                  dataKey="cantidad"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                  isAnimationActive={shouldAnimate}
                  animationDuration={shouldAnimate ? 300 : 0}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`status-cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Tiempos de Gestión SPSS */}
        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-header-title">
              <Clock size={16} color="var(--primary)" />
              <h3 style={{ fontSize: 13, fontWeight: 700 }}>Tiempos Medios de Gestión por Etapa</h3>
            </div>
            <span className="chart-badge">Minutos SPSS</span>
          </div>

          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={avgTimesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="metrica" stroke={textColor} fontSize={10} tickLine={false} />
                <YAxis stroke={textColor} fontSize={11} tickLine={false} />
                <Tooltip
                  cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: isDark ? '#f8fafc' : '#0f172a',
                  }}
                  formatter={(value: any) => [`${value} min`, 'Promedio']}
                />
                <Bar
                  dataKey="minutos"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                  isAnimationActive={shouldAnimate}
                  animationDuration={shouldAnimate ? 300 : 0}
                >
                  {avgTimesData.map((entry, index) => (
                    <Cell key={`time-cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 3: Multicanalidad (Donut completamente centrado) */}
        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-header-title">
              <Activity size={16} color="#166534" />
              <h3 style={{ fontSize: 13, fontWeight: 700 }}>Canales de Ingreso de Solicitud</h3>
            </div>
            <span className="chart-badge">Multicanal</span>
          </div>

          <div className="chart-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height={210}>
              <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Tooltip
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: isDark ? '#f8fafc' : '#0f172a',
                  }}
                  formatter={(value: any) => [`${value} pedidos`, 'Volumen']}
                />
                <Pie
                  data={channelData}
                  cx="50%"
                  cy="45%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="valor"
                  isAnimationActive={shouldAnimate}
                  animationDuration={shouldAnimate ? 300 : 0}
                >
                  {channelData.map((_, index) => (
                    <Cell key={`channel-cell-${index}`} fill={MINIMAL_PALETTE[index % MINIMAL_PALETTE.length]} />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  height={32}
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', color: textColor, paddingTop: '4px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 4: Demanda por Especialidad (Normalizada contra catálogo) */}
        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-header-title">
              <TrendingUp size={16} color="var(--primary)" />
              <h3 style={{ fontSize: 13, fontWeight: 700 }}>Demanda por Especialidad Técnica</h3>
            </div>
            <span className="chart-badge">Top 5</span>
          </div>

          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={210}>
              <BarChart layout="vertical" data={specialtyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                <XAxis type="number" stroke={textColor} fontSize={11} tickLine={false} allowDecimals={false} />
                <YAxis dataKey="name" type="category" stroke={textColor} fontSize={11} tickLine={false} width={90} />
                <Tooltip
                  cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: isDark ? '#f8fafc' : '#0f172a',
                  }}
                  formatter={(value: any) => [`${value} servicios`, 'Demanda']}
                />
                <Bar
                  dataKey="cantidad"
                  fill="var(--primary)"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={18}
                  isAnimationActive={shouldAnimate}
                  animationDuration={shouldAnimate ? 300 : 0}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Panel 5: Diagnóstico de Cancelaciones (Resolves Bug d) */}
      {cancellationData && (
        <div className="sidepanel-card" style={{ borderColor: 'var(--status-danger-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} color="#dc2626" />
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                Diagnóstico de Cancelaciones Operativas
              </h4>
            </div>
            <span
              className="mono-tabular"
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#991b1b',
                backgroundColor: '#fee2e2',
                padding: '2px 8px',
                borderRadius: 4,
              }}
            >
              Total Cancelados: {cancellationData.totalCancelled} (Tasa: {((cancellationData.totalCancelled / requests.length) * 100).toFixed(1)}%)
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {cancellationData.list.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  backgroundColor: 'var(--bg-hover)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-main)' }} title={item.motivoCompleto}>
                    {item.motivo}
                  </span>
                  <span className="mono-tabular" style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>
                    {item.cantidad}
                  </span>
                </div>
                <div style={{ width: '100%', height: 4, borderRadius: 2, backgroundColor: 'var(--border)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${item.porcentaje}%`,
                      height: '100%',
                      backgroundColor: '#dc2626',
                      borderRadius: 2,
                    }}
                  />
                </div>
                <span className="mono-tabular" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {item.porcentaje}% del total de cancelaciones
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const AnalyticsCharts = memo(AnalyticsChartsComponent);
