import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { ServiceRequest, ProviderUser } from '../types';
import { X, Search, CheckCircle2, UserCheck, Phone, Wrench, Star, AlertCircle, Loader2 } from 'lucide-react';
import { resolveRequestCanonicalPricing } from '../services/pricingPolicyService';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface Props {
  request: ServiceRequest | null;
  onClose: () => void;
  /** Se llama tras despachar, con el nombre del técnico, para confirmar con un aviso. */
  onAssigned?: (info: { workerName: string }) => void;
  initialProviderId?: string | null;
}

export const AssignWorkerModal = ({ request, onClose, onAssigned, initialProviderId }: Props) => {
  const isOnline = useNetworkStatus();
  const [workers, setWorkers] = useState<ProviderUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeJobsCount, setActiveJobsCount] = useState<Record<string, number>>({});

  // Monitorear carga actual hoy (servicios activos: PENDING, ACCEPTED, IN_PROGRESS)
  useEffect(() => {
    const qActive = query(
      collection(db, 'service_requests'),
      where('status', 'in', ['PENDING', 'ACCEPTED', 'IN_PROGRESS'])
    );
    const unsubscribe = onSnapshot(qActive, (snapshot) => {
      const counts: Record<string, number> = {};
      snapshot.docs.forEach((docSnap) => {
        const pId = docSnap.data().providerId;
        if (pId) {
          counts[pId] = (counts[pId] || 0) + 1;
        }
      });
      setActiveJobsCount(counts);
    });
    return () => unsubscribe();
  }, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(initialProviderId || null);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escuchar técnicos disponibles con rol PROVIDER
  useEffect(() => {
    if (!request) return;
    const q = query(collection(db, 'users'), where('role', '==', 'PROVIDER'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: ProviderUser[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as ProviderUser[];

        // Preseleccionar si viene preseleccionado o si ya tiene técnico
        setSelectedWorkerId((current) => initialProviderId || current || request.providerId || null);

        setWorkers(list);
        setLoading(false);
      },
      (err) => {
        console.warn('Error al cargar técnicos:', err);
        setError('No se pudo cargar la lista de trabajadores. Revisa los permisos.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [request, initialProviderId]);

  if (!request) return null;

  const isWaitingQuoteApproval = request.status === 'QUOTED' || (Boolean(request.requiresQuote) && request.quoteStatus !== 'APPROVED');

  const calculateDistanceKm = (w: any): number | null => {
    if (!request.location || (!w.current_location && !w.location)) return null;
    const target = w.current_location || w.location;
    const lat1 = request.location.latitude;
    const lon1 = request.location.longitude;
    const lat2 = target.latitude;
    const lon2 = target.longitude;
    if (typeof lat1 !== 'number' || typeof lat2 !== 'number') return null;

    const R = 6371; // Radio de la Tierra en km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(1));
  };

  const filteredWorkers = workers.filter((w) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const name = (w.full_name || w.name || '').toLowerCase();
    const specialty = (w.specialty || '').toLowerCase();
    const phone = (w.phone || '').toLowerCase();
    return name.includes(term) || specialty.includes(term) || phone.includes(term);
  });

  // Ordenamiento oficial: 1. Carga actual (menos activos hoy) -> 2. Distancia geográfica -> 3. Especialidad
  // (La calificación es dato visible, no criterio principal de asignación)
  const sortedWorkers = [...filteredWorkers].sort((a, b) => {
    const loadA = activeJobsCount[a.id] || 0;
    const loadB = activeJobsCount[b.id] || 0;
    if (loadA !== loadB) return loadA - loadB;

    const distA = calculateDistanceKm(a);
    const distB = calculateDistanceKm(b);
    if (distA !== null && distB !== null) return distA - distB;
    if (distA !== null) return -1;
    if (distB !== null) return 1;

    const matchA =
      request.specialty &&
      (a.specialty?.toLowerCase().includes(request.specialty.toLowerCase()) ||
        a.specialties?.some((s) => s.toLowerCase().includes(request.specialty!.toLowerCase())))
        ? 1
        : 0;
    const matchB =
      request.specialty &&
      (b.specialty?.toLowerCase().includes(request.specialty.toLowerCase()) ||
        b.specialties?.some((s) => s.toLowerCase().includes(request.specialty!.toLowerCase())))
        ? 1
        : 0;
    return matchB - matchA;
  });

  const handleAssign = async () => {
    if (assigning) return;
    if (isWaitingQuoteApproval) {
      setError('No se puede asignar un técnico mientras la cotización esté pendiente de aprobación por el cliente.');
      return;
    }
    if (!selectedWorkerId) {
      setError('Debes seleccionar un trabajador de la lista.');
      return;
    }

    const selectedWorker = workers.find((w) => w.id === selectedWorkerId);
    if (!selectedWorker) return;

    setAssigning(true);
    setError(null);

    try {
      const requestRef = doc(db, 'service_requests', request.id);
      const workerName = selectedWorker.full_name || selectedWorker.name || 'Técnico Especialista';
      const workerPhone = selectedWorker.phone || '';

      // 1. Actualizar solicitud a estado canónico PENDING (asignado al técnico)
      await updateDoc(requestRef, {
        providerId: selectedWorker.id,
        providerName: workerName,
        providerPhone: workerPhone,
        status: 'PENDING',
        assignedBy: auth.currentUser?.uid || 'OPERATOR',
        assignedAt: serverTimestamp(),
        firstResponseAt: request.firstResponseAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2. Registrar auditoría obligatoria en status_history para la tesis (CAMBIOS_EST / TRAZ_COMP)
      await addDoc(collection(db, 'service_requests', request.id, 'status_history'), {
        fromStatus: request.status,
        toStatus: 'PENDING',
        actorId: auth.currentUser?.uid || 'OPERATOR',
        actorRole: 'OPERATOR',
        timestamp: serverTimestamp(),
        notes: `Trabajador ${workerName} asignado desde Central (pendiente de aceptación técnica)`,
      });

      // 3. Vincular servicio activo al técnico
      try {
        await updateDoc(doc(db, 'users', selectedWorker.id), {
          activeRequestId: request.id,
        });
      } catch (userErr) {
        console.warn('No se pudo actualizar activeRequestId del técnico:', userErr);
      }

      if (onAssigned) onAssigned({ workerName });
      onClose();
    } catch (err: any) {
      console.error('Error al asignar trabajador:', err);
      setError(err.message || 'Error al guardar la asignación. Verifica tus permisos.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="kpi-icon-wrap icon-blue" style={{ width: 36, height: 36 }}>
              <UserCheck size={20} />
            </div>
            <div>
              <h2>Asignar Técnico a Solicitud</h2>
              <span className="modal-subtitle">
                Solicitud {request.code || request.id.slice(0, 8)} · Cliente: {request.clientName || 'Cliente'} ({request.district || 'Lima'})
              </span>
            </div>
          </div>
          <button type="button" className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body modal-scrollable">
          {error && (
            <div className="alert alert-danger">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {isWaitingQuoteApproval && (
            <div className="alert alert-warning" style={{ backgroundColor: '#FEF3C7', color: '#92400E', borderColor: '#FDE68A', display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
              <AlertCircle size={18} color="#92400E" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ display: 'block', fontSize: 13, marginBottom: 2 }}>Asignación en espera de aprobación</strong>
                <span style={{ fontSize: 12 }}>
                  {request.status === 'QUOTED'
                    ? 'La cotización formal ya fue emitida a la app del cliente y está pendiente de su aprobación.'
                    : 'Esta solicitud requiere cotización previa antes de asignar al técnico.'}
                </span>
              </div>
            </div>
          )}

          {/* Resumen del servicio a atender */}
          <div className="detail-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <p style={{ margin: 0 }}>
                <strong>Especialidad Requerida:</strong>{' '}
                <span className="badge badge-code" style={{ color: '#0284c7' }}>
                  {request.serviceLabel || request.specialty || 'General'}
                </span>
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                {request.address || 'Sin dirección exacta'} {request.district ? `· ${request.district}` : ''}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="price-tag" style={{ fontSize: 14 }}>
                {resolveRequestCanonicalPricing(request).formatted}
              </span>
            </div>
          </div>

          {/* Buscador de técnicos Material 3 */}
          <div className="mat-search-container" style={{ marginTop: 8 }}>
            <Search size={18} className="mat-search-icon" />
            <input
              type="text"
              className="mat-search-input"
              placeholder="Buscar trabajador por nombre, especialidad o teléfono..."
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

          {/* Lista de técnicos */}
          <div className="worker-list-scroll">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                <Loader2 size={28} className="spinner" style={{ margin: '0 auto 10px' }} />
                <p>Cargando técnicos registrados...</p>
              </div>
            ) : sortedWorkers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                <p>No se encontraron trabajadores registrados con los criterios de búsqueda.</p>
              </div>
            ) : (
              sortedWorkers.map((worker) => {
                const currentLoad = activeJobsCount[worker.id] || 0;
                const distanceKm = calculateDistanceKm(worker);
                const isSelected = selectedWorkerId === worker.id;
                const isCurrentlyAssigned = request.providerId === worker.id;
                const isSpecialtyMatch =
                  request.specialty &&
                  (worker.specialty?.toLowerCase().includes(request.specialty.toLowerCase()) ||
                    worker.specialties?.some((s) => s.toLowerCase().includes(request.specialty!.toLowerCase())));

                return (
                  <div
                    key={worker.id}
                    className={`worker-card-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedWorkerId(worker.id)}
                  >
                    <div className="worker-item-left">
                      {worker.photoUrl || worker.avatar ? (
                        <img
                          src={worker.photoUrl || worker.avatar}
                          alt={worker.full_name || worker.name}
                          className="worker-item-avatar"
                        />
                      ) : (
                        <div className="worker-item-avatar">
                          {(worker.full_name || worker.name || 'T').charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div className="worker-item-info">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="worker-item-name">{worker.full_name || worker.name || 'Técnico'}</span>
                          {isCurrentlyAssigned && (
                            <span className="badge badge-code" style={{ fontSize: 10, padding: '2px 6px' }}>
                              Actual
                            </span>
                          )}
                          {isSpecialtyMatch && (
                            <span className="badge badge-code" style={{ fontSize: 10, background: 'rgba(34, 197, 94, 0.15)', color: '#16a34a' }}>
                              Especialidad Coincidente
                            </span>
                          )}
                        </div>

                        <div className="worker-item-meta">
                          <span><Wrench size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} />{worker.specialty || 'Servicios Generales'}</span>
                          {worker.phone && (
                            <span><Phone size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} />{worker.phone}</span>
                          )}
                          <span
                            className="badge"
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              backgroundColor: currentLoad === 0 ? '#DCFCE7' : currentLoad === 1 ? '#FEF3C7' : '#FEE2E2',
                              color: currentLoad === 0 ? '#166534' : currentLoad === 1 ? '#92400E' : '#991B1B',
                            }}
                          >
                            {currentLoad === 0 ? '0 activos hoy (Disponible)' : `${currentLoad} en curso hoy`}
                          </span>
                          {distanceKm !== null && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              📍 a {distanceKm} km
                            </span>
                          )}
                          <span className="worker-item-rating">
                            <Star size={12} fill="#f59e0b" color="#f59e0b" style={{ verticalAlign: 'middle', marginRight: 2 }} />
                            {worker.total_rating && worker.review_count
                              ? (worker.total_rating / worker.review_count).toFixed(1)
                              : '5.0'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {worker.activeRequestId && worker.activeRequestId !== request.id ? (
                        <span className="worker-badge-busy">En Servicio</span>
                      ) : (
                        <span className="worker-badge-available">Disponible</span>
                      )}

                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          border: isSelected ? '6px solid var(--primary)' : '2px solid var(--border)',
                          background: '#fff',
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={assigning}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAssign}
            disabled={assigning || !selectedWorkerId || isWaitingQuoteApproval || !isOnline}
            title={!isOnline ? 'Sin conexión: asignación bloqueada para garantizar marcas de tiempo del servidor.' : undefined}
          >
            {assigning ? (
              <>
                <Loader2 size={16} className="spinner" />
                <span>Asignando...</span>
              </>
            ) : isWaitingQuoteApproval ? (
              <span>Pendiente de Aprobación</span>
            ) : (
              <>
                <CheckCircle2 size={16} />
                <span>Confirmar Asignación</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
