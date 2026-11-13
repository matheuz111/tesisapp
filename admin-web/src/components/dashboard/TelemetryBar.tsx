import React from 'react';
import { AlertTriangle, Radio, WifiOff } from 'lucide-react';
import type { DashboardStats } from '../../utils/dashboardStats';

interface TelemetryBarProps {
  stats: DashboardStats;
  isOnline: boolean;
  /** Filtra la bandeja a las solicitudes pendientes de la central, donde viven las reasignaciones. */
  onShowReassign: () => void;
}

/**
 * Franja de telemetría bajo la barra superior: pulso operativo en una línea y alerta de reasignación.
 * Sin conexión, la franja pasa a rojo y avisa que la central está en modo de solo consulta.
 */
export const TelemetryBar: React.FC<TelemetryBarProps> = ({ stats, isOnline, onShowReassign }) => {
  if (!isOnline) {
    return (
      <div className="telemetry-bar telemetry-offline" role="alert">
        <WifiOff size={15} aria-hidden="true" />
        <span>
          <strong>Modo desconectado.</strong> Solo consulta: las asignaciones y los cambios se habilitan al recuperar el enlace con la base de datos.
        </span>
      </div>
    );
  }

  const hasReassign = stats.reassign > 0;
  return (
    <div className="telemetry-bar" role="status" aria-label="Telemetría operativa en vivo">
      <span className="telemetry-live">
        <Radio size={14} aria-hidden="true" />
        En vivo
      </span>
      <span className="telemetry-metric">
        Sol. activas <strong className="mono-tabular">{stats.active}</strong>
      </span>
      <span className="telemetry-metric">
        En ruta <strong className="mono-tabular">{stats.inTransit}</strong>
      </span>
      <button
        type="button"
        className={`telemetry-alert${hasReassign ? ' is-active' : ''}`}
        onClick={onShowReassign}
        disabled={!hasReassign}
        aria-label={hasReassign ? `${stats.reassign} solicitudes requieren reasignación. Ver pendientes` : 'Sin alertas de reasignación'}
      >
        <AlertTriangle size={14} aria-hidden="true" />
        Alerta reasig. <strong className="mono-tabular">{stats.reassign}</strong>
      </button>
    </div>
  );
};
