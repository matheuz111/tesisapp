import { useState, lazy, Suspense, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { ErrorBoundary } from './ErrorBoundary';

// Dynamic lazy imports for all admin modals and heavy analytics charts
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

import { useServiceRequests } from '../hooks/useServiceRequests';
import { SummaryCards } from './dashboard/SummaryCards';
import { RequestFilters } from './dashboard/RequestFilters';
import { RequestsTable } from './dashboard/RequestsTable';

export const Dashboard = () => {
  const { userName, role, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Custom Hook for State & Business Logic
  const {
    requests,
    filteredRequests,
    paginatedRequests,
    loading,
    stats,
    filters,
    pagination,
  } = useServiceRequests();

  const [showCharts, setShowCharts] = useState(true);

  // Modales
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isSpssModalOpen, setIsSpssModalOpen] = useState(false);
  const [isBaremoOpen, setIsBaremoOpen] = useState(false);
  const [isOperationalMapOpen, setIsOperationalMapOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [assigningRequest, setAssigningRequest] = useState<ServiceRequest | null>(null);
  const [assigningProviderId, setAssigningProviderId] = useState<string | null>(null);
  const [trackingRequest, setTrackingRequest] = useState<ServiceRequest | null>(null);
  const [chatRequest, setChatRequest] = useState<ServiceRequest | null>(null);
  const [quoteRequest, setQuoteRequest] = useState<ServiceRequest | null>(null);
  const [warrantyRequest, setWarrantyRequest] = useState<ServiceRequest | null>(null);

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close Más acciones menu on outside click
  useEffect(() => {
    if (!isMoreMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMoreMenuOpen]);

  return (
    <div className="dashboard-layout">
      {/* Barra de Navegación Personalizada con Identidad de Marca */}
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
            <span className="btn-label-responsive">{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
          </button>

          {/* Botón Mapa Operativo (Fase 2) */}
          <button
            type="button"
            className="btn btn-secondary btn-map-toggle"
            style={{ color: '#2563eb', borderColor: '#93c5fd' }}
            onClick={() => setIsOperationalMapOpen(true)}
            title="Abrir mapa operativo en vivo con presencia de técnicos y solicitudes"
          >
            <Map size={15} color="#2563eb" />
            <span className="btn-label-responsive">Mapa Operativo</span>
          </button>

          {/* Botón Nuevo Pedido (Acción Primaria) */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsNewModalOpen(true)}
          >
            <PlusCircle size={15} />
            <span>Nuevo Pedido</span>
          </button>

          {/* Acciones Secundarias de Escritorio (Ocultas en pantallas pequeñas) */}
          <button
            type="button"
            className="btn btn-secondary nav-action-desktop"
            onClick={() => setShowCharts((prev) => !prev)}
            title="Alternar gráficos estadísticos"
          >
            <BarChart3 size={15} />
            <span>{showCharts ? 'Ocultar Gráficos' : 'Ver Gráficos'}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary nav-action-desktop"
            onClick={() => setIsBaremoOpen(true)}
            title="Abrir catálogo y baremo estandarizado de precios"
          >
            <BookOpen size={15} />
            <span>Baremo & Precios</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary nav-action-desktop"
            style={{ color: '#16a34a', borderColor: '#86efac' }}
            onClick={() => setIsSpssModalOpen(true)}
          >
            <FileSpreadsheet size={15} color="#16a34a" />
            <span>Matriz SPSS</span>
          </button>

          <button
            type="button"
            className="btn btn-outline nav-action-desktop"
            onClick={logout}
            title="Cerrar Sesión"
          >
            <LogOut size={15} />
          </button>

          {/* Menú Más Acciones (Visible en pantallas compactas para evitar ensanchamiento) */}
          <div className="nav-more-menu-container" ref={moreMenuRef}>
            <button
              type="button"
              className="btn btn-secondary nav-more-trigger"
              onClick={() => setIsMoreMenuOpen((prev) => !prev)}
              aria-haspopup="true"
              aria-expanded={isMoreMenuOpen}
              title="Más acciones y herramientas del sistema"
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
                    setShowCharts((prev) => !prev);
                    setIsMoreMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  <BarChart3 size={15} color="#2563eb" />
                  <span>{showCharts ? 'Ocultar Gráficos' : 'Ver Gráficos'}</span>
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
                  <BookOpen size={15} color="#0284c7" />
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

                <div className="nav-dropdown-divider" />

                <button
                  type="button"
                  className="nav-dropdown-item text-danger"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
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

      {/* Contenido Principal */}
      <main className="dashboard-content">
        {/* Ribbon de Métricas Clave Unificado */}
        <SummaryCards stats={stats} />

        {/* Gráficos Estadísticos Minimalistas 2x2 con Suspense Lazy */}
        {showCharts && (
          <Suspense fallback={<div className="charts-loading-banner">Cargando gráficos analíticos...</div>}>
            <AnalyticsCharts requests={requests} />
          </Suspense>
        )}

        {/* Barra de Filtros, Zonas y Búsqueda */}
        <RequestFilters
          searchTerm={filters.searchTerm}
          onSearchChange={filters.setSearchTerm}
          statusFilter={filters.statusFilter}
          onStatusChange={filters.setStatusFilter}
          channelFilter={filters.channelFilter}
          onChannelChange={filters.setChannelFilter}
          zoneFilter={filters.zoneFilter}
          onZoneChange={filters.setZoneFilter}
        />

        {/* Tabla de Solicitudes Modular */}
        <RequestsTable
          loading={loading}
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
      </main>

      {/* Modales Administrativos Cargados Dinámicamente con Suspense */}
      <Suspense fallback={null}>
        {isNewModalOpen && (
          <NewManualRequestModal
            isOpen={isNewModalOpen}
            onClose={() => setIsNewModalOpen(false)}
            onCreated={(code) => {
              alert(`¡Solicitud ${code} registrada exitosamente!`);
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

        {/* Mapa Operativo en Vivo (Fase 2) */}
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
