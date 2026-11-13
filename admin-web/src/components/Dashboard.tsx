import { useState, lazy, Suspense, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { ServiceRequest } from '../types';
import {
  LogOut,
  PlusCircle,
  FileSpreadsheet,
  MessageCircle,
  BarChart3,
  Sun,
  Moon,
  BookOpen,
  Map,
  MoreVertical,
  ClipboardCopy,
  ChevronDown,
  LayoutGrid,
  AlertCircle,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { ErrorBoundary } from './ErrorBoundary';
import { ToastContainer, type ToastItem } from './Toast';

// Modales y vistas analíticas cargadas dinámicamente con lazy
const AnalyticsCharts = lazy(() =>
  import('./AnalyticsCharts').then((m) => ({ default: m.AnalyticsCharts }))
);
const NewManualRequestModal = lazy(() =>
  import('./NewManualRequestModal').then((m) => ({ default: m.NewManualRequestModal }))
);
const ServiceDetailModal = lazy(() =>
  import('./ServiceDetailModal').then((m) => ({ default: m.ServiceDetailModal }))
);
const SpssExporterModal = lazy(() =>
  import('./SpssExporterModal').then((m) => ({ default: m.SpssExporterModal }))
);
const AssignWorkerModal = lazy(() =>
  import('./AssignWorkerModal').then((m) => ({ default: m.AssignWorkerModal }))
);
const LiveTrackingMapModal = lazy(() =>
  import('./LiveTrackingMapModal').then((m) => ({ default: m.LiveTrackingMapModal }))
);
const RealtimeChatModal = lazy(() =>
  import('./RealtimeChatModal').then((m) => ({ default: m.RealtimeChatModal }))
);
const ProformaQuoteModal = lazy(() =>
  import('./ProformaQuoteModal').then((m) => ({ default: m.ProformaQuoteModal }))
);
const BaremoCatalogModal = lazy(() =>
  import('./BaremoCatalogModal').then((m) => ({ default: m.BaremoCatalogModal }))
);
const WarrantyCertificateModal = lazy(() =>
  import('./WarrantyCertificateModal').then((m) => ({ default: m.WarrantyCertificateModal }))
);
const OperationalMapModal = lazy(() =>
  import('./OperationalMapModal').then((m) => ({ default: m.OperationalMapModal }))
);
const GoogleSheetsModal = lazy(() =>
  import('./GoogleSheetsModal').then((m) => ({ default: m.GoogleSheetsModal }))
);

import { useServiceRequests } from '../hooks/useServiceRequests';
import { purgeExpiredScans } from '../services/warrantyCertificateService';
import { SummaryCards } from './dashboard/SummaryCards';
import { RequestFilters } from './dashboard/RequestFilters';
import { RequestsTable } from './dashboard/RequestsTable';
import { TelemetryBar } from './dashboard/TelemetryBar';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

type ActiveTab = 'OPERATION' | 'ANALYTICS';

export const Dashboard = () => {
  const { userName, role, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isOnline = useNetworkStatus();

  // Custom Hook para Datos y Lógica de Negocio
  const {
    requests,
    filteredRequests,
    paginatedRequests,
    loading,
    error,
    retry,
    hasActiveFilters,
    clearFilters,
    stats,
    filters,
    pagination,
  } = useServiceRequests({ onNewReassignments: (list) => notifyReassignments(list) });

  // Mantenimiento diario sin intervención: borra registros de escaneo con más de 12 meses.
  useEffect(() => { void purgeExpiredScans(); }, []);

  // Pestaña principal de navegación
  const [activeTab, setActiveTab] = useState<ActiveTab>('OPERATION');

  // Sistema de Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const addToast = useCallback((type: ToastItem['type'], title: string, message?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
  }, []);
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /** Aviso inmediato cuando un técnico rechaza o devuelve una solicitud. */
  function notifyReassignments(list: ServiceRequest[]) {
    for (const req of list.slice(0, 3)) {
      const reason = req.rejectionReasonText || req.rejectionReason;
      addToast(
        'error',
        'Reasignación necesaria',
        `ALERTA: el técnico rechazó la solicitud ${req.code || req.id}${reason ? ` (${reason})` : ''}. Reasignar de inmediato.`,
      );
    }
  }

  // Modales
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isSpssModalOpen, setIsSpssModalOpen] = useState(false);
  const [isGoogleSheetsOpen, setIsGoogleSheetsOpen] = useState(false);
  const [isBaremoOpen, setIsBaremoOpen] = useState(false);
  const [isOperationalMapOpen, setIsOperationalMapOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [assigningRequest, setAssigningRequest] = useState<ServiceRequest | null>(null);
  const [assigningProviderId, setAssigningProviderId] = useState<string | null>(null);
  const [trackingRequest, setTrackingRequest] = useState<ServiceRequest | null>(null);
  const [chatRequest, setChatRequest] = useState<ServiceRequest | null>(null);
  const [quoteRequest, setQuoteRequest] = useState<ServiceRequest | null>(null);
  const [warrantyRequest, setWarrantyRequest] = useState<ServiceRequest | null>(null);

  // Menús desplegables
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Cerrar menús al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Atajos de teclado globales: '/' enfocar buscador, 'N' nuevo pedido, 'Esc' cerrar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      if (e.key === 'Escape') {
        setIsNewModalOpen(false);
        setIsSpssModalOpen(false);
        setIsBaremoOpen(false);
        setIsOperationalMapOpen(false);
        setSelectedRequest(null);
        setAssigningRequest(null);
        setTrackingRequest(null);
        setChatRequest(null);
        setQuoteRequest(null);
        setWarrantyRequest(null);
        setIsMoreMenuOpen(false);
        setIsUserMenuOpen(false);
        return;
      }

      if (isInput) return;

      if (e.key === '/' || e.key === '?') {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('.search-input');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        if (isOnline) setIsNewModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOnline]);

  const copyCompanyPhone = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText('924167911');
    addToast('success', 'Número Copiado', '924-167-911 copiado al portapapeles.');
  };

  return (
    <div className="dashboard-layout">
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Barra de Navegación Priority+ con Identidad de Marca y Pestañas */}
      <header className="navbar">
        <div className="navbar-brand">
          <BrandLogo height={32} />
          <div
            className="brand-divider"
            style={{ width: 1, height: 26, background: 'var(--border)', margin: '0 8px' }}
          />
          <div className="brand-text-container" style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
              }}
            >
              Central de Despacho & Trazabilidad
            </span>
            <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600 }}>
              ● Reparamos Tu Hogar · Lima & Callao
            </span>
          </div>

          {/* Chip de Teléfono Central con Copiado Rápido */}
          <button
            type="button"
            onClick={copyCompanyPhone}
            className="company-phone-badge"
            title="Click para copiar número de la central (924-167-911)"
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
              cursor: 'pointer',
              marginLeft: 8,
            }}
          >
            <MessageCircle size={13} color="#16a34a" />
            <span className="mono-tabular">924-167-911</span>
            <ClipboardCopy size={11} style={{ opacity: 0.7 }} />
          </button>
        </div>

        {/* Pestañas Principales Priority+ */}
        <nav className="nav-priority-tabs" aria-label="Navegación principal">
          <button
            type="button"
            className={`nav-tab-item ${activeTab === 'OPERATION' ? 'active' : ''}`}
            onClick={() => setActiveTab('OPERATION')}
          >
            <LayoutGrid size={15} />
            <span>Operación</span>
            <span className="nav-tab-count mono-tabular">{stats.total}</span>
          </button>

          <button
            type="button"
            className={`nav-tab-item ${activeTab === 'ANALYTICS' ? 'active' : ''}`}
            onClick={() => setActiveTab('ANALYTICS')}
          >
            <BarChart3 size={15} />
            <span>Analítica</span>
          </button>

          <button
            type="button"
            className="nav-tab-item nav-action-desktop"
            onClick={() => setIsOperationalMapOpen(true)}
            title="Abrir mapa operativo con cobertura de cuadrantes"
          >
            <Map size={15} />
            <span>Mapa Operativo</span>
          </button>

          <button
            type="button"
            className="nav-tab-item nav-action-desktop"
            onClick={() => setIsBaremoOpen(true)}
            title="Abrir catálogo y baremo estandarizado de precios"
          >
            <BookOpen size={15} />
            <span>Baremo & Precios</span>
          </button>

          <button
            type="button"
            className="nav-tab-item nav-action-desktop"
            style={{ color: '#16a34a' }}
            onClick={() => setIsSpssModalOpen(true)}
            title="Exportar matriz completa para análisis SPSS de tesis"
          >
            <FileSpreadsheet size={15} color="#16a34a" />
            <span>Matriz SPSS</span>
          </button>

          <button
            type="button"
            className="nav-tab-item nav-action-desktop"
            style={{ color: '#0284c7' }}
            onClick={() => setIsGoogleSheetsOpen(true)}
            title="Abrir y sincronizar directorio en vivo con Google Sheets"
          >
            <FileSpreadsheet size={15} color="#0284c7" />
            <span>Directorio Sheets</span>
          </button>
        </nav>

        {/* Acciones del Extremo Derecho */}
        <div className="navbar-actions">
          {/* Botón Primario Único: Nuevo Pedido */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => isOnline && setIsNewModalOpen(true)}
            disabled={!isOnline}
            title="Nuevo Pedido Manual (Atajo: N)"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <PlusCircle size={15} />
            <span>Nuevo Pedido</span>
            <kbd
              style={{
                fontSize: 10,
                padding: '1px 5px',
                borderRadius: 4,
                background: 'rgba(255,255,255,0.22)',
                border: '1px solid rgba(255,255,255,0.4)',
                color: '#fff',
              }}
            >
              N
            </kbd>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
            style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 8px' }}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Menú Más Acciones en Pantallas Pequeñas */}
          <div className="nav-more-menu-container" ref={moreMenuRef}>
            <button
              type="button"
              className="btn btn-secondary nav-more-trigger"
              onClick={() => setIsMoreMenuOpen((prev) => !prev)}
              aria-haspopup="true"
              aria-expanded={isMoreMenuOpen}
              title="Más herramientas"
            >
              <MoreVertical size={16} />
              <span>Más</span>
            </button>

            {isMoreMenuOpen && (
              <div className="nav-more-dropdown" role="menu">
                <button
                  type="button"
                  className="nav-dropdown-item"
                  onClick={() => {
                    setIsOperationalMapOpen(true);
                    setIsMoreMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  <Map size={15} color="#0369a1" />
                  <span>Mapa Operativo</span>
                </button>

                <button
                  type="button"
                  className="nav-dropdown-item"
                  onClick={() => {
                    setIsBaremoOpen(true);
                    setIsMoreMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  <BookOpen size={15} color="#0369a1" />
                  <span>Baremo & Precios</span>
                </button>

                <button
                  type="button"
                  className="nav-dropdown-item"
                  onClick={() => {
                    setIsSpssModalOpen(true);
                    setIsMoreMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  <FileSpreadsheet size={15} color="#16a34a" />
                  <span>Matriz SPSS</span>
                </button>

                <button
                  type="button"
                  className="nav-dropdown-item"
                  onClick={() => {
                    setIsGoogleSheetsOpen(true);
                    setIsMoreMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  <FileSpreadsheet size={15} color="#0284c7" />
                  <span>Directorio Google Sheets</span>
                </button>
              </div>
            )}
          </div>

          {/* Menú de Usuario y Tema */}
          <div className="nav-user-menu-container" ref={userMenuRef}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px' }}
              aria-haspopup="true"
              aria-expanded={isUserMenuOpen}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                {userName?.charAt(0).toUpperCase() || 'O'}
              </div>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{userName || 'Operador'}</span>
              <ChevronDown size={13} style={{ opacity: 0.6 }} />
            </button>

            {isUserMenuOpen && (
              <div className="nav-more-dropdown" role="menu" style={{ right: 0, minWidth: 200 }}>
                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>{userName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Rol: {role}</div>
                </div>

                <button
                  type="button"
                  className="nav-dropdown-item"
                  onClick={() => {
                    toggleTheme();
                    setIsUserMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                  <span>Modo {theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
                </button>

                <div className="nav-dropdown-divider" />

                <button
                  type="button"
                  className="nav-dropdown-item text-danger"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    logout();
                  }}
                  role="menuitem"
                >
                  <LogOut size={15} color="#dc2626" />
                  <span style={{ color: '#dc2626' }}>Cerrar Sesión</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <TelemetryBar
        stats={stats}
        isOnline={isOnline}
        onShowReassign={() => { filters.setStatusFilter('PENDING'); setActiveTab('OPERATION'); }}
      />

      {/* Contenedor Principal Centrado con Restricción de Ancho Máximo */}
      <main className="dashboard-content app-container">
        {/* VISTA 1: OPERACIÓN (Bandeja de Despacho Prioritaria) */}
        {activeTab === 'OPERATION' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error ? (
              <div className="error-banner" role="alert">
                <AlertCircle size={20} aria-hidden="true" />
                <div className="error-banner-text">
                  <strong>Se perdió la conexión con la base de datos</strong>
                  <span>{error}</span>
                </div>
                <button type="button" className="btn btn-primary" onClick={retry}>
                  Reconectar ahora
                </button>
              </div>
            ) : null}

            {/* Indicadores operativos clave */}
            <SummaryCards stats={stats} />

            {/* Barra de Filtros, Zonas y Búsqueda Inmediata */}
            <RequestFilters
              searchTerm={filters.searchTerm}
              onSearchChange={filters.setSearchTerm}
              statusFilter={filters.statusFilter}
              onStatusChange={filters.setStatusFilter}
              channelFilter={filters.channelFilter}
              onChannelChange={filters.setChannelFilter}
              zoneFilter={filters.zoneFilter}
              onZoneChange={filters.setZoneFilter}
              districtFilter={filters.districtFilter}
              onDistrictChange={filters.setDistrictFilter}
            />

            {/* Tabla de Trabajo Visible de Inmediato sin Scroll Forzado */}
            <RequestsTable
              loading={loading}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearFilters}
              requests={paginatedRequests}
              totalFiltered={filteredRequests.length}
              currentPage={pagination.currentPage}
              pageSize={pagination.pageSize}
              totalPages={pagination.totalPages}
              onPageChange={pagination.setCurrentPage}
              onPageSizeChange={pagination.setPageSize}
              onSelectDetail={setSelectedRequest}
              onSelectQuote={setQuoteRequest}
              onSelectWarranty={setWarrantyRequest}
              onSelectTracking={setTrackingRequest}
              onSelectChat={setChatRequest}
              onSelectAssign={setAssigningRequest}
            />
          </div>
        )}

        {/* VISTA 2: ANALÍTICA (Panel Analítico Dedicado) */}
        {activeTab === 'ANALYTICS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SummaryCards stats={stats} showAudit />
            <Suspense fallback={<div className="charts-loading-banner">Cargando métricas analíticas...</div>}>
              <AnalyticsCharts requests={requests} />
            </Suspense>
          </div>
        )}
      </main>

      {/* Modales y Paneles Deslizantes Cargados Dinámicamente */}
      <Suspense fallback={null}>
        {isNewModalOpen && (
          <NewManualRequestModal
            isOpen={isNewModalOpen}
            onClose={() => setIsNewModalOpen(false)}
            onCreated={(code) => {
              addToast('success', 'Pedido Registrado', `Solicitud ${code} creada exitosamente en la central.`);
            }}
          />
        )}

        {selectedRequest && (
          <ServiceDetailModal
            request={selectedRequest}
            onClose={() => setSelectedRequest(null)}
          />
        )}

        {isSpssModalOpen && (
          <SpssExporterModal
            isOpen={isSpssModalOpen}
            onClose={() => setIsSpssModalOpen(false)}
          />
        )}

        {isBaremoOpen && (
          <BaremoCatalogModal
            isOpen={isBaremoOpen}
            onClose={() => setIsBaremoOpen(false)}
          />
        )}

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
            initialProviderId={assigningProviderId}
            onAssigned={({ workerName }) => {
              const zone = assigningRequest.zone ? ` (${String(assigningRequest.zone).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())})` : '';
              addToast('success', 'Asignación confirmada', `${assigningRequest.code || assigningRequest.id} despachada a técnico ${workerName}${zone}.`);
            }}
            onClose={() => {
              setAssigningRequest(null);
              setAssigningProviderId(null);
            }}
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

        {isGoogleSheetsOpen && (
          <GoogleSheetsModal
            isOpen={isGoogleSheetsOpen}
            onClose={() => setIsGoogleSheetsOpen(false)}
          />
        )}

        {isOperationalMapOpen && (
          <ErrorBoundary
            fallbackTitle="Error en Mapa Operativo"
            onReset={() => setIsOperationalMapOpen(false)}
          >
            <OperationalMapModal
              isOpen={isOperationalMapOpen}
              onClose={() => setIsOperationalMapOpen(false)}
              requests={requests}
              onAssignRequest={(req, providerId) => {
                setIsOperationalMapOpen(false);
                setAssigningProviderId(providerId || null);
                setAssigningRequest(req);
              }}
            />
          </ErrorBoundary>
        )}
      </Suspense>
    </div>
  );
};
