import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, MapPinOff, MessageCircle, Radio, WifiOff } from 'lucide-react';
import type { DashboardStats } from '../../utils/dashboardStats';
import { STALE_AFTER_MINUTES, type StaleProvider } from '../../utils/providerSignal';

interface TelemetryBarProps {
  stats: DashboardStats;
  isOnline: boolean;
  /** Entradas de WhatsApp que aún se están registrando. Casi siempre 0: se procesan solas en segundos. */
  whatsappPending?: number;
  /** Técnicos conectados que dejaron de reportar ubicación en horario laboral. */
  staleProviders?: StaleProvider[];
  /** Filtra la bandeja a las solicitudes pendientes de la central, donde viven las reasignaciones. */
  onShowReassign: () => void;
}

/**
 * Franja de telemetría bajo la barra superior: pulso operativo en una línea y alerta de reasignación.
 * Sin conexión, la franja pasa a rojo y avisa que la central está en modo de solo consulta.
 */
export const TelemetryBar: React.FC<TelemetryBarProps> = ({ stats, isOnline, whatsappPending = 0, staleProviders = [], onShowReassign }) => {
  const [signalOpen, setSignalOpen] = useState(false);
  const signalRef = useRef<HTMLDivElement>(null);

  // Cierra la lista al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!signalOpen) return;
    const onPointer = (event: MouseEvent) => { if (!signalRef.current?.contains(event.target as Node)) setSignalOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setSignalOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [signalOpen]);

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
      {staleProviders.length > 0 ? (
        <div className="telemetry-signal" ref={signalRef}>
          <button
            type="button"
            className="telemetry-signal-btn"
            onClick={() => setSignalOpen((open) => !open)}
            aria-expanded={signalOpen}
            aria-haspopup="true"
            aria-label={`${staleProviders.length} técnicos sin ubicación reciente. Ver lista`}
          >
            <MapPinOff size={14} aria-hidden="true" /> Sin ubicación <strong className="mono-tabular">{staleProviders.length}</strong>
          </button>
          {signalOpen ? (
            <div className="telemetry-signal-list" role="dialog" aria-label="Técnicos sin ubicación reciente">
              <p className="telemetry-signal-title">Conectados sin señal en los últimos {STALE_AFTER_MINUTES} min</p>
              <ul>
                {staleProviders.map((provider) => (
                  <li key={provider.providerId}>
                    <span className="telemetry-signal-name">{provider.name}</span>
                    <span className="telemetry-signal-time">
                      {provider.minutesSilent === null ? 'nunca reportó' : `hace ${provider.minutesSilent} min`}
                    </span>
                    {provider.phone ? (
                      <a className="telemetry-signal-call" href={`tel:${provider.phone}`} aria-label={`Llamar a ${provider.name}`}>{provider.phone}</a>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="telemetry-signal-help">Llámalos para que enciendan su ubicación; mientras no reporten, no reciben asignaciones cercanas.</p>
            </div>
          ) : null}
        </div>
      ) : null}
      {whatsappPending > 0 ? (
        <span className="telemetry-metric telemetry-whatsapp" role="status">
          <MessageCircle size={14} aria-hidden="true" /> WhatsApp por registrar <strong className="mono-tabular">{whatsappPending}</strong>
        </span>
      ) : null}
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
