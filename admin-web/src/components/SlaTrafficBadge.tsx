import React from 'react';
import type { ServiceRequest } from '../types';
import { SLA_CONFIG } from '../config/operationalConfig';
import { Clock, AlertTriangle, CheckCircle, Navigation, Wrench, ShieldAlert } from 'lucide-react';

interface SlaTrafficBadgeProps {
  request: ServiceRequest;
  showDetails?: boolean;
}

export interface SlaCalculation {
  metric: 'T_RESP' | 'T_ASIG' | 'T_VIS' | 'T_EJEC' | 'CLOSED' | 'REASSIGNMENT';
  elapsedMinutes: number;
  level: 'GREEN' | 'AMBER' | 'RED' | 'INFO';
  label: string;
  subtext: string;
}

export function computeRequestSla(request: ServiceRequest, showDetails = false): SlaCalculation {
  const now = Date.now();

  const toMillis = (val: any): number => {
    if (!val) return 0;
    if (typeof val.toMillis === 'function') return val.toMillis();
    if (typeof val.seconds === 'number') return val.seconds * 1000;
    if (val instanceof Date) return val.getTime();
    if (typeof val === 'number') return val;
    return new Date(val).getTime() || 0;
  };

  const createdAtMs = toMillis(request.createdAt);
  const updatedAtMs = toMillis(request.updatedAt) || createdAtMs;

  // 1. Caso Urgente: REQUIRES_REASSIGNMENT
  if (request.status === 'REQUIRES_REASSIGNMENT') {
    const elapsedMinutes = Math.max(0, Math.round((now - updatedAtMs) / 60000));
    return {
      metric: 'REASSIGNMENT',
      elapsedMinutes,
      level: 'RED',
      label: showDetails ? 'Reasignación Urgente' : 'Reasignar',
      subtext: `Técnico devolvió asignación hace ${elapsedMinutes}m. Acción inmediata.`,
    };
  }

  // 2. Etapa de Cotización pendiente: Esperando aprobación del cliente
  if (request.status === 'QUOTED') {
    const elapsedMinutes = Math.max(0, Math.round((now - updatedAtMs) / 60000));
    return {
      metric: 'T_RESP',
      elapsedMinutes,
      level: 'INFO',
      label: `Cotizado · ${elapsedMinutes}m`,
      subtext: `Esperando decisión del cliente en la app (hace ${elapsedMinutes}m)`,
    };
  }

  // 3. Etapa Inicial: PENDING_ASSIGNMENT
  if (request.status === 'PENDING_ASSIGNMENT') {
    if (request.requiresQuote && request.quoteStatus === 'PENDING_QUOTE') {
      const elapsedMinutes = Math.max(0, Math.round((now - createdAtMs) / 60000));
      const { GREEN_LIMIT_MINUTES, AMBER_LIMIT_MINUTES } = SLA_CONFIG.T_RESP;

      if (elapsedMinutes <= GREEN_LIMIT_MINUTES) {
        return {
          metric: 'T_RESP',
          elapsedMinutes,
          level: 'GREEN',
          label: `T_RESP: ${elapsedMinutes}m`,
          subtext: `Dentro de SLA (<${GREEN_LIMIT_MINUTES}m). Pendiente proforma.`,
        };
      }
      if (elapsedMinutes <= AMBER_LIMIT_MINUTES) {
        return {
          metric: 'T_RESP',
          elapsedMinutes,
          level: 'AMBER',
          label: `T_RESP: ${elapsedMinutes}m`,
          subtext: `SLA intermedio (${GREEN_LIMIT_MINUTES}-${AMBER_LIMIT_MINUTES}m).`,
        };
      }
      return {
        metric: 'T_RESP',
        elapsedMinutes,
        level: 'RED',
        label: `T_RESP: ${elapsedMinutes}m (Excedido)`,
        subtext: `SLA superado (>${AMBER_LIMIT_MINUTES}m). Atención urgente.`,
      };
    }

    const elapsedMinutes = Math.max(0, Math.round((now - createdAtMs) / 60000));
    const { GREEN_LIMIT_MINUTES, AMBER_LIMIT_MINUTES } = SLA_CONFIG.T_RESP;

    if (elapsedMinutes <= GREEN_LIMIT_MINUTES) {
      return {
        metric: 'T_RESP',
        elapsedMinutes,
        level: 'GREEN',
        label: `Espera: ${elapsedMinutes}m`,
        subtext: `Dentro de SLA de respuesta (<${GREEN_LIMIT_MINUTES}m).`,
      };
    }
    if (elapsedMinutes <= AMBER_LIMIT_MINUTES) {
      return {
        metric: 'T_RESP',
        elapsedMinutes,
        level: 'AMBER',
        label: `Espera: ${elapsedMinutes}m`,
        subtext: `SLA intermedio (${GREEN_LIMIT_MINUTES}-${AMBER_LIMIT_MINUTES}m).`,
      };
    }
    return {
      metric: 'T_RESP',
      elapsedMinutes,
      level: 'RED',
      label: `Espera: ${elapsedMinutes}m`,
      subtext: `SLA superado (>${AMBER_LIMIT_MINUTES}m).`,
    };
  }

  // 4. Etapa: Asignación a Técnico
  if (request.status === 'PENDING') {
    const approvedAtMs = toMillis(request.quoteAcceptedAt) || createdAtMs;
    const elapsedMinutes = Math.max(0, Math.round((now - approvedAtMs) / 60000));
    const { GREEN_LIMIT_MINUTES, AMBER_LIMIT_MINUTES } = SLA_CONFIG.T_ASIG;

    if (elapsedMinutes <= GREEN_LIMIT_MINUTES) {
      return {
        metric: 'T_ASIG',
        elapsedMinutes,
        level: 'GREEN',
        label: `Asig: ${elapsedMinutes}m`,
        subtext: `SLA asignación (<${GREEN_LIMIT_MINUTES}m).`,
      };
    }
    if (elapsedMinutes <= AMBER_LIMIT_MINUTES) {
      return {
        metric: 'T_ASIG',
        elapsedMinutes,
        level: 'AMBER',
        label: `Asig: ${elapsedMinutes}m`,
        subtext: `SLA intermedio (${GREEN_LIMIT_MINUTES}-${AMBER_LIMIT_MINUTES}m).`,
      };
    }
    return {
      metric: 'T_ASIG',
      elapsedMinutes,
      level: 'RED',
      label: `Asig: ${elapsedMinutes}m`,
      subtext: `SLA superado (>${AMBER_LIMIT_MINUTES}m).`,
    };
  }

  // 5. Etapa: Técnico en Ruta
  if (request.status === 'ACCEPTED') {
    const assignedAtMs = toMillis(request.assignedAt) || toMillis(request.acceptedAt) || createdAtMs;
    const elapsedMinutes = Math.max(0, Math.round((now - assignedAtMs) / 60000));
    const { GREEN_LIMIT_MINUTES, AMBER_LIMIT_MINUTES } = SLA_CONFIG.T_VIS;

    if (elapsedMinutes <= GREEN_LIMIT_MINUTES) {
      return {
        metric: 'T_VIS',
        elapsedMinutes,
        level: 'GREEN',
        label: `En ruta · ${elapsedMinutes}m`,
        subtext: `Traslado en tiempo (<${GREEN_LIMIT_MINUTES}m).`,
      };
    }
    if (elapsedMinutes <= AMBER_LIMIT_MINUTES) {
      return {
        metric: 'T_VIS',
        elapsedMinutes,
        level: 'AMBER',
        label: `En ruta · ${elapsedMinutes}m`,
        subtext: `Traslado demorado (${GREEN_LIMIT_MINUTES}-${AMBER_LIMIT_MINUTES}m).`,
      };
    }
    return {
      metric: 'T_VIS',
      elapsedMinutes,
      level: 'RED',
      label: `En ruta · ${elapsedMinutes}m`,
      subtext: `Traslado con retraso (>${AMBER_LIMIT_MINUTES}m).`,
    };
  }

  // 6. Etapa: Trabajo en Domicilio
  if (request.status === 'IN_PROGRESS') {
    const startedAtMs = toMillis(request.startedAt) || toMillis(request.pinValidatedAt) || createdAtMs;
    const elapsedMinutes = Math.max(0, Math.round((now - startedAtMs) / 60000));
    return {
      metric: 'T_EJEC',
      elapsedMinutes,
      level: 'INFO',
      label: `En ejecución · ${elapsedMinutes}m`,
      subtext: `Trabajo técnico activo en domicilio.`,
    };
  }

  // 7. Etapa Culminada / Cerrada
  if (['COMPLETED', 'VALIDATED'].includes(request.status)) {
    return {
      metric: 'CLOSED',
      elapsedMinutes: 0,
      level: 'GREEN',
      label: showDetails ? 'Culminado con conformidad' : 'Conforme',
      subtext: 'Servicio cerrado con auditoría y trazabilidad completa.',
    };
  }

  // Otros (Cancelados)
  return {
    metric: 'CLOSED',
    elapsedMinutes: 0,
    level: 'INFO',
    label: 'Cerrado',
    subtext: 'Solicitud finalizada',
  };
}

export const SlaTrafficBadge: React.FC<SlaTrafficBadgeProps> = ({ request, showDetails = false }) => {
  const sla = computeRequestSla(request, showDetails);

  const getIcon = () => {
    switch (sla.metric) {
      case 'REASSIGNMENT':
        return <ShieldAlert size={12} />;
      case 'T_RESP':
        return sla.level === 'GREEN' ? <Clock size={12} /> : <AlertTriangle size={12} />;
      case 'T_ASIG':
        return sla.level === 'GREEN' ? <Clock size={12} /> : <AlertTriangle size={12} />;
      case 'T_VIS':
        return <Navigation size={12} />;
      case 'T_EJEC':
        return <Wrench size={12} />;
      case 'CLOSED':
        return <CheckCircle size={12} />;
      default:
        return <Clock size={12} />;
    }
  };

  return (
    <div
      className={`sla-badge-pill sla-level-${sla.level.toLowerCase()}`}
      title={sla.subtext}
    >
      {getIcon()}
      <span>{sla.label}</span>
      {showDetails && (
        <span style={{ fontSize: '10px', opacity: 0.85, marginLeft: 2 }}>
          ({sla.subtext})
        </span>
      )}
    </div>
  );
};
