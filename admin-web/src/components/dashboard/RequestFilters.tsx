import React from 'react';
import { Search, X, MapPin, Building2, Filter } from 'lucide-react';
import type { OperationalZone } from '../../types';
import { COMPLETE_DISTRICTS_CATALOG } from '../../config/operationalConfig';

interface RequestFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  channelFilter: string;
  onChannelChange: (channel: string) => void;
  zoneFilter: OperationalZone | 'ALL';
  onZoneChange: (zone: OperationalZone | 'ALL') => void;
  districtFilter?: string;
  onDistrictChange?: (district: string) => void;
}

const STATUS_TABS = [
  { id: 'ALL', label: 'Todos' },
  { id: 'PENDING', label: 'Por Atender' },
  { id: 'IN_PROGRESS', label: 'En Proceso' },
  { id: 'COMPLETED', label: 'Culminados' },
  { id: 'WARRANTY', label: 'Garantías 30d' },
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
  districtFilter = 'ALL',
  onDistrictChange,
}) => {
  return (
    <section className="table-controls" aria-label="Controles de búsqueda y filtros">
      {/* Search Input con atajo '/' */}
      <div className="mat-search-container">
        <Search size={16} className="mat-search-icon" />
        <input
          type="text"
          className="mat-search-input"
          placeholder="Buscar código (SOL-POST-xxxx), cliente, teléfono, distrito o labor..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Buscar solicitudes"
        />
        {!searchTerm ? (
          <kbd
            className="kbd-shortcut"
            title="Presiona / para enfocar la búsqueda"
          >
            /
          </kbd>
        ) : (
          <button
            type="button"
            className="mat-search-clear"
            onClick={() => onSearchChange('')}
            title="Limpiar búsqueda"
            aria-label="Limpiar búsqueda"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Segmented Status Tabs & Dropdowns */}
      <div className="filters-right-cluster">
        {/* Pestañas de estado segmentadas */}
        <div className="mat-segmented-group" role="tablist" aria-label="Filtro por estado de atención">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={statusFilter === tab.id}
              className={`mat-segmented-btn ${statusFilter === tab.id ? 'active' : ''}`}
              onClick={() => onStatusChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Selector de Zona Operativa */}
        <div className="select-pill-wrapper">
          <MapPin size={13} className="select-pill-icon" />
          <select
            className="select-channel-clean select-zone-pill"
            value={zoneFilter}
            onChange={(e) => onZoneChange(e.target.value as OperationalZone | 'ALL')}
            title="Filtrar por Zona Operativa"
            aria-label="Filtrar por Zona Operativa"
          >
            <option value="ALL">Zona: Todas</option>
            <option value="LIMA_NORTE">Lima Norte</option>
            <option value="LIMA_CENTRO">Lima Centro</option>
            <option value="LIMA_SUR">Lima Sur</option>
            <option value="LIMA_ESTE">Lima Este</option>
            <option value="CALLAO">Callao</option>
          </select>
        </div>

        {/* 50 Distritos de Lima y Callao agrupados por zona */}
        {onDistrictChange && (
          <div className="select-pill-wrapper">
            <Building2 size={13} className="select-pill-icon" />
            <select
              className="select-channel-clean select-district-pill"
              value={districtFilter}
              onChange={(e) => onDistrictChange(e.target.value)}
              title="Filtrar por Distrito (50 distritos homologados)"
              aria-label="Filtrar por Distrito"
            >
              <option value="ALL">Distrito: Todos (50)</option>
              <optgroup label="Lima Norte (8 distritos)">
                {COMPLETE_DISTRICTS_CATALOG.filter((d) => d.zone === 'LIMA_NORTE').map((d) => (
                  <option key={d.code} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Lima Centro (14 distritos)">
                {COMPLETE_DISTRICTS_CATALOG.filter((d) => d.zone === 'LIMA_CENTRO').map((d) => (
                  <option key={d.code} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Lima Sur (12 distritos)">
                {COMPLETE_DISTRICTS_CATALOG.filter((d) => d.zone === 'LIMA_SUR').map((d) => (
                  <option key={d.code} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Lima Este (9 distritos)">
                {COMPLETE_DISTRICTS_CATALOG.filter((d) => d.zone === 'LIMA_ESTE').map((d) => (
                  <option key={d.code} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Callao (7 distritos)">
                {COMPLETE_DISTRICTS_CATALOG.filter((d) => d.zone === 'CALLAO').map((d) => (
                  <option key={d.code} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        )}

        {/* Filtro por Canal de Ingreso */}
        <div className="select-pill-wrapper">
          <Filter size={13} className="select-pill-icon" />
          <select
            className="select-channel-clean select-channel-pill"
            value={channelFilter}
            onChange={(e) => onChannelChange(e.target.value)}
            title="Filtrar por Canal de Ingreso"
            aria-label="Filtrar por Canal de Ingreso"
          >
            <option value="ALL">Canal: Todos</option>
            <option value="APP">App Móvil</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="PHONE">Llamada Telefónica</option>
            <option value="EMAIL">Correo Electrónico</option>
          </select>
        </div>
      </div>
    </section>
  );
};
