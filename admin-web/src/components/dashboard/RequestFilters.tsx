import React from 'react';
import { Search, X, MapPin } from 'lucide-react';
import type { OperationalZone } from '../../types';

interface RequestFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  channelFilter: string;
  onChannelChange: (channel: string) => void;
  zoneFilter: OperationalZone | 'ALL';
  onZoneChange: (zone: OperationalZone | 'ALL') => void;
}

const STATUS_TABS = [
  { id: 'ALL', label: 'Todos' },
  { id: 'PENDING', label: 'Por Atender' },
  { id: 'IN_PROGRESS', label: 'En Proceso' },
  { id: 'COMPLETED', label: 'Culminados' },
  { id: 'WARRANTY', label: '🛡️ Garantías 30d' },
  { id: 'CANCELLED', label: 'Cancelados' },
];

export const RequestFilters: React.FC<RequestFiltersProps> = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  channelFilter,
  onChannelChange,
  zoneFilter,
  onZoneChange,
}) => {
  return (
    <section
      className="table-controls"
      style={{
        display: 'flex',
        gap: 14,
        marginBottom: 16,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      {/* Search Input */}
      <div className="mat-search-container">
        <Search size={18} className="mat-search-icon" />
        <input
          type="text"
          className="mat-search-input"
          placeholder="Buscar por código (ej. SOL-POST-0001), cliente, teléfono, distrito o especialidad..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchTerm && (
          <button
            type="button"
            className="mat-search-clear"
            onClick={() => onSearchChange('')}
            title="Limpiar búsqueda"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Segmented Status Tabs & Dropdowns */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="mat-segmented-group">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`mat-segmented-btn ${statusFilter === tab.id ? 'active' : ''}`}
              onClick={() => onStatusChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Operational Zone Filter */}
        <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
          <select
            className="select-channel-clean"
            value={zoneFilter}
            onChange={(e) => onZoneChange(e.target.value as OperationalZone | 'ALL')}
            style={{
              borderRadius: 20,
              padding: '7px 14px 7px 32px',
              height: 38,
              border: '1.5px solid var(--mat-outline)',
            }}
            title="Filtrar por Zona Operativa"
          >
            <option value="ALL">📍 Zona: Todas</option>
            <option value="LIMA_NORTE">Lima Norte</option>
            <option value="LIMA_CENTRO">Lima Centro</option>
            <option value="LIMA_SUR">Lima Sur</option>
            <option value="LIMA_ESTE">Lima Este</option>
            <option value="CALLAO">Callao</option>
          </select>
          <MapPin
            size={14}
            style={{
              position: 'absolute',
              left: 11,
              pointerEvents: 'none',
              color: 'var(--text-muted)',
            }}
          />
        </div>

        {/* Intake Channel Filter */}
        <select
          className="select-channel-clean"
          value={channelFilter}
          onChange={(e) => onChannelChange(e.target.value)}
          style={{
            borderRadius: 20,
            padding: '7px 14px',
            height: 38,
            border: '1.5px solid var(--mat-outline)',
          }}
          title="Filtrar por Canal de Ingreso"
        >
          <option value="ALL">Canal: Todos</option>
          <option value="APP">📱 App Cliente</option>
          <option value="WHATSAPP">💬 WhatsApp</option>
          <option value="PHONE">📞 Llamada</option>
          <option value="EMAIL">✉️ Correo</option>
        </select>
      </div>
    </section>
  );
};
