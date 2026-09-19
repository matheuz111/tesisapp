import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { ServiceRequest, ProviderUser } from '../types';
import { X, Search, CheckCircle2, UserCheck, Phone, Wrench, Star, AlertCircle, Loader2 } from 'lucide-react';

interface Props {
  request: ServiceRequest | null;
  onClose: () => void;
  onAssigned?: () => void;
}

export const AssignWorkerModal = ({ request, onClose, onAssigned }: Props) => {
  const [workers, setWorkers] = useState<ProviderUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escuchar técnicos disponibles con rol PROVIDER
  useEffect(() => {
    if (!request) return;
    setLoading(true);
    const q = query(collection(db, 'users'), where('role', '==', 'PROVIDER'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: ProviderUser[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as ProviderUser[];

        // Preseleccionar si ya tiene técnico
        if (request.providerId && !selectedWorkerId) {
          setSelectedWorkerId(request.providerId);
        }

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
  }, [request]);

  if (!request) return null;

  const filteredWorkers = workers.filter((w) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const name = (w.full_name || w.name || '').toLowerCase();
    const specialty = (w.specialty || '').toLowerCase();
    const phone = (w.phone || '').toLowerCase();
    return name.includes(term) || specialty.includes(term) || phone.includes(term);
  });

  const handleAssign = async () => {
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

      // 1. Actualizar solicitud
      await updateDoc(requestRef, {
        providerId: selectedWorker.id,
        providerName: workerName,
        providerPhone: workerPhone,
        status: 'ACCEPTED',
        assignedBy: auth.currentUser?.uid || 'OPERATOR',
        assignedAt: serverTimestamp(),
        firstResponseAt: request.firstResponseAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2. Registrar auditoría obligatoria en status_history para la tesis (CAMBIOS_EST / TRAZ_COMP)
      await addDoc(collection(db, 'service_requests', request.id, 'status_history'), {
        fromStatus: request.status,
        toStatus: 'ACCEPTED',
        actorId: auth.currentUser?.uid || 'OPERATOR',
        actorRole: 'OPERATOR',
        timestamp: serverTimestamp(),
        notes: `Trabajador ${workerName} asignado y solicitud aceptada desde Panel Central`,
      });

      // 3. Vincular servicio activo al técnico
      try {
        await updateDoc(doc(db, 'users', selectedWorker.id), {
          activeRequestId: request.id,
        });
      } catch (userErr) {
        console.warn('No se pudo actualizar activeRequestId del técnico:', userErr);
      }

      if (onAssigned) onAssigned();
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
              <h2>Asignar Trabajador & Aceptar Solicitud</h2>
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
                {request.price_agreed || `Visita: S/. ${request.technicalVisitFee?.toFixed(2) || '50.00'}`}
              </span>
            </div>
          </div>

          {/* Buscador de técnicos */}
          <div style={{ position: 'relative', marginTop: 8 }}>
            <Search size={16} className="search-icon" style={{ left: 12 }} />
            <input
              type="text"
              className="worker-search-input"
              style={{ paddingLeft: 38 }}
              placeholder="Buscar trabajador por nombre, especialidad o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Lista de técnicos */}
          <div className="worker-list-scroll">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                <Loader2 size={28} className="spinner" style={{ margin: '0 auto 10px' }} />
                <p>Cargando técnicos registrados...</p>
              </div>
            ) : filteredWorkers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                <p>No se encontraron trabajadores registrados con los criterios de búsqueda.</p>
              </div>
            ) : (
              filteredWorkers.map((worker) => {
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
            disabled={assigning || !selectedWorkerId}
          >
            {assigning ? (
              <>
                <Loader2 size={16} className="spinner" />
                <span>Asignando...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                <span>Confirmar Asignación & Aceptar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
