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
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  Smartphone,
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
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [assigningRequest, setAssigningRequest] = useState<ServiceRequest | null>(null);
  const [trackingRequest, setTrackingRequest] = useState<ServiceRequest | null>(null);
  const [chatRequest, setChatRequest] = useState<ServiceRequest | null>(null);

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

  // KPIs
  const stats = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => ['PENDING_ASSIGNMENT', 'QUOTED', 'REQUIRES_REASSIGNMENT'].includes(r.status)).length;
    const inProgress = requests.filter((r) => ['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(r.status)).length;
    const completed = requests.filter((r) => ['COMPLETED', 'VALIDATED'].includes(r.status)).length;
    const whatsapp = requests.filter((r) => r.intakeChannel === 'WHATSAPP').length;
    const phone = requests.filter((r) => r.intakeChannel === 'PHONE').length;
    const app = requests.filter((r) => !r.intakeChannel || r.intakeChannel === 'APP').length;

    return { total, pending, inProgress, completed, whatsapp, phone, app };
  }, [requests]);

  // Filtrado de la tabla
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Filtro de estado
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'PENDING' && !['PENDING_ASSIGNMENT', 'QUOTED', 'REQUIRES_REASSIGNMENT'].includes(r.status)) return false;
        if (statusFilter === 'IN_PROGRESS' && !['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(r.status)) return false;
        if (statusFilter === 'COMPLETED' && !['COMPLETED', 'VALIDATED'].includes(r.status)) return false;
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
      {/* Barra de Navegación Superior */}
      <header className="navbar">
        <div className="navbar-brand">
          <div className="logo-badge">
            <ShieldCheck size={24} color="#0284c7" />
          </div>
          <div>
            <h1 className="brand-title">MAESTRO A DOMICILIO</h1>
            <span className="brand-subtitle">Panel Central de Operaciones & Métricas SPSS</span>
          </div>
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
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowCharts((prev) => !prev)}
            title="Alternar gráficos estadísticos"
          >
            <BarChart3 size={16} />
            <span>{showCharts ? 'Ocultar Gráficos' : 'Ver Gráficos'}</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsNewModalOpen(true)}
          >
            <PlusCircle size={16} />
            <span>Nuevo Pedido Manual</span>
          </button>

          <button
            type="button"
            className="btn btn-success"
            onClick={() => setIsSpssModalOpen(true)}
          >
            <FileSpreadsheet size={16} />
            <span>Exportar Matriz SPSS</span>
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={logout}
            title="Cerrar Sesión"
          >
            <LogOut size={16} />
            <span>Salir</span>
          </button>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="dashboard-content">
        {/* Fila de Tarjetas KPI */}
        <section className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon-wrap icon-blue">
              <RefreshCw size={20} />
            </div>
            <div className="kpi-details">
              <span className="kpi-value">{stats.total}</span>
              <span className="kpi-label">Total Solicitudes</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon-wrap icon-amber">
              <Clock size={20} />
            </div>
            <div className="kpi-details">
              <span className="kpi-value">{stats.pending}</span>
              <span className="kpi-label">Por Asignar / Cotizar</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon-wrap icon-indigo">
              <Smartphone size={20} />
            </div>
            <div className="kpi-details">
              <span className="kpi-value">{stats.inProgress}</span>
              <span className="kpi-label">En Ejecución / Camino</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon-wrap icon-green">
              <CheckCircle2 size={20} />
            </div>
            <div className="kpi-details">
              <span className="kpi-value">{stats.completed}</span>
              <span className="kpi-label">Culminadas con Éxito</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon-wrap icon-emerald">
              <MessageCircle size={20} />
            </div>
            <div className="kpi-details">
              <span className="kpi-value">{stats.whatsapp + stats.phone}</span>
              <span className="kpi-label">Multicanal (WhatsApp/Tel)</span>
            </div>
          </div>
        </section>
        
        {/* Gráficos Estadísticos */}
        {showCharts && <AnalyticsCharts requests={requests} />}

        {/* Barra de Filtros y Búsqueda */}
        <section className="table-controls">
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por código (ej. SOL-POST-0001), cliente, distrito o especialidad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <div className="status-tabs">
              {[
                { id: 'ALL', label: 'Todos' },
                { id: 'PENDING', label: 'Por Asignar' },
                { id: 'IN_PROGRESS', label: 'En Curso' },
                { id: 'COMPLETED', label: 'Completados' },
                { id: 'CANCELLED', label: 'Cancelados' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`tab-button ${statusFilter === tab.id ? 'active' : ''}`}
                  onClick={() => setStatusFilter(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select
              className="select-channel"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
            >
              <option value="ALL">Canal: Todos</option>
              <option value="APP">📱 App Cliente</option>
              <option value="WHATSAPP">💬 WhatsApp</option>
              <option value="PHONE">📞 Llamada</option>
              <option value="EMAIL">✉️ Correo</option>
            </select>
          </div>
        </section>

        {/* Tabla de Solicitudes */}
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
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Canal</th>
                    <th>Fecha Registro</th>
                    <th>Cliente</th>
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
                      <td>{formatDate(req.createdAt)}</td>
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
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn-action"
                            onClick={() => setSelectedRequest(req)}
                            title="Ver Ficha y Trazabilidad"
                          >
                            <Eye size={14} />
                            <span>Detalle</span>
                          </button>

                          <button
                            type="button"
                            className="btn-action btn-map-track"
                            onClick={() => setTrackingRequest(req)}
                            title="Ver Seguimiento en Vivo tipo inDrive"
                          >
                            <Navigation size={14} />
                            <span>Mapa</span>
                          </button>

                          <button
                            type="button"
                            className="btn-action btn-chat-track"
                            onClick={() => setChatRequest(req)}
                            title="Ver Chat Cliente ↔ Trabajador en Tiempo Real"
                          >
                            <MessageSquare size={14} />
                            <span>Chat</span>
                          </button>

                          {['PENDING_ASSIGNMENT', 'PENDING', 'REQUIRES_REASSIGNMENT'].includes(req.status) && (
                            <button
                              type="button"
                              className="btn-action btn-assign-action"
                              onClick={() => setAssigningRequest(req)}
                              title="Asignar trabajador y aceptar solicitud"
                            >
                              <UserCheck size={14} />
                              <span>Asignar</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pagination-bar">
                <div className="pagination-info">
                  <span>
                    Mostrando {filteredRequests.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} a {Math.min(currentPage * pageSize, filteredRequests.length)} de {filteredRequests.length} solicitudes
                  </span>
                  <div className="page-size-selector">
                    <label>Por página:</label>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="select-page-size"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>

                <div className="pagination-actions">
                  <button
                    type="button"
                    className="btn-page"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    title="Primera página"
                  >
                    <ChevronsLeft size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn-page"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    title="Página anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <span className="page-indicator">
                    Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
                  </span>

                  <button
                    type="button"
                    className="btn-page"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    title="Página siguiente"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn-page"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
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
