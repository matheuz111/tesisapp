import { useEffect, useState } from 'react';
import { actorLabel, describeTransition, formatDuration, formatReason, type HistoryTone } from '../utils/historyPresentation';
import { collection, onSnapshot, orderBy, query, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { ServiceRequest, StatusHistoryItem } from '../types';
import { SlaTrafficBadge } from './SlaTrafficBadge';
import { StatusBadge } from './StatusBadge';
import { SidePanel } from './SidePanel';
import {
  Clock,
  User,
  FileText,
  Image as ImageIcon,
  ZoomIn,
  Navigation,
  UserCheck,
  Check,
  Loader2,
  MessageSquare,
  MessageCircle,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  Phone,
  Mail,
  Smartphone,
  Globe,
  AlertTriangle,
  Receipt,
  FileSpreadsheet,
} from 'lucide-react';
import { lazy, Suspense } from 'react';
import { resolveRequestCanonicalPricing } from '../services/pricingPolicyService';

const ImageLightboxModal = lazy(() =>
  import('./ImageLightboxModal').then((m) => ({ default: m.ImageLightboxModal }))
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

interface Props {
  request: ServiceRequest | null;
  onClose: () => void;
}

type DetailTab = 'resumen' | 'trazabilidad' | 'evidencias' | 'cotizacion';

/** Colores del punto y del título en la línea de tiempo, de las mismas variables que usan los estados. */
const HISTORY_TONE_COLORS: Record<HistoryTone, string> = {
  primary: 'var(--primary)',
  success: 'var(--status-completed-fg)',
  warning: 'var(--status-pending-fg)',
  danger: 'var(--status-danger-fg)',
};

export const ServiceDetailModal = ({ request, onClose }: Props) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('resumen');
  const [history, setHistory] = useState<StatusHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(() => Boolean(request?.id));
  const [inspectingImage, setInspectingImage] = useState<{ url: string; title: string } | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isLiveMapOpen, setIsLiveMapOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [showPin, setShowPin] = useState(false);

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
    if (!request?.id) return;

    setLoadingHistory(true);
    const historyRef = collection(db, 'service_requests', request.id, 'status_history');
    const q = query(historyRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: StatusHistoryItem[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as StatusHistoryItem[];
        setHistory(items);
        setLoadingHistory(false);
      },
      (error) => {
        console.warn('No se pudo cargar el historial de estados:', error);
        setLoadingHistory(false);
      }
    );

    return () => unsubscribe();
  }, [request?.id]);

  if (!request) return null;

  const formatDate = (val: any) => {
    if (!val) return '—';
    const date = val.toDate ? val.toDate() : new Date(val);
    return isNaN(date.getTime()) ? '—' : date.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'medium' });
  };

  // Cálculo de vigencia de garantía (Resolves Bug a)
  const isWarrantyState = ['COMPLETED', 'VALIDATED'].includes(request.status);
  const baseWarrantyDate = request.validatedAt || request.finishedAt || request.createdAt;
  let isWarrantyActive = false;
  let warrantyExpiryDate: Date | null = null;
  if (isWarrantyState && baseWarrantyDate) {
    const d = baseWarrantyDate.toDate ? baseWarrantyDate.toDate() : new Date(baseWarrantyDate);
    if (!isNaN(d.getTime())) {
      warrantyExpiryDate = new Date(d.getTime() + 30 * 24 * 60 * 60 * 1000);
      isWarrantyActive = Date.now() <= warrantyExpiryDate.getTime();
    }
  }

  // Tiempos métricas clave para la pestaña de trazabilidad
  const toDate = (val: any) => {
    if (!val) return null;
    const d = val.toDate ? val.toDate() : new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const tCrea = toDate(request.createdAt);
  const tResp = toDate(request.firstResponseAt);
  const tAsig = toDate(request.assignedAt);
  const tInic = toDate(request.startedAt);
  const tFin = toDate(request.finishedAt);
  const tVal = toDate(request.validatedAt);

  const getDeltaMin = (end: Date | null, start: Date | null) => {
    if (!end || !start) return 'Aún no';
    return formatDuration(end.getTime() - start.getTime()) ?? 'Aún no';
  };

  const canonicalPricing = resolveRequestCanonicalPricing(request);

  const renderChannelIcon = (channel?: string) => {
    switch (channel) {
      case 'WHATSAPP':
        return <MessageCircle size={14} color="#16a34a" />;
      case 'PHONE':
        return <Phone size={14} color="#0369a1" />;
      case 'EMAIL':
        return <Mail size={14} color="#64748b" />;
      case 'WEB':
        return <Globe size={14} color="#0284c7" />;
      case 'APP':
      default:
        return <Smartphone size={14} color="#0369a1" />;
    }
  };

  const panelFooter = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: '6px 12px', fontSize: '12px' }}
          onClick={() => setIsLiveMapOpen(true)}
          title="Abrir telemetría y despacho en ruta"
        >
          <Navigation size={14} />
          <span>Despacho en Ruta</span>
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: '6px 12px', fontSize: '12px' }}
          onClick={() => setIsChatModalOpen(true)}
          title="Ver conversación entre cliente y técnico"
        >
          <MessageSquare size={14} />
          <span>Chat en Vivo</span>
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: '6px 12px', fontSize: '12px' }}
          onClick={() => setIsAssignModalOpen(true)}
          title="Asignar o reasignar técnico para este servicio"
        >
          <UserCheck size={14} />
          <span>{request.providerId ? 'Reasignar' : 'Asignar Técnico'}</span>
        </button>

        {['PENDING_ASSIGNMENT', 'PENDING', 'REQUIRES_REASSIGNMENT'].includes(request.status) && (
          <button
            type="button"
            className="btn btn-success"
            style={{ padding: '6px 12px', fontSize: '12px' }}
            onClick={handleDirectAccept}
            disabled={accepting}
            title="Aceptar la solicitud de inmediato"
          >
            {accepting ? <Loader2 size={14} className="spinner" /> : <Check size={14} />}
            <span>Aceptar Solicitud</span>
          </button>
        )}
      </div>

      <button type="button" className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={onClose}>
        Cerrar
      </button>
    </div>
  );

  return (
    <SidePanel
      isOpen={Boolean(request)}
      onClose={onClose}
      title={request.code || 'SOLICITUD'}
      subtitle={`${request.serviceLabel || request.specialty} · ${request.district || 'Lima'}`}
      badge={<StatusBadge status={request.status} />}
      footer={panelFooter}
      width="580px"
    >
      {/* SLA Traffic Full Banner */}
      <div className="sla-full-banner">
        <SlaTrafficBadge request={request} showDetails />
      </div>

      {/* Tabs Switcher */}
      <div className="sidepanel-tabs-bar" style={{ margin: '-4px -20px 16px', padding: '6px 20px' }}>
        <button
          type="button"
          className={`sidepanel-tab-btn ${activeTab === 'resumen' ? 'active' : ''}`}
          onClick={() => setActiveTab('resumen')}
        >
          <FileText size={14} />
          <span>Resumen</span>
        </button>
        <button
          type="button"
          className={`sidepanel-tab-btn ${activeTab === 'trazabilidad' ? 'active' : ''}`}
          onClick={() => setActiveTab('trazabilidad')}
        >
          <Clock size={14} />
          <span>Trazabilidad ({history.length})</span>
        </button>
        <button
          type="button"
          className={`sidepanel-tab-btn ${activeTab === 'evidencias' ? 'active' : ''}`}
          onClick={() => setActiveTab('evidencias')}
        >
          <ImageIcon size={14} />
          <span>Evidencias</span>
        </button>
        <button
          type="button"
          className={`sidepanel-tab-btn ${activeTab === 'cotizacion' ? 'active' : ''}`}
          onClick={() => setActiveTab('cotizacion')}
        >
          <Receipt size={14} />
          <span>Cotización y Pago</span>
        </button>
      </div>

      {/* TAB 1: RESUMEN */}
      {activeTab === 'resumen' && (
        <div className="sidepanel-content-pane">
          {/* Tarjeta de Diagnóstico de Cancelación (Resolves Bug d) */}
          {request.status.startsWith('CANCELLED') && (
            <div className="diagnostic-cancel-card">
              <div className="diagnostic-cancel-header">
                <AlertTriangle size={16} />
                <span>Por qué se canceló</span>
              </div>
              <p className="diagnostic-cancel-text">
                <strong>Motivo reportado:</strong> {formatReason(request.cancelReason || request.rejectionReasonText || request.rejectionReason) || 'Sin motivo especificado al cancelar'}<br />
                {request.quoteRejectionReason && (
                  <><strong>Rechazo de cotización:</strong> {formatReason(request.quoteRejectionReason)}<br /></>
                )}
                {request.providerRejectionReason && (
                  <><strong>Rechazo del técnico:</strong> {formatReason(request.providerRejectionReason)}<br /></>
                )}
                {request.notes && (
                  <><strong>Notas de auditoría:</strong> {request.notes}</>
                )}
              </p>
            </div>
          )}

          {/* Sello de Garantía de 30 Días con Evaluación Real de Expiración (Resolves Bug a) */}
          {isWarrantyState && (
            <div
              className="sidepanel-card"
              style={{
                backgroundColor: isWarrantyActive ? 'var(--status-completed-bg)' : 'var(--status-pending-bg)',
                borderColor: isWarrantyActive ? 'var(--status-completed-border)' : 'var(--status-pending-border)',
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {isWarrantyActive ? (
                  <ShieldCheck size={26} color="var(--status-completed-fg)" />
                ) : (
                  <ShieldAlert size={26} color="var(--status-pending-fg)" />
                )}
                <div>
                  <h4
                    style={{
                      margin: 0,
                      fontSize: '13px',
                      fontWeight: 700,
                      color: isWarrantyActive ? 'var(--status-completed-fg)' : 'var(--status-pending-fg)',
                    }}
                  >
                    {isWarrantyActive
                      ? 'Garantía Digital de 30 Días Activa'
                      : 'Garantía Digital de 30 Días Vencida'}
                  </h4>
                  <p
                    style={{
                      margin: '2px 0 0',
                      fontSize: '12px',
                      color: isWarrantyActive ? '#166534' : '#92400e',
                    }}
                  >
                    {isWarrantyActive
                      ? `Cobertura técnica vigente hasta el ${warrantyExpiryDate?.toLocaleDateString('es-PE', { dateStyle: 'long' })}.`
                      : `La cobertura expiró el ${warrantyExpiryDate?.toLocaleDateString('es-PE', { dateStyle: 'long' })}.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Indicadores rápidos de cabecera */}
          <div className="sidepanel-card">
            <div className="sidepanel-prop-grid">
              <div className="sidepanel-prop-item">
                <span className="sidepanel-prop-label">Canal de Ingreso</span>
                <span className="sidepanel-prop-value" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                  {renderChannelIcon(request.intakeChannel)}
                  {request.intakeChannel === 'WHATSAPP' ? 'WhatsApp' :
                   request.intakeChannel === 'PHONE' ? 'Llamada Central' :
                   request.intakeChannel === 'EMAIL' ? 'Correo Electrónico' :
                   request.intakeChannel === 'WEB' ? 'Portal Web' : 'App Móvil'}
                </span>
              </div>

              <div className="sidepanel-prop-item">
                <span className="sidepanel-prop-label">PIN de Seguridad</span>
                <span className="sidepanel-prop-value" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <code className="mono-tabular" style={{ fontWeight: 700, letterSpacing: 2, color: 'var(--primary)', fontSize: 14 }}>
                    {showPin ? (request.securityPin || '----') : '••••'}
                  </code>
                  <button
                    type="button"
                    className="pin-toggle-btn"
                    onClick={() => setShowPin((prev) => !prev)}
                    title={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                  >
                    {showPin ? <EyeOff size={12} /> : <Eye size={12} />}
                    <span>{showPin ? 'Ocultar' : 'Ver'}</span>
                  </button>
                </span>
              </div>

              <div className="sidepanel-prop-item">
                <span className="sidepanel-prop-label">Origen de Solicitud</span>
                <span className="sidepanel-prop-value">
                  {request.origin === 'OPERATOR' ? 'Operador Central' : 'Cliente Directo'}
                </span>
              </div>

              <div className="sidepanel-prop-item">
                <span className="sidepanel-prop-label">Prioridad Operativa</span>
                <span className="sidepanel-prop-value" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {request.priority === 'HIGH' ? (
                    <>
                      <AlertTriangle size={13} color="#dc2626" />
                      <strong style={{ color: '#dc2626' }}>Alta (Urgencia)</strong>
                    </>
                  ) : (
                    'Normal'
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Información del Cliente */}
          <div className="sidepanel-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 className="sidepanel-card-title" style={{ margin: 0 }}>
                <User size={15} /> Cliente y Contacto
              </h4>
              {request.clientPhone && (
                <a
                  href={`https://wa.me/51${request.clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                    `Hola ${request.clientName || 'estimado(a)'}, te contactamos de la central de Multiservicios sobre tu solicitud ${request.code || ''}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '11px',
                    padding: '3px 8px',
                    color: '#16a34a',
                    borderColor: 'rgba(22,163,74,0.3)',
                  }}
                >
                  <MessageCircle size={13} color="#16a34a" />
                  <span>WhatsApp Cliente</span>
                </a>
              )}
            </div>

            <div className="sidepanel-prop-grid">
              <div className="sidepanel-prop-item">
                <span className="sidepanel-prop-label">Nombre del Cliente</span>
                <span className="sidepanel-prop-value font-semibold">{request.clientName || 'No especificado'}</span>
              </div>

              <div className="sidepanel-prop-item">
                <span className="sidepanel-prop-label">Teléfono de Contacto</span>
                <span className="sidepanel-prop-value mono-tabular">
                  {request.clientPhone || <span style={{ color: '#dc2626' }}>No registrado</span>}
                </span>
              </div>

              <div className="sidepanel-prop-item">
                <span className="sidepanel-prop-label">Distrito</span>
                <span className="sidepanel-prop-value">{request.district || 'Lima'}</span>
              </div>

              <div className="sidepanel-prop-item">
                <span className="sidepanel-prop-label">Dirección</span>
                <span className="sidepanel-prop-value">{request.address || '—'}</span>
              </div>

              <div className="sidepanel-prop-item" style={{ gridColumn: '1 / -1' }}>
                <span className="sidepanel-prop-label">Referencia</span>
                <span className="sidepanel-prop-value">{request.addressReference || 'Sin referencia'}</span>
              </div>
            </div>
          </div>

          {/* Técnico y Trabajo Solicitado */}
          <div className="sidepanel-card">
            <h4 className="sidepanel-card-title">
              <UserCheck size={15} /> Técnico y Requerimiento
            </h4>

            <div className="sidepanel-prop-grid" style={{ marginBottom: 12 }}>
              <div className="sidepanel-prop-item">
                <span className="sidepanel-prop-label">Técnico Asignado</span>
                <span className="sidepanel-prop-value font-semibold">
                  {request.providerName || (request.providerId ? `ID: ${request.providerId.slice(0, 8)}` : 'Sin asignar')}
                </span>
              </div>

              <div className="sidepanel-prop-item">
                <span className="sidepanel-prop-label">Especialidad</span>
                <span className="sidepanel-prop-value">{request.serviceLabel || request.specialty}</span>
              </div>
            </div>

            <div className="sidepanel-prop-item">
              <span className="sidepanel-prop-label">Descripción del Problema</span>
              <div
                style={{
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 6,
                  backgroundColor: 'var(--bg-hover)',
                  border: '1px solid var(--border)',
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: 'var(--text-main)',
                }}
              >
                {request.description || 'Sin descripción registrada'}
              </div>
            </div>
          </div>

          {/* Calificación del Cliente si existe */}
          {request.review_rating && (
            <div className="sidepanel-card">
              <h4 className="sidepanel-card-title">Calificación del Servicio</h4>
              <p style={{ margin: '0 0 6px', fontSize: 13 }}>
                <strong>Estrellas:</strong> {'★'.repeat(request.review_rating) + '☆'.repeat(5 - request.review_rating)} ({request.review_rating}/5)
              </p>
              {request.review_comment && (
                <p style={{ margin: 0, fontSize: 12, fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                  "{request.review_comment}"
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TRAZABILIDAD (MÉTRICAS DELTAS & HISTORIAL) */}
      {activeTab === 'trazabilidad' && (
        <div className="sidepanel-content-pane">
          {/* Tarjetas de Deltas de Tiempo Tesis */}
          <div className="sidepanel-card">
            <h4 className="sidepanel-card-title">
              <Clock size={15} /> Tiempos por etapa
            </h4>
            <div className="sidepanel-prop-grid">
              <div className="sidepanel-prop-item">
                <span className="sidepanel-prop-label" title="Métrica T_RSP">1. Respuesta de la central</span>
                <span className="sidepanel-prop-value mono-tabular font-semibold">
                  {getDeltaMin(tResp, tCrea)}
                </span>
              </div>
              <div className="sidepanel-prop-item">
                <span className="sidepanel-prop-label" title="Métrica T_ASG">2. Asignación de técnico</span>
                <span className="sidepanel-prop-value mono-tabular font-semibold">
                  {getDeltaMin(tAsig, tResp || tCrea)}
                </span>
              </div>
              <div className="sidepanel-prop-item">
                <span className="sidepanel-prop-label" title="Métrica T_LLE">3. Traslado al domicilio</span>
                <span className="sidepanel-prop-value mono-tabular font-semibold">
                  {getDeltaMin(tInic, tAsig || tCrea)}
                </span>
              </div>
              <div className="sidepanel-prop-item">
                <span className="sidepanel-prop-label" title="Métrica T_EJE">4. Trabajo en el domicilio</span>
                <span className="sidepanel-prop-value mono-tabular font-semibold">
                  {getDeltaMin(tFin, tInic || tCrea)}
                </span>
              </div>
              <div className="sidepanel-prop-item" style={{ gridColumn: '1 / -1' }}>
                <span className="sidepanel-prop-label" title="Métrica T_TOT">Tiempo total del servicio</span>
                <span className="sidepanel-prop-value mono-tabular font-bold" style={{ color: 'var(--primary)' }}>
                  {getDeltaMin(tVal || tFin, tCrea)}
                </span>
              </div>
            </div>
          </div>

          {/* Línea de tiempo status_history */}
          <div className="sidepanel-card">
            <h4 className="sidepanel-card-title">
              <FileSpreadsheet size={15} /> Historial del servicio
            </h4>

            {loadingHistory ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cargando el historial del servicio…</p>
            ) : history.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Todavía no hay cambios de estado registrados.</p>
            ) : (
              <div className="timeline-container" style={{ marginTop: 8 }}>
                {history.map((item, idx) => {
                  const step = describeTransition(item);
                  return (
                  <div key={item.id || idx} className="timeline-item">
                    <div className="timeline-bullet">
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: HISTORY_TONE_COLORS[step.tone],
                        }}
                      />
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-top">
                        <span className="timeline-state font-semibold" style={{ color: HISTORY_TONE_COLORS[step.tone] }}>{step.title}</span>
                        <span className="timeline-date mono-tabular">{formatDate(item.timestamp)}</span>
                      </div>
                      <p className="timeline-meta" style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                        Registrado por <strong>{actorLabel(item, { clientName: request.clientName, providerName: request.providerName })}</strong>
                      </p>
                      {item.notes && (
                        <p className="timeline-note" style={{ fontSize: 12, marginTop: 4 }}>
                          {item.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: EVIDENCIAS */}
      {activeTab === 'evidencias' && (
        <div className="sidepanel-content-pane">
          <div className="sidepanel-card">
            <h4 className="sidepanel-card-title">
              <ImageIcon size={15} /> Fotos del servicio
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <span className="sidepanel-prop-label" title="Evidencia EVID_INI">Foto inicial del problema</span>
                {request.issuePhoto ? (
                  <div
                    className="evidence-img-container"
                    style={{ marginTop: 6, cursor: 'pointer' }}
                    onClick={() =>
                      setInspectingImage({
                        url: request.issuePhoto!,
                        title: `Foto Inicial (${request.code || 'SOLICITUD'})`,
                      })
                    }
                  >
                    <img src={request.issuePhoto} alt="Problema inicial" className="evidence-img" />
                    <div className="evidence-zoom-overlay">
                      <ZoomIn size={16} />
                      <span>Inspeccionar Zoom</span>
                    </div>
                  </div>
                ) : (
                  <div className="evidence-placeholder" style={{ marginTop: 6 }}>
                    Sin fotografía inicial registrada
                  </div>
                )}
              </div>

              <div>
                <span className="sidepanel-prop-label" title="Evidencia EVID_FIN">Foto del trabajo terminado</span>
                {request.evidencePhoto ? (
                  <div
                    className="evidence-img-container"
                    style={{ marginTop: 6, cursor: 'pointer' }}
                    onClick={() =>
                      setInspectingImage({
                        url: request.evidencePhoto!,
                        title: `Evidencia Final (${request.code || 'SOLICITUD'})`,
                      })
                    }
                  >
                    <img src={request.evidencePhoto} alt="Trabajo culminado" className="evidence-img" />
                    <div className="evidence-zoom-overlay">
                      <ZoomIn size={16} />
                      <span>Inspeccionar Zoom</span>
                    </div>
                  </div>
                ) : (
                  <div className="evidence-placeholder" style={{ marginTop: 6 }}>
                    Pendiente de subir por técnico
                  </div>
                )}
              </div>

              {request.voucher && (
                <div>
                  <span className="sidepanel-prop-label">Comprobante de Pago (Voucher)</span>
                  <div
                    className="evidence-img-container"
                    style={{ marginTop: 6, cursor: 'pointer' }}
                    onClick={() =>
                      setInspectingImage({
                        url: request.voucher!,
                        title: `Comprobante de Pago (${request.code || 'SOLICITUD'})`,
                      })
                    }
                  >
                    <img src={request.voucher} alt="Comprobante" className="evidence-img" />
                    <div className="evidence-zoom-overlay">
                      <ZoomIn size={16} />
                      <span>Inspeccionar Zoom</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: COTIZACIÓN Y PAGO */}
      {activeTab === 'cotizacion' && (
        <div className="sidepanel-content-pane">
          <div className="sidepanel-card">
            <h4 className="sidepanel-card-title">
              <Receipt size={15} /> Tarifas y Liquidación
            </h4>

            <div className="sidepanel-prop-grid">
              <div className="sidepanel-prop-item">
                <span className="sidepanel-prop-label">Tarifa de Visita Diagnóstica</span>
                <span className="sidepanel-prop-value mono-tabular font-semibold">
                  S/ {canonicalPricing.fee.toFixed(2)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Deducible del trabajo final</span>
              </div>

              <div className="sidepanel-prop-item">
                <span className="sidepanel-prop-label">Tarifa Final Acordada</span>
                <span className="sidepanel-prop-value mono-tabular font-semibold">
                  {request.price_agreed || 'Pendiente de cotizar'}
                </span>
              </div>

              <div className="sidepanel-prop-item">
                <span className="sidepanel-prop-label">Aceptación de Cotización</span>
                <span className="sidepanel-prop-value">
                  {request.quoteAccepted ? (
                    <span style={{ color: 'var(--status-completed-fg)', fontWeight: 600 }}>Aprobada por Cliente</span>
                  ) : request.quoteRejectedAt ? (
                    <span style={{ color: 'var(--status-danger-fg)', fontWeight: 600 }}>Rechazada</span>
                  ) : (
                    'Pendiente de Decisión'
                  )}
                </span>
              </div>

              <div className="sidepanel-prop-item">
                <span className="sidepanel-prop-label">Estado de Pago</span>
                <span className="sidepanel-prop-value">
                  {request.paymentStatus === 'CONFIRMED' ? (
                    <span style={{ color: 'var(--status-completed-fg)', fontWeight: 600 }}>Confirmado por Técnico</span>
                  ) : request.paymentStatus === 'PAID' ? (
                    <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Pagado con Comprobante</span>
                  ) : (
                    'Pendiente de Pago'
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modales Secundarios Lazy */}
      <Suspense fallback={null}>
        {isAssignModalOpen && (
          <AssignWorkerModal
            request={request}
            onClose={() => setIsAssignModalOpen(false)}
          />
        )}

        {isLiveMapOpen && (
          <LiveTrackingMapModal
            request={request}
            onClose={() => setIsLiveMapOpen(false)}
          />
        )}

        {isChatModalOpen && (
          <RealtimeChatModal
            request={request}
            onClose={() => setIsChatModalOpen(false)}
          />
        )}

        {inspectingImage && (
          <ImageLightboxModal
            imageUrl={inspectingImage.url}
            title={inspectingImage.title}
            onClose={() => setInspectingImage(null)}
          />
        )}
      </Suspense>
    </SidePanel>
  );
};
