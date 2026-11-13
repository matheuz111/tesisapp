import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Circle, Clock, FileText, ShieldAlert, ShieldCheck, UserCheck, X } from 'lucide-react';
import type { ServiceRequest } from '../../types';
import { StatusBadge } from '../StatusBadge';
import { computeRequestSla } from '../SlaTrafficBadge';
import {
  PAYMENT_LABELS,
  buildTimeline,
  canAssign,
  describeSla,
  explainStage,
  formatDateTime,
  formatElapsed,
  getWarranty,
  isClosed,
} from './requestPresentation';
import { toMillis } from '../../utils/dashboardStats';

interface StatusDetailModalProps {
  request: ServiceRequest;
  onClose: () => void;
  onOpenDetail: (request: ServiceRequest) => void;
  onAssign: (request: ServiceRequest) => void;
}

/**
 * Detalle del estado de una solicitud, pensado para leerse sin capacitación:
 * qué pasa, qué hacer ahora, cuánto tiempo lleva, hitos, pago y garantía.
 */
export const StatusDetailModal: React.FC<StatusDetailModalProps> = ({ request, onClose, onOpenDetail, onAssign }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Instante de apertura: el "hace X" se calcula una vez, sin llamar a Date.now() en cada render.
  const [openedAt] = useState(() => Date.now());
  const stage = explainStage(request);
  const sla = computeRequestSla(request, true);
  const warranty = getWarranty(request);
  const timeline = buildTimeline(request);
  const reached = timeline.filter((step) => toMillis(step.at) !== null).length;
  const slaText = describeSla(sla);
  const assignable = canAssign(request);

  // Foco dentro del diálogo al abrir y cierre con Escape.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [onClose]);

  const titleId = `status-detail-title-${request.id}`;

  return (
    <div className="rq-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rq-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={dialogRef}>
        <header className="rq-modal-header">
          <div>
            <h2 id={titleId} className="rq-modal-title">Estado de la solicitud</h2>
            <p className="rq-modal-subtitle mono-tabular">{request.code || 'SOL-PEND'} · {request.clientName || 'Cliente particular'}</p>
          </div>
          <button type="button" className="rq-icon-btn" onClick={onClose} aria-label="Cerrar detalle del estado">
            <X size={18} />
          </button>
        </header>

        <div className="rq-modal-body">
          <section className={`rq-callout${stage.needsAction ? ' is-action' : ''}`} aria-label="Resumen">
            <StatusBadge status={request.status} />
            <p className="rq-callout-what">{stage.what}</p>
            <p className="rq-callout-next">
              <strong>{stage.needsAction ? 'Qué hacer ahora: ' : 'Siguiente paso: '}</strong>
              {stage.next}
            </p>
          </section>

          <div className="rq-facts">
            <div className="rq-fact">
              <span className="rq-fact-label"><Clock size={13} aria-hidden="true" /> Tiempo en esta etapa</span>
              <span className={`rq-fact-value rq-tone-${sla.level.toLowerCase()}`}>
                {slaText || 'Servicio cerrado'}
              </span>
              <span className="rq-fact-help">{sla.subtext}</span>
            </div>

            <div className="rq-fact">
              <span className="rq-fact-label"><UserCheck size={13} aria-hidden="true" /> Técnico</span>
              <span className="rq-fact-value">{request.providerName || 'Sin asignar'}</span>
              {request.providerPhone ? <span className="rq-fact-help mono-tabular">{request.providerPhone}</span> : null}
            </div>

            <div className="rq-fact">
              <span className="rq-fact-label"><FileText size={13} aria-hidden="true" /> Pago</span>
              <span className="rq-fact-value">{PAYMENT_LABELS[request.paymentStatus || 'PENDING'] || 'Pago pendiente'}</span>
              {request.voucher ? <span className="rq-fact-help">Comprobante adjunto</span> : null}
            </div>

            {isClosed(request) ? (
              <div className="rq-fact">
                <span className="rq-fact-label">
                  {warranty?.active ? <ShieldCheck size={13} aria-hidden="true" /> : <ShieldAlert size={13} aria-hidden="true" />} Garantía
                </span>
                <span className={`rq-fact-value ${warranty?.active ? 'rq-tone-ok' : 'rq-tone-muted'}`}>
                  {warranty ? warranty.label : 'Sin fecha de cierre'}
                </span>
                {warranty ? <span className="rq-fact-help">{warranty.active ? 'Vence' : 'Venció'} el {warranty.expiryDate}</span> : null}
              </div>
            ) : null}
          </div>

          <section aria-label="Seguimiento del servicio">
            <h3 className="rq-section-title">Seguimiento · {reached} de {timeline.length} hitos</h3>
            <ol className="rq-timeline">
              {timeline.map((step) => {
                const when = formatDateTime(step.at);
                const done = toMillis(step.at) !== null;
                return (
                  <li key={step.key} className={`rq-timeline-item${done ? ' is-done' : ''}`}>
                    {done ? <CheckCircle2 size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
                    <span className="rq-timeline-label">{step.label}</span>
                    <span className="rq-timeline-when mono-tabular">
                      {done ? `${when.date} · ${when.time}` : 'Pendiente'}
                    </span>
                  </li>
                );
              })}
            </ol>
            {request.createdAt ? (
              <p className="rq-modal-note">
                Ingresó hace {formatElapsed(Math.max(0, Math.round((openedAt - (toMillis(request.createdAt) ?? openedAt)) / 60000)))}.
              </p>
            ) : null}
          </section>
        </div>

        <footer className="rq-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cerrar</button>
          {assignable ? (
            <button type="button" className="btn btn-primary" onClick={() => { onClose(); onAssign(request); }}>
              {request.status === 'REQUIRES_REASSIGNMENT' ? 'Reasignar técnico' : 'Asignar técnico'}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => { onClose(); onOpenDetail(request); }}>
              Abrir ficha completa
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};
