import React from 'react';
import { Camera, CheckCircle2, Clock, Navigation, Wrench } from 'lucide-react';
import type { DashboardStats } from '../../utils/dashboardStats';

interface SummaryCardsProps {
  stats: DashboardStats;
  /** Agrega la tarjeta de auditoría fotográfica (útil en la vista analítica). */
  showAudit?: boolean;
}

interface CardProps {
  icon: React.ReactNode;
  iconTone: 'blue' | 'amber' | 'purple' | 'green' | 'cyan' | 'red';
  label: string;
  value: number;
  pill: string;
  pillTone: 'neutral' | 'amber' | 'purple' | 'green' | 'cyan' | 'red' | 'blue';
  valueTone?: 'amber' | 'purple' | 'green' | 'red' | 'blue';
}

const KpiCard: React.FC<CardProps> = ({ icon, iconTone, label, value, pill, pillTone, valueTone }) => (
  <div className="kpi-card-item">
    <div className={`kpi-card-icon icon-${iconTone}`} aria-hidden="true">{icon}</div>
    <div className="kpi-card-body">
      <span className="kpi-card-label">{label}</span>
      <div className="kpi-card-data-row">
        <span className={`kpi-card-number mono-tabular${valueTone ? ` text-${valueTone}` : ''}`}>{value}</span>
        <span className={`kpi-card-pill pill-${pillTone}`}>{pill}</span>
      </div>
    </div>
  </div>
);

/**
 * Indicadores clave de la central. Cada tarjeta responde una pregunta operativa y usa el mismo color
 * semántico que los estados de la bandeja y de la app móvil:
 * por asignar (ámbar; rojo si hay reasignaciones), en ruta (azul), en ejecución (violeta) y concluidas hoy (verde).
 */
export const SummaryCards: React.FC<SummaryCardsProps> = ({ stats, showAudit = false }) => {
  const hasReassign = stats.reassign > 0;
  return (
    <section
      className="kpi-cards-grid"
      aria-label="Indicadores operativos clave"
      style={{ '--kpi-cols': showAudit ? 5 : 4 } as React.CSSProperties}
    >
      <KpiCard
        icon={<Clock size={18} />}
        iconTone={hasReassign ? 'red' : 'amber'}
        label="Por asignar"
        value={stats.toAssign}
        valueTone={hasReassign ? 'red' : 'amber'}
        pill={hasReassign ? `${stats.reassign} por reasignar` : 'Esperando despacho'}
        pillTone={hasReassign ? 'red' : 'amber'}
      />
      <KpiCard
        icon={<Navigation size={18} />}
        iconTone="blue"
        label="Técnicos en ruta"
        value={stats.inTransit}
        valueTone="blue"
        pill="Hacia el domicilio"
        pillTone="blue"
      />
      <KpiCard
        icon={<Wrench size={18} />}
        iconTone="purple"
        label="En ejecución"
        value={stats.executing}
        valueTone="purple"
        pill="En el predio"
        pillTone="purple"
      />
      <KpiCard
        icon={<CheckCircle2 size={18} />}
        iconTone="green"
        label="Concluidas hoy"
        value={stats.completedToday}
        valueTone="green"
        pill={`${stats.completionRate}% de éxito`}
        pillTone="green"
      />
      {showAudit ? (
        <KpiCard
          icon={<Camera size={18} />}
          iconTone="cyan"
          label="Auditoría de fotos"
          value={stats.photoEvidences}
          pill={`${stats.auditRate}% de cobertura`}
          pillTone="cyan"
        />
      ) : null}
    </section>
  );
};
