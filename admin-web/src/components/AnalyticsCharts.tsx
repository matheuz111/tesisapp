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
import { BarChart3, PieChart as PieIcon, Activity, Layers } from 'lucide-react';

interface Props {
  requests: ServiceRequest[];
}

const COLORS = ['#0284c7', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

const STATUS_COLORS: Record<string, string> = {
  'Por Asignar': '#f59e0b',
  'En Curso': '#6366f1',
  'Culminado': '#10b981',
  'Cancelado': '#ef4444',
};

export const AnalyticsCharts = ({ requests }: Props) => {
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

    return Object.entries(counts).map(([name, valor]) => ({ name, valor }));
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

  // 4. Promedios de Tiempos en Minutos (NTP)
  const avgTimesData = useMemo(() => {
    let respSum = 0, respCount = 0;
    let asigSum = 0, asigCount = 0;
    let visSum = 0, visCount = 0;
    let totalSum = 0, totalCount = 0;

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
        respSum += (tResp - tCrea) / 60000;
        respCount++;
      }

      const tAsig = toMillis(r.assignedAt);
      if (tAsig && tAsig >= tCrea) {
        asigSum += (tAsig - tCrea) / 60000;
        asigCount++;
      }

      const tInic = toMillis(r.startedAt);
      if (tInic && tInic >= tCrea) {
        visSum += (tInic - tCrea) / 60000;
        visCount++;
      }

      const tCier = toMillis(r.validatedAt) || toMillis(r.finishedAt);
      if (tCier && tCier >= tCrea) {
        totalSum += (tCier - tCrea) / 60000;
        totalCount++;
      }
    });

    return [
      { metrica: 'T. Respuesta', minutos: respCount ? Number((respSum / respCount).toFixed(1)) : 0 },
      { metrica: 'T. Asignación', minutos: asigCount ? Number((asigSum / asigCount).toFixed(1)) : 0 },
      { metrica: 'T. Llegada (PIN)', minutos: visCount ? Number((visSum / visCount).toFixed(1)) : 0 },
      { metrica: 'T. Total Servicio', minutos: totalCount ? Number((totalSum / totalCount).toFixed(1)) : 0 },
    ];
  }, [requests]);

  if (requests.length === 0) return null;

  return (
    <div className="analytics-section">
      <div className="analytics-grid">
        {/* Gráfico 1: Estado del Flujo */}
        <div className="chart-card">
          <div className="chart-header">
            <Layers size={18} color="#0284c7" />
            <h3>Distribución por Estado Operativo</h3>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={statusData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: any) => [`${val} solicitudes`, 'Total']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
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
            <PieIcon size={18} color="#10b981" />
            <h3>Canales de Ingreso (Multicanal)</h3>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={240}>
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
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`${val} pedidos`, 'Volumen']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 3: Especialidades Más Solicitadas */}
        <div className="chart-card">
          <div className="chart-header">
            <BarChart3 size={18} color="#8b5cf6" />
            <h3>Demanda por Especialidad</h3>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={specialtyData} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                <Tooltip
                  formatter={(val: any) => [`${val} solicitudes`, 'Atenciones']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="cantidad" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 4: Tiempos Promedio (SPSS Variables) */}
        <div className="chart-card">
          <div className="chart-header">
            <Activity size={18} color="#ec4899" />
            <h3>Tiempos Medios de Gestión (Minutos)</h3>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={avgTimesData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="metrica" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: any) => [`${val} min`, 'Promedio']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="minutos" fill="#0284c7" radius={[6, 6, 0, 0]}>
                  {avgTimesData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 3 ? '#ec4899' : '#0284c7'} />
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
