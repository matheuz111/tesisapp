import React from 'react';
import { ChevronRight } from 'lucide-react';
import type { ServiceRequest } from '../../types';
import { StatusBadge } from '../StatusBadge';
import { computeRequestSla } from '../SlaTrafficBadge';
import { describeSla, getWarranty } from './requestPresentation';

interface StatusCellProps {
  request: ServiceRequest;
  onOpen: (request: ServiceRequest) => void;
}

/**
 * Celda de estado: una etiqueta y una sola línea de contexto (tiempo de espera o garantía).
 * Todo lo demás (conformidad, pago, línea de tiempo) vive en el detalle, que se abre al hacer clic.
 */
export const StatusCell: React.FC<StatusCellProps> = ({ request, onOpen }) => {
  const sla = computeRequestSla(request);
  const warranty = getWarranty(request);
  const isClosedState = sla.metric === 'CLOSED';

  // Servicios cerrados: lo útil es la garantía. En curso: el tiempo en la etapa actual.
  const hint = isClosedState && warranty ? warranty.label : isClosedState ? '' : describeSla(sla);
  const tone = isClosedState && warranty ? (warranty.active ? 'ok' : 'muted') : sla.level.toLowerCase();

  return (
    <button
      type="button"
      className="rq-status-cell"
      onClick={(e) => { e.stopPropagation(); onOpen(request); }}
      aria-haspopup="dialog"
      aria-label={`Estado ${request.code || ''}. Ver detalle del estado`}
    >
      <StatusBadge status={request.status} size="sm" />
      <span className={`rq-status-hint rq-tone-${tone}`}>
        {hint || 'Ver detalle'}
        <ChevronRight size={12} aria-hidden="true" />
      </span>
    </button>
  );
};
