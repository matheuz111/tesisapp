import React from 'react';
import {
  Clock,
  Receipt,
  UserCheck,
  Navigation,
  Wrench,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { formatStatus } from '../types';

export interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const getBadgeConfig = () => {
    switch (status) {
      case 'PENDING_ASSIGNMENT':
        return {
          className: 'badge-status-pending',
          Icon: Clock,
          label: 'Por Asignar',
        };
      case 'QUOTED':
        return {
          className: 'badge-status-quoted',
          Icon: Receipt,
          label: 'Cotizado',
        };
      case 'PENDING':
        return {
          className: 'badge-status-pending',
          Icon: UserCheck,
          label: 'Esperando Técnico',
        };
      case 'ACCEPTED':
        return {
          className: 'badge-status-intransit',
          Icon: Navigation,
          label: 'En Camino',
        };
      case 'IN_PROGRESS':
        return {
          className: 'badge-status-inprogress',
          Icon: Wrench,
          label: 'En Ejecución',
        };
      case 'COMPLETED':
        return {
          className: 'badge-status-completed',
          Icon: CheckCircle2,
          label: 'Culminado',
        };
      case 'VALIDATED':
      case 'ARCHIVED':
        return {
          className: 'badge-status-completed',
          Icon: ShieldCheck,
          label: 'Validado',
        };
      case 'REQUIRES_REASSIGNMENT':
        return {
          className: 'badge-status-danger',
          Icon: AlertTriangle,
          label: 'Reasignar',
        };
      case 'CANCELLED_BY_CLIENT':
        return {
          className: 'badge-status-danger',
          Icon: XCircle,
          label: 'Cancelado Cliente',
        };
      case 'CANCELLED_BY_PROVIDER':
        return {
          className: 'badge-status-danger',
          Icon: XCircle,
          label: 'Cancelado Técnico',
        };
      case 'CANCELLED_BY_OPERATOR':
        return {
          className: 'badge-status-danger',
          Icon: XCircle,
          label: 'Cancelado Central',
        };
      default:
        return {
          className: 'badge-status-pending',
          Icon: HelpCircle,
          label: formatStatus(status),
        };
    }
  };

  const { className, Icon, label } = getBadgeConfig();
  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <span
      className={`app-status-badge ${className} size-${size}`}
      role="status"
      aria-label={`Estado del servicio: ${label}`}
    >
      <Icon size={iconSize} className="status-badge-icon" aria-hidden="true" />
      <span className="status-badge-text">{label}</span>
    </span>
  );
};
