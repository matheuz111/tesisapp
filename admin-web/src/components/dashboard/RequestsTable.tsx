import React from 'react';
import type { ServiceRequest, IntakeChannel } from '../../types';
import { StatusBadge } from '../StatusBadge';
import { SlaTrafficBadge } from '../SlaTrafficBadge';
import {
  Eye,
  FileText,
  MessageSquare,
  Navigation,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  PhoneCall,
  Phone,
  MessageCircle,
  RefreshCw,
  AlertCircle,
  Hash,
  Clock,
  User,
  Wrench,
  Receipt,
  Activity,
  Zap,
  Paintbrush,
  Hammer,
  KeyRound,
  HardHat,
  Smartphone,
  Globe,
  Mail,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Calendar,
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
  const formatDateTime = (val: any) => {
    if (!val) return { date: '—', time: '' };
    const date = val.toDate ? val.toDate() : new Date(val);
    if (isNaN(date.getTime())) return { date: '—', time: '' };
    const d = date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const t = date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    return { date: d, time: t };
  };

  const getDisplayPrice = (req: ServiceRequest) => {
    if (req.price_agreed && req.price_agreed.trim().length > 0) {
      const match = req.price_agreed.match(/(\d+(?:\.\d{1,2})?)/);
      if (match) {
        return `S/ ${parseFloat(match[1]).toFixed(2)}`;
      }
      return req.price_agreed;
    }
    const pricing = resolveRequestCanonicalPricing(req);
    return `S/ ${pricing.fee.toFixed(2)}`;
  };

  const getSpecialtyIcon = (specialty?: string) => {
    const s = (specialty || '').toLowerCase();
    if (s.includes('gasf')) return <Wrench size={13} color="#0369a1" />;
    if (s.includes('elec')) return <Zap size={13} color="#d97706" />;
    if (s.includes('pint')) return <Paintbrush size={13} color="#7c3aed" />;
    if (s.includes('carp')) return <Hammer size={13} color="#b45309" />;
    if (s.includes('cerr')) return <KeyRound size={13} color="#059669" />;
    if (s.includes('alba')) return <HardHat size={13} color="#475569" />;
    return <Wrench size={13} color="#0369a1" />;
  };

  const getChannelBadge = (channel?: IntakeChannel) => {
    switch (channel) {
      case 'WHATSAPP':
        return { icon: <MessageSquare size={11} color="#16a34a" />, label: 'WhatsApp', cls: 'channel-badge-whatsapp' };
      case 'PHONE':
        return { icon: <Phone size={11} color="#0369a1" />, label: 'Llamada', cls: 'channel-badge-phone' };
      case 'EMAIL':
        return { icon: <Mail size={11} color="#64748b" />, label: 'Correo', cls: 'channel-badge-email' };
      case 'WEB':
        return { icon: <Globe size={11} color="#0284c7" />, label: 'Web', cls: 'channel-badge-web' };
      case 'APP':
      default:
        return { icon: <Smartphone size={11} color="#0369a1" />, label: 'App', cls: 'channel-badge-app' };
    }
  };

  const getWarrantyStatus = (req: ServiceRequest) => {
    if (!['COMPLETED', 'VALIDATED'].includes(req.status)) return null;
    const base = req.validatedAt || req.finishedAt || req.createdAt;
    if (!base) return { active: true, label: 'Garantía 30d' };
    const d = base.toDate ? base.toDate() : new Date(base);
    const exp = new Date(d.getTime() + 30 * 24 * 60 * 60 * 1000);
    const isActive = Date.now() <= exp.getTime();
    return {
      active: isActive,
      label: isActive ? 'Garantía Activa' : 'Garantía Vencida',
      expiryDate: exp.toLocaleDateString('es-PE', { dateStyle: 'short' }),
    };
  };

  return (
    <section className="table-card-container" aria-label="Bandeja operativa de despacho">
      {loading ? (
        <div className="table-loading" role="status">
          <RefreshCw size={22} className="spinner" />
          <span>Cargando servicios en tiempo real desde Firestore...</span>
        </div>
      ) : totalFiltered === 0 ? (
        <div className="table-empty">
          <AlertCircle size={32} color="#94a3b8" />
          <p className="table-empty-title">No se encontraron servicios</p>
          <p className="table-empty-subtitle">
            Ajusta los filtros de estado o zona, o limpia el término de búsqueda para ver más registros.
          </p>
        </div>
      ) : (
        <>
          {/* 1. Vista de Tabla Fluida para Escritorio — Ajuste al 100% sin scroll horizontal */}
          <div className="table-auto-fit-wrap">
            <table className="compact-work-table">
              <thead>
                <tr>
                  <th className="th-code"><Hash size={12} /> Solicitud</th>
                  <th className="th-date"><Clock size={12} /> Ingreso</th>
                  <th className="th-client"><User size={12} /> Cliente / Contacto</th>
                  <th className="th-service"><Wrench size={12} /> Servicio & Zona</th>
                  <th className="th-fee"><Receipt size={12} /> Tarifa</th>
                  <th className="th-status"><Activity size={12} /> Estado & SLA</th>
                  <th className="th-tech"><UserCheck size={12} /> Técnico</th>
                  <th className="th-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => {
                  const warrantyInfo = getWarrantyStatus(req);
                  const isReassign = req.status === 'REQUIRES_REASSIGNMENT';
                  const ch = getChannelBadge(req.intakeChannel);

                  return (
                    <tr
                      key={req.id}
                      className={`work-row ${isReassign ? 'work-row-urgent' : ''}`}
                      onClick={() => onSelectDetail(req)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onSelectDetail(req);
                      }}
                      role="button"
                      aria-label={`Ver detalle del servicio ${req.code || req.id}`}
                    >
                      {/* Col 1: Solicitud (Código + Canal integrado) */}
                      <td className="td-code">
                        <div className="code-channel-combo">
                          <span className="code-pill mono-tabular">
                            {req.code || 'SOL-PEND'}
                          </span>
                          <span className={`channel-pill-inline ${ch.cls}`}>
                            {ch.icon}
                            <span>{ch.label}</span>
                          </span>
                        </div>
                      </td>

                      {/* Col 2: Fecha de Ingreso (Hora debajo de la Fecha) */}
                      <td className="td-date">
                        {(() => {
                          const { date, time } = formatDateTime(req.createdAt);
                          return (
                            <div className="date-cell-stacked mono-tabular">
                              <span className="date-main">{date}</span>
                              {time && <span className="date-time">{time}</span>}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Col 3: Cliente / Contacto */}
                      <td className="td-client" onClick={(e) => e.stopPropagation()}>
                        <div className="client-cell-compact">
                          <span className="client-title" title={req.clientName || 'Cliente Particular'}>
                            {req.clientName || 'Cliente Particular'}
                          </span>
                          {req.clientPhone ? (
                            <a
                              href={`https://wa.me/51${req.clientPhone.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(
                                req.clientName || ''
                              )},%20te%20saludamos%20de%20la%20Central%20de%20Maestro%20a%20Domicilio%20respecto%20a%20tu%20solicitud%20${encodeURIComponent(
                                req.code || ''
                              )}.`}
                              target="_blank"
                              rel="noreferrer"
                              className="client-whatsapp-pill mono-tabular"
                              title="Contactar al cliente por WhatsApp"
                            >
                              <MessageCircle size={10} color="#16a34a" />
                              <span>{req.clientPhone}</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              className="btn-missing-phone"
                              onClick={() => onSelectDetail(req)}
                              title="Hacer clic para registrar teléfono del cliente"
                            >
                              <PhoneCall size={10} />
                              <span>Registrar tel.</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Col 4: Especialidad & Distrito */}
                      <td className="td-service">
                        <div className="service-cell-compact">
                          <div className="service-title-row">
                            {getSpecialtyIcon(req.serviceLabel || req.specialty)}
                            <span className="service-title-text">{req.serviceLabel || req.specialty}</span>
                          </div>
                          <span className="service-location-text">
                            {req.district || 'Lima'} {req.zone ? `· ${req.zone.replace('LIMA_', '')}` : ''}
                          </span>
                          {req.urgency === 'NOW' ? (
                            <span className="urgency-pill-now">
                              <AlertTriangle size={10} /> Urgente
                            </span>
                          ) : req.urgency === 'TODAY' ? (
                            <span className="urgency-pill-today">
                              <Calendar size={10} /> Hoy
                            </span>
                          ) : req.urgency === 'SCHEDULED' ? (
                            <span className="urgency-pill-scheduled">
                              <Clock size={10} /> Programado
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Col 5: Cotización / Tarifa */}
                      <td className="td-fee">
                        <div className="fee-cell-compact">
                          <span className="fee-amount mono-tabular">
                            {getDisplayPrice(req)}
                          </span>
                          <span className="fee-subtitle">
                            {req.price_agreed ? 'Acordada' : 'Visita deducible'}
                          </span>
                        </div>
                      </td>

                      {/* Col 6: Estado & Semáforo SLA */}
                      <td className="td-status">
                        <div className="status-cell-compact">
                          <StatusBadge status={req.status} size="sm" />
                          <SlaTrafficBadge request={req} />
                          {warrantyInfo && (
                            <span
                              className={`warranty-pill-tag ${warrantyInfo.active ? 'warranty-tag-active' : 'warranty-tag-expired'}`}
                              title={warrantyInfo.active ? `Garantía activa hasta el ${warrantyInfo.expiryDate}` : `Garantía expirada el ${warrantyInfo.expiryDate}`}
                            >
                              {warrantyInfo.active ? <ShieldCheck size={10} /> : <ShieldAlert size={10} />}
                              <span>{warrantyInfo.label}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Col 7: Técnico Asignado */}
                      <td className="td-tech">
                        <span className={`tech-cell-text ${req.providerName ? 'has-tech' : 'unassigned'}`}>
                          {req.providerName || (req.providerId ? 'Técnico Asignado' : 'Sin Asignar')}
                        </span>
                      </td>

                      {/* Col 8: Barra Compacta de Acciones */}
                      <td className="td-actions" onClick={(e) => e.stopPropagation()}>
                        <div className="action-buttons-toolbar">
                          {/* Botón Principal: Ver Ficha Técnica */}
                          <button
                            type="button"
                            className="btn-action-primary"
                            onClick={() => onSelectDetail(req)}
                            title="Abrir ficha técnica y trazabilidad completa"
                          >
                            <Eye size={15} />
                            <span>Ver</span>
                          </button>

                          {/* Botón Icono: Cotizar */}
                          <button
                            type="button"
                            className="btn-action-icon"
                            onClick={() => onSelectQuote(req)}
                            title="Generar e imprimir proforma de cotización"
                          >
                            <FileText size={15} />
                          </button>

                          {/* Botón Icono: Ruta GPS */}
                          <button
                            type="button"
                            className="btn-action-icon"
                            onClick={() => onSelectTracking(req)}
                            title="Ver monitoreo en ruta y telemetría GPS"
                          >
                            <Navigation size={15} />
                          </button>

                          {/* Botón Icono: Chat */}
                          <button
                            type="button"
                            className="btn-action-icon btn-action-chat"
                            onClick={() => onSelectChat(req)}
                            title="Chat en vivo con cliente o técnico"
                          >
                            <MessageSquare size={15} />
                          </button>

                          {/* Botón Icono: Garantía (Si completado) */}
                          {['COMPLETED', 'VALIDATED'].includes(req.status) && (
                            <button
                              type="button"
                              className="btn-action-icon btn-action-warranty"
                              onClick={() => onSelectWarranty(req)}
                              title="Emitir certificado de garantía de 30 días"
                            >
                              <ShieldCheck size={15} />
                            </button>
                          )}

                          {/* Botón Icono: Asignar (Si pendiente) */}
                          {['PENDING_ASSIGNMENT', 'PENDING', 'REQUIRES_REASSIGNMENT'].includes(req.status) && (
                            <button
                              type="button"
                              className="btn-action-icon btn-action-assign"
                              onClick={() => onSelectAssign(req)}
                              title="Asignar técnico de cuadrilla propia"
                            >
                              <UserCheck size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 2. Vista de Tarjetas Responsiva para Móvil (<768px) */}
          <div className="mobile-cards-list">
            {requests.map((req) => {
              const warrantyInfo = getWarrantyStatus(req);
              const isReassign = req.status === 'REQUIRES_REASSIGNMENT';

              return (
                <article
                  key={req.id}
                  className={`mobile-request-card ${isReassign ? 'card-reassign-urgent' : ''}`}
                  onClick={() => onSelectDetail(req)}
                  tabIndex={0}
                >
                  <div className="mobile-card-header">
                    <span className="code-pill mono-tabular">{req.code || 'SOL-PEND'}</span>
                    <StatusBadge status={req.status} size="sm" />
                  </div>

                  <div className="mobile-card-body">
                    <div className="mobile-card-row">
                      <strong className="mobile-client-name">{req.clientName || 'Cliente Particular'}</strong>
                      <span className="fee-amount mono-tabular">{getDisplayPrice(req)}</span>
                    </div>

                    <p className="mobile-service-line">
                      {req.serviceLabel || req.specialty} · {req.district || 'Lima'}
                    </p>

                    <div className="mobile-card-meta">
                      <SlaTrafficBadge request={req} />
                      <span className="mobile-tech-name">
                        {req.providerName || 'Sin técnico'}
                      </span>
                    </div>

                    {warrantyInfo && (
                      <div style={{ marginTop: 6 }}>
                        <span className={`warranty-pill-tag ${warrantyInfo.active ? 'warranty-tag-active' : 'warranty-tag-expired'}`}>
                          {warrantyInfo.active ? <ShieldCheck size={10} /> : <ShieldAlert size={10} />}
                          <span>{warrantyInfo.label}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mobile-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn-action-primary"
                      onClick={() => onSelectDetail(req)}
                    >
                      <Eye size={13} />
                      <span>Ver Ficha</span>
                    </button>

                    {['PENDING_ASSIGNMENT', 'REQUIRES_REASSIGNMENT'].includes(req.status) && (
                      <button
                        type="button"
                        className="btn-action-icon btn-action-assign"
                        onClick={() => onSelectAssign(req)}
                        title="Asignar cuadrilla"
                      >
                        <UserCheck size={13} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {/* Paginación Estandarizada */}
          <div className="table-pagination-bar">
            <div className="pagination-count">
              <span>
                Mostrando <strong>{(currentPage - 1) * pageSize + 1}</strong> -{' '}
                <strong>{Math.min(currentPage * pageSize, totalFiltered)}</strong> de{' '}
                <strong>{totalFiltered}</strong> solicitudes
              </span>
            </div>

            <div className="pagination-controls">
              <div className="page-size-selector">
                <span>Por página:</span>
                <select
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
                <button
                  type="button"
                  className="btn-page-nav"
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                  title="Página anterior"
                >
                  <ChevronLeft size={15} />
                </button>

                <span className="page-current-indicator mono-tabular">
                  {currentPage} / {totalPages || 1}
                </span>

                <button
                  type="button"
                  className="btn-page-nav"
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  title="Página siguiente"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
