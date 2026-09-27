import React from 'react';
import type { ServiceRequest } from '../../types';
import { formatStatus } from '../../types';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  FileText,
  MessageCircle,
  MessageSquare,
  Navigation,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { resolveRequestCanonicalPricing } from '../../services/pricingPolicyService';

interface RequestsTableProps {
  loading: boolean;
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

export const RequestsTable: React.FC<RequestsTableProps> = ({
  loading,
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
  const formatDate = (val: any) => {
    if (!val) return '—';
    const date = val.toDate ? val.toDate() : new Date(val);
    return isNaN(date.getTime())
      ? '—'
      : date.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
  };

  const getStatusBadgeClass = (status: string) => {
    if (status === 'COMPLETED' || status === 'VALIDATED') return 'status-completed';
    if (status === 'IN_PROGRESS' || status === 'ACCEPTED') return 'status-in-progress';
    if (status.startsWith('CANCELLED')) return 'status-cancelled';
    return 'status-pending';
  };

  const getDisplayPrice = (req: ServiceRequest) => {
    return resolveRequestCanonicalPricing(req).formatted;
  };

  return (
    <section className="table-container">
      {loading ? (
        <div className="table-loading">
          <RefreshCw size={24} className="spinner" />
          <span>Cargando solicitudes desde Firestore...</span>
        </div>
      ) : totalFiltered === 0 ? (
        <div className="table-empty">
          <AlertCircle size={32} color="#94a3b8" />
          <p>No se encontraron solicitudes que coincidan con los filtros aplicados.</p>
        </div>
      ) : (
        <>
          <div className="table-scroll-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Canal</th>
                  <th>Fecha Registro</th>
                  <th>Cliente & Contacto</th>
                  <th>Servicio & Distrito</th>
                  <th>Cotización / Tarifa</th>
                  <th>Estado</th>
                  <th>Técnico</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id}>
                    <td>
                      <span className="badge badge-code">{req.code || 'SOL-POST-PEND'}</span>
                    </td>
                    <td>
                      <span className="channel-pill">
                        {req.intakeChannel === 'WHATSAPP'
                          ? '💬 WhatsApp'
                          : req.intakeChannel === 'PHONE'
                          ? '📞 Llamada'
                          : req.intakeChannel === 'EMAIL'
                          ? '✉️ Correo'
                          : '📱 App'}
                      </span>
                    </td>
                    <td>
                      <span className="date-cell">{formatDate(req.createdAt)}</span>
                    </td>
                    <td>
                      <div className="client-cell">
                        <span className="client-name">{req.clientName || 'Cliente'}</span>
                        {req.clientPhone ? (
                          <a
                            href={`https://wa.me/51${req.clientPhone.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(
                              req.clientName || ''
                            )},%20te%20saludamos%20de%20la%20Central%20de%20Maestro%20a%20Domicilio%20respecto%20a%20tu%20solicitud%20${encodeURIComponent(
                              req.code || ''
                            )}.`}
                            target="_blank"
                            rel="noreferrer"
                            className="client-phone-link"
                            title="Contactar al cliente por WhatsApp directo"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MessageCircle size={12} color="#22c55e" />
                            <span>{req.clientPhone}</span>
                          </a>
                        ) : (
                          <span className="client-sub">Sin teléfono</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="service-cell">
                        <span className="service-name">{req.serviceLabel || req.specialty}</span>
                        <span className="service-district">{req.district || 'Lima'}</span>
                        {req.urgency === 'NOW' ? (
                          <span className="urgency-badge urgency-now">⚡ Urgente</span>
                        ) : req.urgency === 'TODAY' ? (
                          <span className="urgency-badge urgency-today">📅 Hoy</span>
                        ) : req.urgency === 'SCHEDULED' ? (
                          <span className="urgency-badge urgency-scheduled">🕒 Programado</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <span className="price-tag">{getDisplayPrice(req)}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span className={`status-badge ${getStatusBadgeClass(req.status)}`}>
                          <span className="status-dot" />
                          <span>{formatStatus(req.status)}</span>
                        </span>
                        {['COMPLETED', 'VALIDATED'].includes(req.status) && (
                          <span className="warranty-badge" title="Garantía de calidad de 30 días vigente">
                            <ShieldCheck size={11} />
                            <span>Garantía 30d</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="provider-text">
                        {req.providerName || (req.providerId ? 'Asignado' : 'Sin asignar')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div className="table-actions-cluster">
                        {/* Detalle */}
                        <button
                          type="button"
                          className="mat-btn-action mat-btn-detail"
                          onClick={() => onSelectDetail(req)}
                          title="Ver Ficha y Trazabilidad"
                        >
                          <Eye size={13} />
                          <span>Detalle</span>
                        </button>

                        {/* Cotización Proforma PDF */}
                        <button
                          type="button"
                          className="mat-btn-action mat-btn-quote"
                          onClick={() => onSelectQuote(req)}
                          title="Generar e imprimir Cotización / Proforma Formal"
                        >
                          <FileText size={13} />
                          <span>Cotizar</span>
                        </button>

                        {/* Certificado de Garantía (Si completado) */}
                        {['COMPLETED', 'VALIDATED'].includes(req.status) && (
                          <button
                            type="button"
                            className="mat-btn-action mat-btn-warranty"
                            onClick={() => onSelectWarranty(req)}
                            title="Ver y Emitir Certificado de Garantía 30 Días"
                          >
                            <ShieldCheck size={13} />
                            <span>Garantía</span>
                          </button>
                        )}

                        {/* Centro de Control y Monitoreo */}
                        <button
                          type="button"
                          className="mat-btn-action mat-btn-route btn-map-track"
                          onClick={() => onSelectTracking(req)}
                          title="Centro de Control y Monitoreo en Ruta"
                        >
                          <Navigation size={13} />
                          <span>Ruta</span>
                        </button>

                        {/* Chat en Vivo */}
                        <button
                          type="button"
                          className="mat-icon-btn-action btn-chat-track"
                          onClick={() => onSelectChat(req)}
                          title="Ver Chat en Tiempo Real"
                        >
                          <MessageSquare size={14} />
                        </button>

                        {/* Asignar Trabajador */}
                        {['PENDING_ASSIGNMENT', 'PENDING', 'REQUIRES_REASSIGNMENT'].includes(
                          req.status
                        ) && (
                          <button
                            type="button"
                            className="mat-btn-action mat-btn-assign btn-assign-action"
                            onClick={() => onSelectAssign(req)}
                            title="Asignar técnico"
                          >
                            <UserCheck size={13} />
                            <span>Asignar</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Angular Material Paginator */}
          <div className="mat-paginator">
            <div className="mat-paginator-size">
              <span>Filas por página:</span>
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="mat-paginator-select"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="mat-paginator-range">
              {totalFiltered === 0
                ? '0 de 0'
                : `${(currentPage - 1) * pageSize + 1} – ${Math.min(
                    currentPage * pageSize,
                    totalFiltered
                  )} de ${totalFiltered}`}
            </div>

            <div className="mat-paginator-nav">
              <button
                type="button"
                className="mat-paginator-btn"
                onClick={() => onPageChange(1)}
                disabled={currentPage === 1}
                title="Primera página"
              >
                <ChevronsLeft size={16} />
              </button>
              <button
                type="button"
                className="mat-paginator-btn"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                title="Página anterior"
              >
                <ChevronLeft size={16} />
              </button>

              <span style={{ fontSize: '12px', padding: '0 8px', fontWeight: 600 }}>
                {currentPage} / {totalPages || 1}
              </span>

              <button
                type="button"
                className="mat-paginator-btn"
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                title="Página siguiente"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                className="mat-paginator-btn"
                onClick={() => onPageChange(totalPages)}
                disabled={currentPage === totalPages || totalPages === 0}
                title="Última página"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
