import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { ServiceRequest, StatusHistoryItem } from '../types';
import { formatStatus } from '../types';
import {
  X,
  Clock,
  User,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  ZoomIn,
  Navigation,
  UserCheck,
  Check,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import { ImageLightboxModal } from './ImageLightboxModal';
import { AssignWorkerModal } from './AssignWorkerModal';
import { LiveTrackingMapModal } from './LiveTrackingMapModal';
import { RealtimeChatModal } from './RealtimeChatModal';

interface Props {
  request: ServiceRequest | null;
  onClose: () => void;
}

export const ServiceDetailModal = ({ request, onClose }: Props) => {
  const [history, setHistory] = useState<StatusHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [inspectingImage, setInspectingImage] = useState<{ url: string; title: string } | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isLiveMapOpen, setIsLiveMapOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const handleDirectAccept = async () => {
    if (!request || accepting) return;
    setAccepting(true);
    try {
      await updateDoc(doc(db, 'service_requests', request.id), {
        status: 'ACCEPTED',
        firstResponseAt: request.firstResponseAt || serverTimestamp(),
        acceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'service_requests', request.id, 'status_history'), {
        fromStatus: request.status,
        toStatus: 'ACCEPTED',
        actorId: auth.currentUser?.uid || 'OPERATOR',
        actorRole: 'OPERATOR',
        timestamp: serverTimestamp(),
        notes: 'Solicitud aceptada directamente desde la consola del Operador',
      });
    } catch (e) {
      console.error('Error al aceptar solicitud:', e);
    } finally {
      setAccepting(false);
    }
  };

  useEffect(() => {
    if (!request?.id) {
      setHistory([]);
      return;
    }
    setLoadingHistory(true);
    const historyRef = collection(db, 'service_requests', request.id, 'status_history');
    const q = query(historyRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: StatusHistoryItem[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as StatusHistoryItem[];
      setHistory(items);
      setLoadingHistory(false);
    }, (error) => {
      console.warn('No se pudo cargar el historial de estados:', error);
      setLoadingHistory(false);
    });

    return () => unsubscribe();
  }, [request?.id]);

  if (!request) return null;

  const formatDate = (val: any) => {
    if (!val) return '—';
    const date = val.toDate ? val.toDate() : new Date(val);
    return isNaN(date.getTime()) ? '—' : date.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'medium' });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card modal-large">
        <div className="modal-header">
          <div>
            <span className="badge badge-code">{request.code || 'SIN CORRELATIVO'}</span>
            <h2 style={{ marginTop: 6 }}>Detalle del Servicio</h2>
          </div>
          <button type="button" className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body modal-scrollable">
          {/* Fila superior: Estado e info clave */}
          <div className="detail-grid-header">
            <div className="detail-pill">
              <span className="detail-label">Estado Actual</span>
              <span className={`status-badge status-${request.status.toLowerCase()}`}>
                {formatStatus(request.status)}
              </span>
            </div>
            <div className="detail-pill">
              <span className="detail-label">Canal de Ingreso</span>
              <span className="detail-value font-semibold">
                {request.intakeChannel === 'WHATSAPP' ? '💬 WhatsApp' :
                 request.intakeChannel === 'PHONE' ? '📞 Llamada' :
                 request.intakeChannel === 'EMAIL' ? '✉️ Correo' : '📱 App Cliente'}
              </span>
            </div>
            <div className="detail-pill">
              <span className="detail-label">Origen</span>
              <span className="detail-value">
                {request.origin === 'OPERATOR' ? 'Operador (Central)' : 'Cliente Directo'}
              </span>
            </div>
            <div className="detail-pill">
              <span className="detail-label">PIN de Seguridad</span>
              <span className="detail-value font-mono font-bold" style={{ letterSpacing: 2, color: '#0284c7' }}>
                {request.securityPin || '••••'}
              </span>
            </div>
          </div>

          {/* Información del Cliente y Ubicación */}
          <div className="detail-section">
            <h3 className="section-subtitle"><User size={16} /> Cliente y Solicitud</h3>
            <div className="detail-two-col">
              <div>
                <p><strong>Nombre:</strong> {request.clientName || 'No especificado'}</p>
                <p><strong>Teléfono:</strong> {request.clientPhone || 'No registrado'}</p>
                <p><strong>Especialidad:</strong> {request.serviceLabel || request.specialty}</p>
                <p><strong>Prioridad:</strong> {request.priority === 'HIGH' ? '🚨 Alta (Urgencia)' : 'Normal'}</p>
              </div>
              <div>
                <p><strong>Distrito:</strong> {request.district || 'Lima'}</p>
                <p><strong>Dirección:</strong> {request.address || '—'}</p>
                <p><strong>Referencia:</strong> {request.addressReference || 'Sin referencia'}</p>
                <p><strong>Técnico Asignado:</strong> {request.providerName || (request.providerId ? 'ID: ' + request.providerId.slice(0, 8) : 'Sin asignar')}</p>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <p><strong>Descripción del Problema:</strong></p>
              <div className="detail-box">{request.description || 'Sin descripción'}</div>
            </div>
          </div>

          {/* Tarifas y Cotización */}
          <div className="detail-section">
            <h3 className="section-subtitle"><FileText size={16} /> Tarifas y Cotización</h3>
            <div className="detail-two-col">
              <div>
                <p><strong>Tarifa de Visita Diagnóstica:</strong> S/. {request.technicalVisitFee?.toFixed(2) || '50.00'} (Deducible)</p>
                <p><strong>Tarifa Final Acordada:</strong> {request.price_agreed || 'Pendiente de cotizar'}</p>
              </div>
              <div>
                <p><strong>Cotización Aceptada por Cliente:</strong> {request.quoteAccepted ? '✅ Sí' : request.quoteRejectedAt ? '❌ Rechazada' : '⏳ Pendiente'}</p>
                <p><strong>Estado de Pago:</strong> {request.paymentStatus === 'CONFIRMED' ? '✅ Confirmado por Técnico' : request.paymentStatus === 'PAID' ? '💳 Pagado con Comprobante' : 'Pendiente'}</p>
              </div>
            </div>
          </div>

          {/* Galería Fotográfica de Evidencia */}
          <div className="detail-section">
            <h3 className="section-subtitle"><ImageIcon size={16} /> Galería de Evidencia (Auditoría EVID_INI / EVID_FIN)</h3>
            <div className="evidence-grid">
              <div className="evidence-card">
                <span className="evidence-title">Foto Inicial del Problema (EVID_INI)</span>
                {request.issuePhoto ? (
                  <div
                    className="evidence-img-container"
                    onClick={() => setInspectingImage({ url: request.issuePhoto!, title: `Foto Inicial (${request.code || 'SOLICITUD'})` })}
                    title="Click para inspeccionar y hacer zoom"
                  >
                    <img src={request.issuePhoto} alt="Problema inicial" className="evidence-img" />
                    <div className="evidence-zoom-overlay">
                      <ZoomIn size={18} />
                      <span>Inspeccionar Zoom</span>
                    </div>
                  </div>
                ) : (
                  <div className="evidence-placeholder">Sin fotografía inicial</div>
                )}
              </div>
              <div className="evidence-card">
                <span className="evidence-title">Evidencia de Culminación (EVID_FIN)</span>
                {request.evidencePhoto ? (
                  <div
                    className="evidence-img-container"
                    onClick={() => setInspectingImage({ url: request.evidencePhoto!, title: `Evidencia Final (${request.code || 'SOLICITUD'})` })}
                    title="Click para inspeccionar y hacer zoom"
                  >
                    <img src={request.evidencePhoto} alt="Trabajo culminado" className="evidence-img" />
                    <div className="evidence-zoom-overlay">
                      <ZoomIn size={18} />
                      <span>Inspeccionar Zoom</span>
                    </div>
                  </div>
                ) : (
                  <div className="evidence-placeholder">Pendiente de subir por técnico</div>
                )}
              </div>
              {request.voucher && (
                <div className="evidence-card">
                  <span className="evidence-title">Comprobante de Pago (Voucher)</span>
                  <div
                    className="evidence-img-container"
                    onClick={() => setInspectingImage({ url: request.voucher!, title: `Comprobante de Pago (${request.code || 'SOLICITUD'})` })}
                    title="Click para inspeccionar y hacer zoom"
                  >
                    <img src={request.voucher} alt="Comprobante" className="evidence-img" />
                    <div className="evidence-zoom-overlay">
                      <ZoomIn size={18} />
                      <span>Inspeccionar Zoom</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Calificación del Servicio */}
          {request.review_rating && (
            <div className="detail-section">
              <h3 className="section-subtitle">⭐ Calificación del Cliente</h3>
              <p><strong>Estrellas:</strong> {'★'.repeat(request.review_rating) + '☆'.repeat(5 - request.review_rating)} ({request.review_rating}/5)</p>
              {request.review_comment && <p><strong>Comentario:</strong> "{request.review_comment}"</p>}
            </div>
          )}

          {/* Línea de Tiempo de Trazabilidad e Historial status_history */}
          <div className="detail-section">
            <h3 className="section-subtitle"><Clock size={16} /> Trazabilidad Completa (status_history)</h3>
            {loadingHistory ? (
              <p className="text-muted">Cargando eventos del historial...</p>
            ) : history.length === 0 ? (
              <p className="text-muted">No se han registrado transiciones en la subcolección.</p>
            ) : (
              <div className="timeline-container">
                {history.map((item, idx) => (
                  <div key={item.id || idx} className="timeline-item">
                    <div className="timeline-bullet">
                      <CheckCircle2 size={16} color="#0284c7" />
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-top">
                        <span className="timeline-state">{formatStatus(item.toStatus)}</span>
                        <span className="timeline-date">{formatDate(item.timestamp)}</span>
                      </div>
                      <p className="timeline-meta">
                        Rol: <strong>{item.actorRole}</strong> · Actor: <code>{item.actorId?.slice(0, 8)}</code>
                      </p>
                      {item.notes && <p className="timeline-note">{item.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* Botón de Mapa en Vivo tipo inDrive */}
            <button
              type="button"
              className="btn btn-primary"
              style={{ background: '#0284c7' }}
              onClick={() => setIsLiveMapOpen(true)}
              title="Abrir mapa de seguimiento en vivo con trazado de ruta"
            >
              <Navigation size={16} />
              <span>🗺️ Ver Mapa inDrive</span>
            </button>

            {/* Botón de Chat en Vivo Cliente ↔ Trabajador */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsChatModalOpen(true)}
              title="Ver conversación en tiempo real entre cliente y técnico"
            >
              <MessageSquare size={16} />
              <span>💬 Chat en Vivo</span>
            </button>

            {/* Botón de Asignar / Reasignar Trabajador */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsAssignModalOpen(true)}
              title="Seleccionar y asignar un técnico de la lista de trabajadores"
            >
              <UserCheck size={16} />
              <span>{request.providerId ? 'Reasignar Trabajador' : 'Asignar Trabajador'}</span>
            </button>

            {/* Botón de Aceptar Directamente si está pendiente */}
            {['PENDING_ASSIGNMENT', 'PENDING', 'REQUIRES_REASSIGNMENT'].includes(request.status) && (
              <button
                type="button"
                className="btn btn-success"
                onClick={handleDirectAccept}
                disabled={accepting}
                title="Aceptar la solicitud de inmediato"
              >
                {accepting ? <Loader2 size={16} className="spinner" /> : <Check size={16} />}
                <span>Aceptar Solicitud</span>
              </button>
            )}
          </div>

          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cerrar Ventana
          </button>
        </div>
      </div>

      {/* Modal Asignar Trabajador */}
      {isAssignModalOpen && (
        <AssignWorkerModal
          request={request}
          onClose={() => setIsAssignModalOpen(false)}
        />
      )}

      {/* Modal Mapa en Vivo tipo inDrive */}
      {isLiveMapOpen && (
        <LiveTrackingMapModal
          request={request}
          onClose={() => setIsLiveMapOpen(false)}
        />
      )}

      {/* Modal Chat en Vivo */}
      {isChatModalOpen && (
        <RealtimeChatModal
          request={request}
          onClose={() => setIsChatModalOpen(false)}
        />
      )}

      {/* Visor de Inspección con Zoom Interactivo */}
      {inspectingImage && (
        <ImageLightboxModal
          imageUrl={inspectingImage.url}
          title={inspectingImage.title}
          onClose={() => setInspectingImage(null)}
        />
      )}
    </div>
  );
};
