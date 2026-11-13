import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ServiceRequest, OperationalZone } from '../types';
import { getZoneByDistrict } from '../types/canonical';
import { serviceRequestRepository } from '../repositories/serviceRequestRepository';
import { computeDashboardStats, type DashboardStats } from '../utils/dashboardStats';

export type { DashboardStats };

interface UseServiceRequestsOptions {
  /** Se invoca cuando una solicitud entra a "requiere reasignación" después de la carga inicial. */
  onNewReassignments?: (requests: ServiceRequest[]) => void;
}

export function useServiceRequests(options: UseServiceRequestsOptions = {}) {
  const reassignmentsCallback = useRef(options.onNewReassignments);
  useEffect(() => { reassignmentsCallback.current = options.onNewReassignments; });
  // Ids ya vistos en reasignación; null hasta recibir la primera lista para no avisar por lo que ya estaba.
  const knownReassignments = useRef<Set<string> | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Cada intento de reconexión vuelve a abrir la suscripción en tiempo real.
  const [attempt, setAttempt] = useState(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [zoneFilter, setZoneFilter] = useState<OperationalZone | 'ALL'>('ALL');
  const [districtFilter, setDistrictFilter] = useState<string>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filter setters that automatically reset to page 1
  const updateSearchTerm = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };
  const updateStatusFilter = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };
  const updateChannelFilter = (channel: string) => {
    setChannelFilter(channel);
    setCurrentPage(1);
  };
  const updateZoneFilter = (zone: OperationalZone | 'ALL') => {
    setZoneFilter(zone);
    setCurrentPage(1);
  };
  const updateDistrictFilter = (district: string) => {
    setDistrictFilter(district);
    setCurrentPage(1);
  };
  const updatePageSize = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = serviceRequestRepository.subscribeAll(
      (list) => {
        const current = list.filter((r) => r.status === 'REQUIRES_REASSIGNMENT');
        const known = knownReassignments.current;
        if (known) {
          const fresh = current.filter((r) => !known.has(r.id));
          if (fresh.length > 0) reassignmentsCallback.current?.(fresh);
        }
        knownReassignments.current = new Set(current.map((r) => r.id));
        setRequests(list);
        setLoading(false);
      },
      (err) => {
        setError(err.message || 'Error al cargar solicitudes');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [attempt]);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setAttempt((value) => value + 1);
  }, []);

  // Indicadores operativos (cálculo puro, probado en test/dashboardStats.test.mjs)
  const stats: DashboardStats = useMemo(() => computeDashboardStats(requests), [requests]);

  // Filtered and sorted requests list
  const filteredRequests = useMemo(() => {
    const list = requests.filter((r) => {
      // 1. Status Filter
      if (statusFilter !== 'ALL') {
        if (
          statusFilter === 'PENDING' &&
          !['PENDING_ASSIGNMENT', 'QUOTED', 'REQUIRES_REASSIGNMENT'].includes(r.status)
        )
          return false;
        if (
          statusFilter === 'IN_PROGRESS' &&
          !['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(r.status)
        )
          return false;
        if (
          statusFilter === 'COMPLETED' &&
          !['COMPLETED', 'VALIDATED'].includes(r.status)
        )
          return false;
        if (
          statusFilter === 'WARRANTY' &&
          !['COMPLETED', 'VALIDATED'].includes(r.status)
        )
          return false;
        if (statusFilter === 'CANCELLED' && !r.status.startsWith('CANCELLED'))
          return false;
      }

      // 2. Channel Filter
      if (channelFilter !== 'ALL') {
        const ch = r.intakeChannel || 'APP';
        if (ch !== channelFilter) return false;
      }

      // 3. Operational Zone Filter
      if (zoneFilter !== 'ALL') {
        const itemZone = r.zone || (r.district ? getZoneByDistrict(r.district) : 'UNKNOWN');
        if (itemZone !== zoneFilter) return false;
      }

      // 4. District Filter
      if (districtFilter !== 'ALL') {
        const itemDistrict = (r.district || '').toLowerCase().trim();
        const targetDistrict = districtFilter.toLowerCase().trim();
        if (!itemDistrict.includes(targetDistrict)) return false;
      }

      // 5. Text Search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const code = (r.code || '').toLowerCase();
        const client = (r.clientName || '').toLowerCase();
        const district = (r.district || '').toLowerCase();
        const specialty = (r.serviceLabel || r.specialty || '').toLowerCase();
        const id = r.id.toLowerCase();
        return (
          code.includes(term) ||
          client.includes(term) ||
          district.includes(term) ||
          specialty.includes(term) ||
          id.includes(term)
        );
      }

      return true;
    });

    // Orden predeterminado oficial de bandeja (Fase 5):
    // REQUIRES_REASSIGNMENT primero, luego mayor tiempo en etapa descendente (más tiempo esperando = mayor urgencia).
    return list.sort((a, b) => {
      // 1. REQUIRES_REASSIGNMENT siempre primero
      if (a.status === 'REQUIRES_REASSIGNMENT' && b.status !== 'REQUIRES_REASSIGNMENT') return -1;
      if (b.status === 'REQUIRES_REASSIGNMENT' && a.status !== 'REQUIRES_REASSIGNMENT') return 1;

      const toTime = (val: any): number => {
        if (!val) return 0;
        if (typeof val.toMillis === 'function') return val.toMillis();
        if (typeof val.seconds === 'number') return val.seconds * 1000;
        if (val instanceof Date) return val.getTime();
        if (typeof val === 'number') return val;
        return new Date(val).getTime() || 0;
      };

      const isAActive = ['PENDING_ASSIGNMENT', 'QUOTED', 'REQUIRES_REASSIGNMENT', 'PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(a.status);
      const isBActive = ['PENDING_ASSIGNMENT', 'QUOTED', 'REQUIRES_REASSIGNMENT', 'PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(b.status);

      // Solicitudes activas tienen prioridad sobre cerradas
      if (isAActive && !isBActive) return -1;
      if (!isAActive && isBActive) return 1;

      const timeA = toTime(a.updatedAt) || toTime(a.createdAt);
      const timeB = toTime(b.updatedAt) || toTime(b.createdAt);

      if (isAActive && isBActive) {
        // Mayor tiempo en etapa descendente: timestamp más antiguo primero
        return timeA - timeB;
      }

      // Solicitudes culminadas o canceladas: más recientes primero
      return timeB - timeA;
    });
  }, [requests, statusFilter, channelFilter, zoneFilter, districtFilter, searchTerm]);

  const hasActiveFilters =
    searchTerm.trim() !== '' || statusFilter !== 'ALL' || channelFilter !== 'ALL' || zoneFilter !== 'ALL' || districtFilter !== 'ALL';

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setChannelFilter('ALL');
    setZoneFilter('ALL');
    setDistrictFilter('ALL');
    setCurrentPage(1);
  }, []);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  return {
    requests,
    filteredRequests,
    paginatedRequests,
    loading,
    error,
    retry,
    stats,
    hasActiveFilters,
    clearFilters,
    filters: {
      searchTerm,
      setSearchTerm: updateSearchTerm,
      statusFilter,
      setStatusFilter: updateStatusFilter,
      channelFilter,
      setChannelFilter: updateChannelFilter,
      zoneFilter,
      setZoneFilter: updateZoneFilter,
      districtFilter,
      setDistrictFilter: updateDistrictFilter,
    },
    pagination: {
      currentPage,
      setCurrentPage,
      pageSize,
      setPageSize: updatePageSize,
      totalPages,
    },
  };
}
