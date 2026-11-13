import { useCallback, useEffect, useState } from 'react';
import type { ServiceRequest } from '../types';
import { X, ShieldCheck, ShieldX, Printer, CheckCircle, MessageCircle, Download, QrCode, RefreshCw } from 'lucide-react';
import { generateWarrantyPDF } from '../utils/pdfGenerator';
import { formatCertificateCode, resolveCertificateState } from '../services/warrantyCertificateModel';
import {
  countScanDays,
  describeCertificateError,
  findCertificateForRequest,
  issueCertificate,
  revokeCertificate,
  verifyUrlFor,
  type WarrantyCertificate,
} from '../services/warrantyCertificateService';
import logoImg from '../assets/logo-maestro.png';

interface Props {
  request: ServiceRequest;
  onClose: () => void;
}

export const WarrantyCertificateModal = ({ request, onClose }: Props) => {
  const getDates = () => {
    const base = request.validatedAt || request.finishedAt || request.createdAt;
    const startDate = base ? (base.toDate ? base.toDate() : new Date(base)) : new Date();
    const expiryDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const isExpired = Date.now() > expiryDate.getTime();

    return {
      start: startDate.toLocaleDateString('es-PE', { dateStyle: 'long' }),
      expiry: expiryDate.toLocaleDateString('es-PE', { dateStyle: 'long' }),
      isExpired,
    };
  };

  const dates = getDates();
  // Evita "Lima, Lima" cuando la dirección y el distrito coinciden o faltan.
  const location = [request.address, request.district].filter((part, index, all) => part && all.indexOf(part) === index).join(', ') || 'Lima';

  // Fecha de apertura: valor de respaldo para "emitido el" sin llamar a Date.now() en cada render.
  const [openedAt] = useState(() => Date.now());
  const [certificate, setCertificate] = useState<WarrantyCertificate | null>(null);
  const [loadingCertificate, setLoadingCertificate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [scanDays, setScanDays] = useState<number | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');

  const certState = certificate ? resolveCertificateState(certificate) : null;
  const sealCode = certificate ? formatCertificateCode(certificate.code) : 'PENDIENTE DE EMISIÓN';
  const isUsable = certState === 'ACTIVE';
  const issuedOn = new Date(certificate?.issuedAt ?? openedAt).toLocaleDateString('es-PE', { dateStyle: 'long' });

  /** QR con corrección de errores media: se lee bien aunque el papel se arrugue o se imprima pequeño. */
  const buildQr = useCallback(async (code: string) => {
    const QRCode = (await import('qrcode')).default;
    return QRCode.toDataURL(verifyUrlFor(code), { margin: 1, width: 320, errorCorrectionLevel: 'M' });
  }, []);

  // Al abrir: busca el certificado ya emitido para esta solicitud (no crea nada por sí solo).
  useEffect(() => {
    let active = true;
    findCertificateForRequest(request.id)
      .then(async (found) => {
        if (!active) return;
        setCertificate(found);
        if (found) {
          setQrDataUrl(await buildQr(found.code));
          countScanDays(found.code).then((count) => { if (active) setScanDays(count); }).catch(() => {});
        }
      })
      .catch((err) => { if (active) setError(describeCertificateError(err, 'No se pudo consultar el certificado.')); })
      .finally(() => { if (active) setLoadingCertificate(false); });
    return () => { active = false; };
  }, [request.id, buildQr]);

  /** Emite el certificado si aún no existe uno vigente. Devuelve el certificado y su QR listos para usar. */
  const ensureCertificate = useCallback(async (): Promise<{ certificate: WarrantyCertificate; qr: string } | null> => {
    if (certificate && isUsable && qrDataUrl) return { certificate, qr: qrDataUrl };
    setBusy(true);
    setError(null);
    try {
      const issued = await issueCertificate(request);
      const qr = await buildQr(issued.code);
      setCertificate(issued);
      setQrDataUrl(qr);
      setScanDays(0);
      return { certificate: issued, qr };
    } catch (err) {
      setError(describeCertificateError(err, 'No se pudo emitir el certificado.'));
      return null;
    } finally {
      setBusy(false);
    }
  }, [certificate, isUsable, qrDataUrl, request, buildQr]);

  const handleIssue = async () => { await ensureCertificate(); };

  const handlePrint = async () => {
    const ready = await ensureCertificate();
    if (!ready) return;
    // Espera a que React pinte el QR antes de abrir la impresión.
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    window.print();
  };

  const handlePdf = async () => {
    const ready = await ensureCertificate();
    if (!ready) return;
    await generateWarrantyPDF(request, { code: ready.certificate.code, url: verifyUrlFor(ready.certificate.code), qrDataUrl: ready.qr });
  };

  const handleRevoke = async () => {
    if (!certificate) return;
    setBusy(true);
    setError(null);
    try {
      await revokeCertificate(certificate.code, revokeReason);
      setCertificate({ ...certificate, status: 'REVOKED', revokedAt: Date.now() });
      setRevokeOpen(false);
      setRevokeReason('');
    } catch (err) {
      setError(describeCertificateError(err, 'No se pudo anular el certificado.'));
    } finally {
      setBusy(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!request.clientPhone) return;
    const ready = await ensureCertificate();
    if (!ready) return;
    const phone = request.clientPhone.replace(/\D/g, '');
    const link = verifyUrlFor(ready.certificate.code);
    const message = `*MAESTRO A DOMICILIO - CERTIFICADO DE GARANTÍA DIGITAL*%0A%0A*Código de Servicio:* ${request.code || 'S/C'}%0A*Titular:* ${request.clientName || 'Cliente Particular'}%0A*Trabajo Realizado:* ${request.serviceLabel || request.specialty}%0A*Técnico Responsable:* ${request.providerName || 'Personal Autorizado'}%0A%0A*Vigencia de Cobertura:*%0A• Inicio: ${dates.start}%0A• Vencimiento: *${dates.expiry}*%0A%0A*Verifica tu certificado aquí:*%0A${encodeURIComponent(link)}%0A*Código:* ${formatCertificateCode(ready.certificate.code)}%0A%0A*Condiciones:* Cubre cualquier reajuste o falla derivada de la mano de obra ejecutada durante 30 días sin costo adicional. Para asistencia inmediata, responda a este mensaje indicando su código.`;
    window.open(`https://wa.me/51${phone}?text=${message}`, '_blank');
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card modal-large printable-proforma-container">
        <div className="modal-header no-print">
          <div className="modal-title-wrap">
            <ShieldCheck size={22} color="#16a34a" />
            <h2>Certificado Oficial de Garantía Post-Servicio</h2>
          </div>
          <button type="button" className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body modal-scrollable">
          <div className="warranty-certificate">
            <div className="cert-border-wrap">
              <div className="cert-header">
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                  <img
                    src={logoImg}
                    alt="Maestro a Domicilio Logo"
                    style={{ height: 52, width: 'auto', objectFit: 'contain', background: '#ffffff', padding: '4px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                </div>
                <h1 className="cert-title">CERTIFICADO DE GARANTÍA DIGITAL</h1>
                <p className="cert-subtitle">MAESTRO A DOMICILIO S.A.C. · COBERTURA TÉCNICA RESIDENCIAL DE 30 DÍAS</p>
                <div className="cert-code">SELLO DE CONFORMIDAD: {sealCode}</div>
              </div>

              <div className="cert-body">
                <p className="cert-statement">
                  Por medio del presente documento, la <strong>Central de Operaciones de Maestro a Domicilio</strong> certifica que el servicio detallado a continuación ha sido culminado y auditado con registro de evidencias conforme a nuestros estándares de calidad:
                </p>

                <div className="cert-grid">
                  <div className="cert-grid-item">
                    <span className="cert-label">Cliente titular</span>
                    <span className="cert-value">{request.clientName || 'Cliente Particular'}</span>
                  </div>
                  <div className="cert-grid-item">
                    <span className="cert-label">Dirección del servicio</span>
                    <span className="cert-value">{location}</span>
                  </div>
                  <div className="cert-grid-item">
                    <span className="cert-label">Servicio ejecutado</span>
                    <span className="cert-value">{request.serviceLabel || request.specialty}</span>
                  </div>
                  <div className="cert-grid-item">
                    <span className="cert-label">Técnico responsable</span>
                    <span className="cert-value">{request.providerName || 'Especialista Registrado'}</span>
                  </div>
                </div>

                <div className="cert-validity-box">
                  <div className="cert-validity-inner">
                    <div className="validity-icon">
                      <ShieldCheck size={32} color="#16a34a" />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, color: dates.isExpired ? '#92400e' : '#16a34a', fontSize: '1rem' }}>
                        {dates.isExpired ? 'Período de Cobertura Garantizada (Vencida)' : 'Período de Cobertura Garantizada (Activa)'}
                      </h4>
                      <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
                        Válido desde el <strong>{dates.start}</strong> hasta el <strong>{dates.expiry}</strong> (30 días naturales).
                      </p>
                    </div>
                  </div>
                </div>

                <div className="cert-clauses">
                  <div className="clause-item">
                    <CheckCircle size={14} color="#0284c7" />
                    <span>Cobertura total de mano de obra y reajuste en caso de reincidencia de la falla reparada.</span>
                  </div>
                  <div className="clause-item">
                    <CheckCircle size={14} color="#0284c7" />
                    <span>Auditoría fotográfica digital (Antes y Después) archivada en el servidor central.</span>
                  </div>
                  <div className="clause-item">
                    <CheckCircle size={14} color="#0284c7" />
                    <span>Atención técnica prioritaria sin costo de visita técnica dentro del plazo de vigencia.</span>
                  </div>
                </div>

                <div className="cert-footer">
                  <div className="cert-verify">
                    {qrDataUrl && certificate ? (
                      <div className="cert-verify-qr">
                        <img src={qrDataUrl} alt={`Código QR para verificar el certificado ${sealCode}`} width={96} height={96} />
                        <div className="cert-verify-text">
                          <span className="cert-verify-label">Verificación</span>
                          <strong className="cert-verify-code mono-tabular">{sealCode}</strong>
                          <small className="cert-verify-help">Escanea el código QR para confirmar que este certificado es auténtico.</small>
                        </div>
                      </div>
                    ) : (
                      <div className="cert-verify-text">
                        <span className="cert-verify-label">Verificación</span>
                        <strong className="cert-verify-code mono-tabular">{loadingCertificate ? 'Consultando…' : 'Sin emitir'}</strong>
                        <small className="cert-verify-help">Al emitir el certificado se genera un código QR verificable.</small>
                      </div>
                    )}
                  </div>

                  <div className="cert-signature">
                    <div className="cert-signature-space" aria-hidden="true" />
                    <div className="cert-signature-line" />
                    <span className="cert-signature-name">Gerencia Técnica de Operaciones</span>
                    <span className="cert-signature-company">Maestro a Domicilio S.A.C.</span>
                    <span className="cert-signature-date">Emitido el {issuedOn}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error ? <p className="cert-alert is-error no-print" role="alert">{error}</p> : null}

        {certificate && certState === 'REVOKED' ? (
          <div className="cert-alert is-revoked no-print" role="status">
            <ShieldX size={16} aria-hidden="true" />
            <span>Este certificado fue anulado y ya no es válido. Emite uno nuevo si la garantía debe continuar.</span>
            <button type="button" className="btn btn-secondary" onClick={handleIssue} disabled={busy}>
              <RefreshCw size={14} aria-hidden="true" /> Emitir uno nuevo
            </button>
          </div>
        ) : null}

        {certificate && isUsable ? (
          <div className="cert-status-row no-print">
            <span className="cert-chip is-active"><ShieldCheck size={14} aria-hidden="true" /> Certificado verificable emitido</span>
            <span className="cert-scan-count">
              {scanDays === null ? '' : scanDays === 0 ? 'Aún sin verificaciones' : `Verificado en ${scanDays} ${scanDays === 1 ? 'día' : 'días'} distintos`}
            </span>
            <button type="button" className="cert-link-danger" onClick={() => setRevokeOpen((open) => !open)} aria-expanded={revokeOpen}>
              Anular certificado
            </button>
          </div>
        ) : null}

        {revokeOpen ? (
          <div className="cert-revoke no-print">
            <label htmlFor="revoke-reason">Motivo de la anulación (solo lo verá la central)</label>
            <textarea id="revoke-reason" rows={2} maxLength={300} value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} placeholder="Ejemplo: el servicio se reabrió por un reclamo del cliente." />
            <div className="cert-revoke-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setRevokeOpen(false)} disabled={busy}>Cancelar</button>
              <button type="button" className="btn btn-danger" onClick={handleRevoke} disabled={busy || revokeReason.trim().length < 5}>
                {busy ? 'Anulando…' : 'Confirmar anulación'}
              </button>
            </div>
          </div>
        ) : null}

        <div className="modal-footer no-print" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {!certificate && !loadingCertificate ? (
              <button type="button" className="btn btn-secondary" onClick={handleIssue} disabled={busy}>
                <QrCode size={16} aria-hidden="true" />
                <span>{busy ? 'Emitiendo…' : 'Emitir certificado verificable'}</span>
              </button>
            ) : null}
            {request.clientPhone && certState !== 'REVOKED' && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ color: '#16a34a', borderColor: '#86efac' }}
                onClick={handleSendWhatsApp}
                disabled={busy}
              >
                <MessageCircle size={16} color="#16a34a" />
                <span>Enviar por WhatsApp</span>
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handlePrint}
              disabled={busy || certState === 'REVOKED'}
              title="Emite el certificado si hace falta y abre la impresión"
            >
              <Printer size={16} />
              <span>Imprimir</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handlePdf}
              disabled={busy || certState === 'REVOKED'}
              title="Emite el certificado si hace falta y descarga el PDF oficial"
            >
              <Download size={16} />
              <span>{busy ? 'Preparando…' : 'Descargar PDF oficial'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
