import type { ServiceRequest } from '../types';
import { X, ShieldCheck, Printer, CheckCircle, MessageCircle, Download } from 'lucide-react';
import { generateWarrantyPDF } from '../utils/pdfGenerator';
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

    return {
      start: startDate.toLocaleDateString('es-PE', { dateStyle: 'long' }),
      expiry: expiryDate.toLocaleDateString('es-PE', { dateStyle: 'long' }),
    };
  };

  const dates = getDates();

  const handlePrint = () => {
    window.print();
  };

  const handleSendWhatsApp = () => {
    if (!request.clientPhone) return;
    const phone = request.clientPhone.replace(/\D/g, '');
    const message = `*MAESTRO A DOMICILIO - CERTIFICADO DE GARANTÍA DIGITAL*%0A%0A*Código de Servicio:* ${request.code || 'S/C'}%0A*Titular:* ${request.clientName || 'Cliente Particular'}%0A*Trabajo Realizado:* ${request.serviceLabel || request.specialty}%0A*Técnico Responsable:* ${request.providerName || 'Personal Autorizado'}%0A%0A*Vigencia de Cobertura:*%0A• Inicio: ${dates.start}%0A• Vencimiento: *${dates.expiry}*%0A%0A*Condiciones:* Cubre cualquier reajuste o falla derivada de la mano de obra ejecutada durante 30 días sin costo adicional. Para asistencia inmediata, responda a este mensaje indicando su código.`;
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
                <div className="cert-code">SELLO DE CONFORMIDAD: {request.code ? `GAR-${request.code.replace('SOL-POST-', '')}-30D` : 'GAR-2026-VAL'}</div>
              </div>

              <div className="cert-body">
                <p className="cert-statement">
                  Por medio del presente documento, la <strong>Central de Operaciones de Maestro a Domicilio</strong> certifica que el servicio detallado a continuación ha sido culminado y auditado con registro de evidencias conforme a nuestros estándares de calidad:
                </p>

                <div className="cert-grid">
                  <div className="cert-grid-item">
                    <span className="cert-label">Cliente Titular:</span>
                    <span className="cert-value">{request.clientName || 'Cliente Particular'}</span>
                  </div>
                  <div className="cert-grid-item">
                    <span className="cert-label">Ubicación / Dirección:</span>
                    <span className="cert-value">{request.address || 'Lima'}, {request.district || 'Lima'}</span>
                  </div>
                  <div className="cert-grid-item">
                    <span className="cert-label">Servicio Ejecutado:</span>
                    <span className="cert-value">{request.serviceLabel || request.specialty}</span>
                  </div>
                  <div className="cert-grid-item">
                    <span className="cert-label">Técnico Certificado:</span>
                    <span className="cert-value">{request.providerName || 'Especialista Registrado'}</span>
                  </div>
                </div>

                <div className="cert-validity-box">
                  <div className="cert-validity-inner">
                    <div className="validity-icon">
                      <ShieldCheck size={32} color="#16a34a" />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, color: '#16a34a', fontSize: '1rem' }}>Período de Cobertura Garantizada</h4>
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
                  <div className="cert-qr-sim">
                    <div className="qr-box">
                      <span>QR VERIFICADOR</span>
                      <strong>{request.code || 'OFICIAL'}</strong>
                    </div>
                  </div>
                  <div className="cert-signatures">
                    <div className="sign-block">
                      <div className="sign-line"></div>
                      <span>Gerencia Técnica de Operaciones</span>
                      <small>Maestro a Domicilio S.A.C.</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer no-print" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            {request.clientPhone && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ color: '#16a34a', borderColor: '#86efac' }}
                onClick={handleSendWhatsApp}
              >
                <MessageCircle size={16} color="#16a34a" />
                <span>Enviar Garantía por WhatsApp</span>
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handlePrint}
              title="Vista de impresión directa del navegador"
            >
              <Printer size={16} />
              <span>Imprimir</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => generateWarrantyPDF(request)}
              title="Generar y descargar certificado PDF oficial vectorial"
            >
              <Download size={16} />
              <span>Descargar PDF Oficial</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
