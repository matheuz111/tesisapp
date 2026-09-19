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
import { Activity, Layers, Clock, TrendingUp } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface Props {
  requests: ServiceRequest[];
}

// Paleta ejecutiva minimalista (azul pizarra, índigo suave, verde esmeralda sutil, ámbar suave)
const MINIMAL_PALETTE = ['#2563eb', '#10b981', '#f59e0b', '#6366f1', '#64748b', '#06b6d4'];

const STATUS_MINIMAL_COLORS: Record<string, string> = {
  'Por Asignar': '#f59e0b',
  'En Curso': '#3b82f6',
  'Culminado': '#10b981',
  'Cancelado': '#94a3b8',
};

export const AnalyticsCharts = ({ requests }: Props) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const gridColor = isDark ? '#1e293b' : '#f1f5f9';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const tooltipBg = isDark ? '#0f172a' : '#ffffff';
  const tooltipBorder = isDark ? '#334155' : '#e2e8f0';

  // 1. Datos por Estado Operativo
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
      { name: 'Por Asignar', cantidad: pending, color: STATUS_MINIMAL_COLORS['Por Asignar'] },
      { name: 'En Curso', cantidad: inProgress, color: STATUS_MINIMAL_COLORS['En Curso'] },
      { name: 'Culminado', cantidad: completed, color: STATUS_MINIMAL_COLORS['Culminado'] },
      { name: 'Cancelado', cantidad: cancelled, color: STATUS_MINIMAL_COLORS['Cancelado'] },
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
      .slice(0, 5);
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
      { metrica: '1. Contacto (T_RSP)', minutos: rspCount ? Number((rspSum / rspCount).toFixed(1)) : 0, color: '#3b82f6' },
      { metrica: '2. Asignación (T_ASG)', minutos: asgCount ? Number((asgSum / asgCount).toFixed(1)) : 0, color: '#2563eb' },
      { metrica: '3. Traslado (T_LLE)', minutos: lleCount ? Number((lleSum / lleCount).toFixed(1)) : 0, color: '#f59e0b' },
      { metrica: '4. Ejecución (T_EJE)', minutos: ejeCount ? Number((ejeSum / ejeCount).toFixed(1)) : 0, color: '#10b981' },
      { metrica: '5. Cierre (T_VAL)', minutos: valCount ? Number((valSum / valCount).toFixed(1)) : 0, color: '#6366f1' },
      { metrica: 'Ciclo Total (T_TOT)', minutos: totCount ? Number((totSum / totCount).toFixed(1)) : 0, color: '#0f172a' },
    ];
  }, [requests]);

  if (requests.length === 0) return null;

  return (
    <div className="analytics-section">
      {/* Grilla Minimalista 2x2: Espaciosa, limpia y enfocada */}
      <div className="analytics-grid-2x2">
        {/* Gráfico 1: Estado del Flujo */}
        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-header-title">
              <Layers size={16} color="#2563eb" />
              <h3>Flujo de Estados Operativos</h3>
            </div>
            <span className="chart-badge">En Tiempo Real</span>
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
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    color: isDark ? '#f8fafc' : '#0f172a',
                  }}
                  formatter={(value: any) => [`${value} pedidos`, 'Cantidad']}
                />
                <Bar dataKey="cantidad" radius={[4, 4, 0, 0]} maxBarSize={42}>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
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
              <Clock size={16} color="#2563eb" />
              <h3>Tiempos Medios de Gestión por Etapa (Minutos)</h3>
            </div>
            <span className="chart-badge">SPSS Deltas</span>
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
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    color: isDark ? '#f8fafc' : '#0f172a',
                  }}
                  formatter={(value: any) => [`${value} minutos`, 'Promedio']}
                />
                <Bar dataKey="minutos" radius={[4, 4, 0, 0]} maxBarSize={38}>
                  {avgTimesData.map((entry, index) => (
                    <Cell key={`time-cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 3: Multicanalidad */}
        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-header-title">
              <Activity size={16} color="#10b981" />
              <h3>Canales de Ingreso (Multicanalidad)</h3>
            </div>
            <span className="chart-badge">Origen</span>
          </div>

          <div className="chart-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Tooltip
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: isDark ? '#f8fafc' : '#0f172a',
                  }}
                />
                <Pie
                  data={channelData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="valor"
                >
                  {channelData.map((_, index) => (
                    <Cell key={`channel-cell-${index}`} fill={MINIMAL_PALETTE[index % MINIMAL_PALETTE.length]} />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  height={30}
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', color: textColor }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 4: Demanda por Especialidad */}
        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-header-title">
              <TrendingUp size={16} color="#6366f1" />
              <h3>Demanda por Especialidad Técnica</h3>
            </div>
            <span className="chart-badge">Top Rubros</span>
          </div>

          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={210}>
              <BarChart layout="vertical" data={specialtyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                <XAxis type="number" stroke={textColor} fontSize={11} tickLine={false} allowDecimals={false} />
                <YAxis dataKey="name" type="category" stroke={textColor} fontSize={11} tickLine={false} width={85} />
                <Tooltip
                  cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: isDark ? '#f8fafc' : '#0f172a',
                  }}
                  formatter={(value: any) => [`${value} solicitudes`, 'Demanda']}
                />
                <Bar dataKey="cantidad" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
