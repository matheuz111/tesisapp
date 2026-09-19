import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { ServiceRequest } from '../types';
import {
  ShieldCheck,
  LogOut,
  PlusCircle,
  FileSpreadsheet,
  Search,
  X,
  AlertCircle,
  MessageCircle,
  Eye,
  RefreshCw,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sun,
  Moon,
  Navigation,
  UserCheck,
  MessageSquare,
  BookOpen,
  FileText,
  Camera,
  Percent,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { formatStatus } from '../types';
import { AnalyticsCharts } from './AnalyticsCharts';
import { NewManualRequestModal } from './NewManualRequestModal';
import { ServiceDetailModal } from './ServiceDetailModal';
import { SpssExporterModal } from './SpssExporterModal';
import { AssignWorkerModal } from './AssignWorkerModal';
import { LiveTrackingMapModal } from './LiveTrackingMapModal';
import { RealtimeChatModal } from './RealtimeChatModal';
import { ProformaQuoteModal } from './ProformaQuoteModal';
import { BaremoCatalogModal } from './BaremoCatalogModal';
import { WarrantyCertificateModal } from './WarrantyCertificateModal';
import { BrandLogo } from './BrandLogo';

export const Dashboard = () => {
  const { userName, role, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [showCharts, setShowCharts] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modales
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isSpssModalOpen, setIsSpssModalOpen] = useState(false);
  const [isBaremoOpen, setIsBaremoOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [assigningRequest, setAssigningRequest] = useState<ServiceRequest | null>(null);
  const [trackingRequest, setTrackingRequest] = useState<ServiceRequest | null>(null);
  const [chatRequest, setChatRequest] = useState<ServiceRequest | null>(null);
  const [quoteRequest, setQuoteRequest] = useState<ServiceRequest | null>(null);
  const [warrantyRequest, setWarrantyRequest] = useState<ServiceRequest | null>(null);

  // Reiniciar a página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, channelFilter, pageSize]);

  // Escuchar solicitudes en tiempo real
  useEffect(() => {
    setLoading(true);
    const requestsRef = collection(db, 'service_requests');
    const q = query(requestsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: ServiceRequest[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as ServiceRequest[];
        setRequests(list);
        setLoading(false);
      },
      (error) => {
        console.error('Error escuchando solicitudes:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Métricas Consolidadas Minimalistas
  const stats = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => ['PENDING_ASSIGNMENT', 'QUOTED', 'REQUIRES_REASSIGNMENT'].includes(r.status)).length;
    const inProgress = requests.filter((r) => ['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(r.status)).length;
    const completed = requests.filter((r) => ['COMPLETED', 'VALIDATED'].includes(r.status)).length;
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(0) : '0';
    
    const photoEvidences = requests.filter((r) => r.issuePhoto || r.evidencePhoto || (r as any).evidence_photo).length;
    const auditRate = total > 0 ? ((photoEvidences / total) * 100).toFixed(0) : '0';

    return { total, pending, inProgress, completed, completionRate, photoEvidences, auditRate };
  }, [requests]);

  // Filtrado de la tabla
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Filtro de estado
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'PENDING' && !['PENDING_ASSIGNMENT', 'QUOTED', 'REQUIRES_REASSIGNMENT'].includes(r.status)) return false;
        if (statusFilter === 'IN_PROGRESS' && !['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(r.status)) return false;
        if (statusFilter === 'COMPLETED' && !['COMPLETED', 'VALIDATED'].includes(r.status)) return false;
        if (statusFilter === 'WARRANTY' && !['COMPLETED', 'VALIDATED'].includes(r.status)) return false;
        if (statusFilter === 'CANCELLED' && !r.status.startsWith('CANCELLED')) return false;
      }

      // Filtro de canal
      if (channelFilter !== 'ALL') {
        const ch = r.intakeChannel || 'APP';
        if (ch !== channelFilter) return false;
      }

      // Búsqueda por texto
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const code = (r.code || '').toLowerCase();
        const client = (r.clientName || '').toLowerCase();
        const district = (r.district || '').toLowerCase();
        const specialty = (r.serviceLabel || r.specialty || '').toLowerCase();
        const id = r.id.toLowerCase();
        return code.includes(term) || client.includes(term) || district.includes(term) || specialty.includes(term) || id.includes(term);
      }

      return true;
    });
  }, [requests, statusFilter, channelFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  const formatDate = (val: any) => {
    if (!val) return '—';
    const date = val.toDate ? val.toDate() : new Date(val);
    return isNaN(date.getTime()) ? '—' : date.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
  };

  const getStatusBadgeClass = (status: string) => {
    if (status === 'COMPLETED' || status === 'VALIDATED') return 'status-completed';
    if (status === 'IN_PROGRESS' || status === 'ACCEPTED') return 'status-in-progress';
    if (status.startsWith('CANCELLED')) return 'status-cancelled';
    return 'status-pending';
  };

  return (
    <div className="dashboard-layout">
      {/* Barra de Navegación Personalizada con Identidad de Marca */}
      <header className="navbar">
        <div className="navbar-brand">
          <BrandLogo height={32} />
          <div className="brand-divider" style={{ width: 1, height: 26, background: 'var(--border)', margin: '0 8px' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Central de Despacho & Trazabilidad
            </span>
            <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600 }}>
              ● Reparamos Tu Hogar · Lima, Perú
            </span>
          </div>
          <a
            href="https://wa.me/51924167911"
            target="_blank"
            rel="noreferrer"
            className="company-phone-badge"
            title="Línea directa oficial de la empresa"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(34, 197, 94, 0.12)',
              color: '#16a34a',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              padding: '4px 10px',
              borderRadius: 20,
              fontSize: '11px',
              fontWeight: 700,
              textDecoration: 'none',
              marginLeft: 8,
            }}
          >
            <MessageCircle size={13} color="#16a34a" />
            <span>924-167-911</span>
          </a>
        </div>

        <div className="navbar-actions">
          <div className="user-badge">
            <div className="user-avatar">{userName?.charAt(0).toUpperCase() || 'O'}</div>
            <div className="user-info">
              <span className="user-name">{userName}</span>
              <span className="user-role">{role}</span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-theme"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            <span>{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowCharts((prev) => !prev)}
            title="Alternar gráficos estadísticos"
          >
            <BarChart3 size={15} />
            <span>{showCharts ? 'Ocultar Gráficos' : 'Ver Gráficos'}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsBaremoOpen(true)}
            title="Abrir catálogo y baremo estandarizado de precios"
          >
            <BookOpen size={15} />
            <span>Baremo & Precios</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsNewModalOpen(true)}
          >
            <PlusCircle size={15} />
            <span>Nuevo Pedido</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ color: '#16a34a', borderColor: '#86efac' }}
            onClick={() => setIsSpssModalOpen(true)}
          >
            <FileSpreadsheet size={15} color="#16a34a" />
            <span>Matriz SPSS</span>
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={logout}
            title="Cerrar Sesión"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="dashboard-content">
        {/* Ribbon de Métricas Clave Unificado (4 Tarjetas Limpias) */}
        <section className="kpi-grid-minimal">
          <div className="kpi-card-clean">
            <div className="kpi-clean-icon">
              <RefreshCw size={18} color="#2563eb" />
            </div>
            <div className="kpi-clean-body">
              <span className="kpi-clean-label">Total Solicitudes</span>
              <div className="kpi-clean-value-wrap">
                <span className="kpi-clean-value">{stats.total}</span>
                <span className="kpi-clean-sub">{stats.pending} por atender</span>
              </div>
            </div>
          </div>

          <div className="kpi-card-clean">
            <div className="kpi-clean-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
              <Percent size={18} color="#10b981" />
            </div>
            <div className="kpi-clean-body">
              <span className="kpi-clean-label">Tasa de Culminación</span>
              <div className="kpi-clean-value-wrap">
                <span className="kpi-clean-value">{stats.completionRate}%</span>
                <span className="kpi-clean-sub">{stats.completed} exitosas</span>
              </div>
            </div>
          </div>

          <div className="kpi-card-clean">
            <div className="kpi-clean-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
              <Camera size={18} color="#6366f1" />
            </div>
            <div className="kpi-clean-body">
              <span className="kpi-clean-label">Auditoría Fotográfica</span>
              <div className="kpi-clean-value-wrap">
                <span className="kpi-clean-value">{stats.auditRate}%</span>
                <span className="kpi-clean-sub">{stats.photoEvidences} con fotos</span>
              </div>
            </div>
          </div>

          <div className="kpi-card-clean">
            <div className="kpi-clean-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
              <ShieldCheck size={18} color="#f59e0b" />
            </div>
            <div className="kpi-clean-body">
              <span className="kpi-clean-label">Garantías Activas 30d</span>
              <div className="kpi-clean-value-wrap">
                <span className="kpi-clean-value">{stats.completed}</span>
                <span className="kpi-clean-sub">Respaldadas</span>
              </div>
            </div>
          </div>
        </section>
        
        {/* Gráficos Estadísticos Minimalistas 2x2 */}
        {showCharts && <AnalyticsCharts requests={requests} />}

        {/* Barra de Filtros y Búsqueda Angular Material 3 Style */}
        <section className="table-controls" style={{ display: 'flex', gap: 14, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="mat-search-container">
            <Search size={18} className="mat-search-icon" />
            <input
              type="text"
              className="mat-search-input"
              placeholder="Buscar por código (ej. SOL-POST-0001), cliente, teléfono, distrito o especialidad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="mat-search-clear"
                onClick={() => setSearchTerm('')}
                title="Limpiar búsqueda"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="mat-segmented-group">
              {[
                { id: 'ALL', label: 'Todos' },
                { id: 'PENDING', label: 'Por Atender' },
                { id: 'IN_PROGRESS', label: 'En Proceso' },
                { id: 'COMPLETED', label: 'Culminados' },
                { id: 'WARRANTY', label: '🛡️ Garantías 30d' },
                { id: 'CANCELLED', label: 'Cancelados' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`mat-segmented-btn ${statusFilter === tab.id ? 'active' : ''}`}
                  onClick={() => setStatusFilter(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select
              className="select-channel-clean"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              style={{ borderRadius: 20, padding: '7px 14px', height: 38, border: '1.5px solid var(--mat-outline)' }}
            >
              <option value="ALL">Canal: Todos</option>
              <option value="APP">📱 App Cliente</option>
              <option value="WHATSAPP">💬 WhatsApp</option>
              <option value="PHONE">📞 Llamada</option>
              <option value="EMAIL">✉️ Correo</option>
            </select>
          </div>
        </section>

        {/* Tabla de Solicitudes Angular Material Table */}
        <section className="table-container">
          {loading ? (
            <div className="table-loading">
              <RefreshCw size={24} className="spinner" />
              <span>Cargando solicitudes desde Firestore...</span>
            </div>
          ) : filteredRequests.length === 0 ? (
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
                    {paginatedRequests.map((req) => (
                      <tr key={req.id}>
                        <td>
                          <span className="badge badge-code">{req.code || 'SOL-POST-PEND'}</span>
                        </td>
                        <td>
                          <span className="channel-pill">
                            {req.intakeChannel === 'WHATSAPP' ? '💬 WhatsApp' :
                             req.intakeChannel === 'PHONE' ? '📞 Llamada' :
                             req.intakeChannel === 'EMAIL' ? '✉️ Correo' : '📱 App'}
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
                                href={`https://wa.me/51${req.clientPhone.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(req.clientName || '')},%20te%20saludamos%20de%20la%20Central%20de%20Maestro%20a%20Domicilio%20respecto%20a%20tu%20solicitud%20${encodeURIComponent(req.code || '')}.`}
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
                          <span className="price-tag">{req.price_agreed || 'S/. 50.00 (Visita)'}</span>
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
                              onClick={() => setSelectedRequest(req)}
                              title="Ver Ficha y Trazabilidad"
                            >
                              <Eye size={13} />
                              <span>Detalle</span>
                            </button>

                            {/* Cotización Proforma PDF */}
                            <button
                              type="button"
                              className="mat-btn-action mat-btn-quote"
                              onClick={() => setQuoteRequest(req)}
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
                                onClick={() => setWarrantyRequest(req)}
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
                              onClick={() => setTrackingRequest(req)}
                              title="Centro de Control y Monitoreo en Ruta"
                            >
                              <Navigation size={13} />
                              <span>Ruta</span>
                            </button>

                            {/* Chat en Vivo */}
                            <button
                              type="button"
                              className="mat-icon-btn-action btn-chat-track"
                              onClick={() => setChatRequest(req)}
                              title="Ver Chat en Tiempo Real"
                            >
                              <MessageSquare size={14} />
                            </button>

                            {/* Asignar Trabajador */}
                            {['PENDING_ASSIGNMENT', 'PENDING', 'REQUIRES_REASSIGNMENT'].includes(req.status) && (
                              <button
                                type="button"
                                className="mat-btn-action mat-btn-assign btn-assign-action"
                                onClick={() => setAssigningRequest(req)}
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
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="mat-paginator-select"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <div className="mat-paginator-range">
                  {filteredRequests.length === 0 ? '0 de 0' : `${(currentPage - 1) * pageSize + 1} – ${Math.min(currentPage * pageSize, filteredRequests.length)} de ${filteredRequests.length}`}
                </div>

                <div className="mat-paginator-nav">
                  <button
                    type="button"
                    className="mat-paginator-btn"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    title="Primera página"
                  >
                    <ChevronsLeft size={16} />
                  </button>
                  <button
                    type="button"
                    className="mat-paginator-btn"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    title="Página siguiente"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button
                    type="button"
                    className="mat-paginator-btn"
                    onClick={() => setCurrentPage(totalPages)}
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
      </main>

      {/* Modales */}
      <NewManualRequestModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onCreated={(code) => {
          alert(`¡Solicitud ${code} registrada exitosamente!`);
        }}
      />

      <ServiceDetailModal
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
      />

      <SpssExporterModal
        isOpen={isSpssModalOpen}
        onClose={() => setIsSpssModalOpen(false)}
      />

      <BaremoCatalogModal
        isOpen={isBaremoOpen}
        onClose={() => setIsBaremoOpen(false)}
      />

      {quoteRequest && (
        <ProformaQuoteModal
          request={quoteRequest}
          onClose={() => setQuoteRequest(null)}
        />
      )}

      {warrantyRequest && (
        <WarrantyCertificateModal
          request={warrantyRequest}
          onClose={() => setWarrantyRequest(null)}
        />
      )}

      {assigningRequest && (
        <AssignWorkerModal
          request={assigningRequest}
          onClose={() => setAssigningRequest(null)}
        />
      )}

      {trackingRequest && (
        <LiveTrackingMapModal
          request={trackingRequest}
          onClose={() => setTrackingRequest(null)}
        />
      )}

      {chatRequest && (
        <RealtimeChatModal
          request={chatRequest}
          onClose={() => setChatRequest(null)}
        />
      )}
    </div>
  );
};
