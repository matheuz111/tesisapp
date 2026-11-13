import React, { useMemo, useState } from 'react';
import type { ServiceRequest } from '../../types';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Hammer,
  HardHat,
  KeyRound,
  ListChecks,
  MapPin,
  MessageCircle,
  MessageSquare,
  Navigation,
  Paintbrush,
  ShieldCheck,
  UserCheck,
  Wrench,
  Zap,
} from 'lucide-react';
import { StatusBadge } from '../StatusBadge';
import { RowActionsMenu, type RowAction } from './RowActionsMenu';
import { StatusCell } from './StatusCell';
import { StatusDetailModal } from './StatusDetailModal';
import {
  CHANNEL_LABELS,
  canAssign,
  explainStage,
  formatDateTime,
  getDisplayPrice,
  isClosed,
} from './requestPresentation';

interface RequestsTableProps {
  loading: boolean;
  /** Hay filtros aplicados: cambia el mensaje del estado vacío. */
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  requests: ServiceRequest[];
  totalFiltered: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSelectDetail: (request: ServiceRequest) => void;
  onSelectQuote: (request: ServiceRequest) => void;
  onSelectWarranty: (request: ServiceRequest) => void;
  onSelectTracking: (request: ServiceRequest) => void;
  onSelectChat: (request: ServiceRequest) => void;
  onSelectAssign: (request: ServiceRequest) => void;
}

const SPECIALTY_ICONS: { match: string; icon: React.ReactNode }[] = [
  { match: 'gasf', icon: <Wrench size={14} /> },
  { match: 'elec', icon: <Zap size={14} /> },
  { match: 'pint', icon: <Paintbrush size={14} /> },
  { match: 'carp', icon: <Hammer size={14} /> },
  { match: 'cerr', icon: <KeyRound size={14} /> },
  { match: 'alba', icon: <HardHat size={14} /> },
];

function specialtyIcon(specialty?: string): React.ReactNode {
  const text = (specialty || '').toLowerCase();
  return SPECIALTY_ICONS.find((item) => text.includes(item.match))?.icon ?? <Wrench size={14} />;
}

function zoneLabel(zone?: string): string {
  return zone ? zone.replace('LIMA_', '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : '';
}

function whatsappLink(request: ServiceRequest): string {
  const phone = (request.clientPhone || '').replace(/\D/g, '');
  const text = `Hola ${request.clientName || ''}, te saludamos de la Central de Maestro a Domicilio respecto a tu solicitud ${request.code || ''}.`;
  return `https://wa.me/51${phone}?text=${encodeURIComponent(text)}`;
}

export const RequestsTable: React.FC<RequestsTableProps> = ({
  loading,
  hasActiveFilters = false,
  onClearFilters,
  requests,
  totalFiltered,
  currentPage,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  onSelectDetail,
  onSelectQuote,
  onSelectWarranty,
  onSelectTracking,
  onSelectChat,
  onSelectAssign,
}) => {
  const [statusRequestId, setStatusRequestId] = useState<string | null>(null);
  const [statusSnapshot, setStatusSnapshot] = useState<ServiceRequest | null>(null);
  // El detalle se mantiene al día con los cambios en tiempo real mientras la fila siga en la página.
  const statusRequest = useMemo(
    () => requests.find((item) => item.id === statusRequestId) ?? statusSnapshot,
    [requests, statusRequestId, statusSnapshot],
  );
  const openStatus = (request: ServiceRequest) => { setStatusRequestId(request.id); setStatusSnapshot(request); };
  const closeStatus = () => { setStatusRequestId(null); setStatusSnapshot(null); };

  const buildActions = (request: ServiceRequest): RowAction[] => {
    const actions: RowAction[] = [
      { key: 'detail', label: 'Ver ficha completa', icon: <Eye size={16} />, onSelect: () => onSelectDetail(request) },
      { key: 'status', label: 'Estado y seguimiento', icon: <ListChecks size={16} />, onSelect: () => openStatus(request) },
    ];
    if (canAssign(request)) {
      actions.push({
        key: 'assign',
        label: request.status === 'REQUIRES_REASSIGNMENT' ? 'Reasignar técnico' : 'Asignar técnico',
        icon: <UserCheck size={16} />,
        onSelect: () => onSelectAssign(request),
      });
    }
    actions.push(
      { key: 'quote', label: 'Cotización (proforma)', icon: <FileText size={16} />, onSelect: () => onSelectQuote(request) },
      { key: 'tracking', label: 'Seguimiento en mapa', icon: <Navigation size={16} />, onSelect: () => onSelectTracking(request) },
      { key: 'chat', label: 'Chat con cliente o técnico', icon: <MessageSquare size={16} />, onSelect: () => onSelectChat(request) },
    );
    if (isClosed(request)) {
      actions.push({ key: 'warranty', label: 'Certificado de garantía', icon: <ShieldCheck size={16} />, onSelect: () => onSelectWarranty(request) });
    }
    return actions;
  };

  // Función de render (no componente): evita remontar el botón en cada actualización en tiempo real.
  /** Una sola acción principal por fila: asignar cuando la central debe actuar; si no, ver la ficha. */
  const renderPrimaryAction = (request: ServiceRequest) =>
    canAssign(request) ? (
      <button type="button" className="rq-btn rq-btn-primary" onClick={(e) => { e.stopPropagation(); onSelectAssign(request); }}>
        <UserCheck size={15} aria-hidden="true" />
        {request.status === 'REQUIRES_REASSIGNMENT' ? 'Reasignar' : 'Asignar'}
      </button>
    ) : (
      <button type="button" className="rq-btn rq-btn-secondary" onClick={(e) => { e.stopPropagation(); onSelectDetail(request); }}>
        <Eye size={15} aria-hidden="true" />
        Ver ficha
      </button>
    );

  return (
    <section className="table-card-container" aria-label="Bandeja operativa de despacho">
      {loading ? (
        <div className="table-skeleton" role="status" aria-label="Cargando servicios">
          <span className="sr-only">Cargando servicios en tiempo real…</span>
          {Array.from({ length: 8 }).map((_, row) => (
            <div className="skeleton-row" key={row} aria-hidden="true">
              {Array.from({ length: 7 }).map((__, cell) => (
                <span key={cell} className={`skeleton-cell${cell % 3 === 2 ? ' short' : ''}`} />
              ))}
            </div>
          ))}
        </div>
      ) : totalFiltered === 0 ? (
        <div className="table-empty">
          {hasActiveFilters ? <AlertCircle size={32} color="#94a3b8" /> : <CheckCircle2 size={32} color="#16a34a" />}
          <p className="table-empty-title">{hasActiveFilters ? 'No hay servicios con estos filtros' : 'Bandeja al día'}</p>
          <p className="table-empty-subtitle">
            {hasActiveFilters
              ? 'Ajusta el estado, la zona o la búsqueda para ver más registros.'
              : 'No hay solicitudes pendientes de asignación en este momento.'}
          </p>
          {hasActiveFilters && onClearFilters ? (
            <button type="button" className="btn btn-secondary table-empty-action" onClick={onClearFilters}>
              Limpiar filtros
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {/* Tabla de escritorio: 7 columnas, una idea por columna, una acción principal por fila */}
          <div className="rq-table-wrap">
            <table className="rq-table">
              <caption className="sr-only">Solicitudes de servicio. Cada fila tiene un botón principal y un menú de más acciones.</caption>
              <thead>
                <tr>
                  <th scope="col" className="rq-col-code">Solicitud</th>
                  <th scope="col" className="rq-col-client">Cliente</th>
                  <th scope="col" className="rq-col-service">Servicio</th>
                  <th scope="col" className="rq-col-fee">Tarifa</th>
                  <th scope="col" className="rq-col-status">Estado</th>
                  <th scope="col" className="rq-col-tech">Técnico</th>
                  <th scope="col" className="rq-col-actions"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const when = formatDateTime(request.createdAt);
                  const stage = explainStage(request);
                  return (
                    <tr
                      key={request.id}
                      className={`rq-row${request.status === 'REQUIRES_REASSIGNMENT' ? ' is-urgent' : stage.needsAction ? ' needs-action' : ''}`}
                      onClick={() => onSelectDetail(request)}
                    >
                      <td className="rq-col-code">
                        <span className="rq-code mono-tabular">{request.code || 'SOL-PEND'}</span>
                        <span className="rq-sub" title={`Ingresó el ${when.date} a las ${when.time}`}>
                          {CHANNEL_LABELS[request.intakeChannel || 'APP']} · {when.date}
                        </span>
                      </td>

                      <td className="rq-col-client">
                        <span className="rq-main" title={request.clientName || 'Cliente particular'}>
                          {request.clientName || 'Cliente particular'}
                        </span>
                        {request.clientPhone ? (
                          <a
                            className="rq-link mono-tabular"
                            href={whatsappLink(request)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Escribir por WhatsApp al ${request.clientPhone}`}
                          >
                            <MessageCircle size={12} aria-hidden="true" /> {request.clientPhone}
                          </a>
                        ) : (
                          <button
                            type="button"
                            className="rq-link rq-link-muted"
                            onClick={(e) => { e.stopPropagation(); onSelectDetail(request); }}
                          >
                            Sin teléfono · agregar
                          </button>
                        )}
                      </td>

                      <td className="rq-col-service">
                        <span className="rq-main rq-with-icon">
                          {specialtyIcon(request.serviceLabel || request.specialty)}
                          <span title={request.serviceLabel || request.specialty}>{request.serviceLabel || request.specialty || 'Servicio'}</span>
                          {request.urgency === 'NOW' ? <span className="rq-tag-urgent">Urgente</span> : null}
                        </span>
                        <span className="rq-sub rq-with-icon">
                          <MapPin size={12} aria-hidden="true" />
                          {[request.district || 'Lima', zoneLabel(request.zone)].filter(Boolean).join(' · ')}
                        </span>
                      </td>

                      <td className="rq-col-fee">
                        <span className="rq-fee mono-tabular">{getDisplayPrice(request)}</span>
                        <span className="rq-sub">{request.price_agreed ? 'Acordada' : 'Visita deducible'}</span>
                      </td>

                      <td className="rq-col-status">
                        <StatusCell request={request} onOpen={openStatus} />
                      </td>

                      <td className="rq-col-tech">
                        {request.providerName ? (
                          <span className="rq-main" title={request.providerName}>{request.providerName}</span>
                        ) : (
                          <span className="rq-unassigned">{request.providerId ? 'Técnico asignado' : 'Sin asignar'}</span>
                        )}
                      </td>

                      <td className="rq-col-actions" onClick={(e) => e.stopPropagation()}>
                        <div className="rq-actions">
                          {renderPrimaryAction(request)}
                          <RowActionsMenu label={`Más acciones de ${request.code || request.id}`} actions={buildActions(request)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Tarjetas para pantallas pequeñas */}
          <div className="mobile-cards-list">
            {requests.map((request) => (
              <article
                key={request.id}
                className={`rq-card${request.status === 'REQUIRES_REASSIGNMENT' ? ' is-urgent' : ''}`}
                onClick={() => onSelectDetail(request)}
              >
                <div className="rq-card-head">
                  <span className="rq-code mono-tabular">{request.code || 'SOL-PEND'}</span>
                  <StatusBadge status={request.status} size="sm" />
                </div>
                <div className="rq-card-row">
                  <strong className="rq-main">{request.clientName || 'Cliente particular'}</strong>
                  <span className="rq-fee mono-tabular">{getDisplayPrice(request)}</span>
                </div>
                <p className="rq-sub">
                  {request.serviceLabel || request.specialty} · {request.district || 'Lima'} · {request.providerName || 'Sin técnico'}
                </p>
                <div className="rq-actions" onClick={(e) => e.stopPropagation()}>
                  {renderPrimaryAction(request)}
                  <button type="button" className="rq-btn rq-btn-ghost" onClick={() => openStatus(request)}>
                    Ver estado
                  </button>
                  <RowActionsMenu label={`Más acciones de ${request.code || request.id}`} actions={buildActions(request)} />
                </div>
              </article>
            ))}
          </div>

          {/* Paginación */}
          <div className="table-pagination-bar">
            <div className="pagination-count">
              <span>
                Mostrando <strong>{(currentPage - 1) * pageSize + 1}</strong> -{' '}
                <strong>{Math.min(currentPage * pageSize, totalFiltered)}</strong> de <strong>{totalFiltered}</strong> solicitudes
              </span>
            </div>

            <div className="pagination-controls">
              <div className="page-size-selector">
                <label htmlFor="rq-page-size">Por página:</label>
                <select
                  id="rq-page-size"
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="page-select"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="pagination-nav-buttons">
                <button type="button" className="btn-page-nav" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1} aria-label="Página anterior">
                  <ChevronLeft size={15} />
                </button>
                <span className="page-current-indicator mono-tabular">{currentPage} / {totalPages || 1}</span>
                <button type="button" className="btn-page-nav" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages} aria-label="Página siguiente">
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {statusRequest ? (
        <StatusDetailModal request={statusRequest} onClose={closeStatus} onOpenDetail={onSelectDetail} onAssign={onSelectAssign} />
      ) : null}
    </section>
  );
};
