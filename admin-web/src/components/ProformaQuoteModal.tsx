import { useState } from 'react';
import type { ServiceRequest } from '../types';
import { X, Printer, MessageCircle, FileCheck, Plus, Trash2, Download } from 'lucide-react';
import { generateProformaPDF } from '../utils/pdfGenerator';
import logoImg from '../assets/logo-maestro.png';

interface Props {
  request: ServiceRequest;
  onClose: () => void;
}

interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export const ProformaQuoteModal = ({ request, onClose }: Props) => {
  const [items, setItems] = useState<QuoteItem[]>([
    {
      id: '1',
      description: request.serviceLabel || request.specialty || 'Servicio técnico especializado',
      quantity: 1,
      unitPrice: request.technicalVisitFee || 50,
    },
  ]);
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemPrice, setNewItemPrice] = useState<number>(30);
  const [notes, setNotes] = useState('Incluye 30 días de garantía post-servicio sobre la mano de obra realizada. Tarifa diagnóstica deducible del monto final.');

  const addItem = () => {
    if (!newItemDesc.trim() || newItemPrice <= 0) return;
    setItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        description: newItemDesc.trim(),
        quantity: 1,
        unitPrice: newItemPrice,
      },
    ]);
    setNewItemDesc('');
    setNewItemPrice(30);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const subtotal = items.reduce((acc, curr) => acc + curr.quantity * curr.unitPrice, 0);
  const igv = subtotal * 0.18;
  const total = subtotal + igv;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    await generateProformaPDF({
      request,
      items,
      subtotal,
      igv,
      total,
      notes,
    });
  };

  const handleSendWhatsApp = () => {
    if (!request.clientPhone) return;
    const phone = request.clientPhone.replace(/\D/g, '');
    const itemsText = items.map((i) => `• ${i.description}: S/. ${i.unitPrice.toFixed(2)}`).join('%0A');
    const message = `*MAESTRO A DOMICILIO - COTIZACIÓN FORMAL*%0A%0A*Solicitud:* ${request.code || 'S/C'}%0A*Cliente:* ${request.clientName || 'Estimado(a)'}%0A*Servicio:* ${request.serviceLabel || request.specialty}%0A%0A*Detalle de Trabajos:*%0A${itemsText}%0A%0A*TOTAL ESTIMADO:* S/. ${total.toFixed(2)} (Inc. IGV)%0A*Garantía:* 30 días calendario post-servicio.%0A%0A¿Desea que confirmemos al técnico para iniciar?`;
    window.open(`https://wa.me/51${phone}?text=${message}`, '_blank');
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card modal-large printable-proforma-container">
        {/* Cabecera Modal (Oculta al imprimir) */}
        <div className="modal-header no-print">
          <div className="modal-title-wrap">
            <FileCheck size={20} color="#2563eb" />
            <h2>Generador de Cotización / Proforma Formal</h2>
          </div>
          <button type="button" className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body modal-scrollable">
          {/* Documento Proforma Membretado */}
          <div className="proforma-document">
            <div className="proforma-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <img
                  src={logoImg}
                  alt="Maestro a Domicilio Logo"
                  style={{ height: 44, width: 'auto', objectFit: 'contain', display: 'block' }}
                />
                <div>
                  <h2 className="proforma-company" style={{ margin: 0 }}>MAESTRO A DOMICILIO S.A.C.</h2>
                  <p className="proforma-sub">R.U.C. 20608942110 · Servicios Técnicos y Mantenimiento Residencial</p>
                  <p className="proforma-sub">Central de Operaciones Lima · Tel: (01) 700-8890</p>
                </div>
              </div>
              <div className="proforma-doc-info">
                <span className="proforma-badge">PROFORMA TÉCNICA</span>
                <span className="proforma-number">N° {request.code ? `COT-${request.code.replace('SOL-POST-', '')}` : 'COT-2026-001'}</span>
                <span className="proforma-date">Fecha: {new Date().toLocaleDateString('es-PE')}</span>
              </div>
            </div>

            <hr className="proforma-divider" />

            {/* Datos del Cliente */}
            <div className="proforma-grid-two">
              <div>
                <p><strong>Cliente:</strong> {request.clientName || 'Cliente Particular'}</p>
                <p><strong>Teléfono:</strong> {request.clientPhone || 'No registrado'}</p>
                <p><strong>Distrito:</strong> {request.district || 'Lima Metropolitana'}</p>
              </div>
              <div>
                <p><strong>Dirección:</strong> {request.address || 'Domicilio del cliente'}</p>
                <p><strong>Especialidad:</strong> {request.serviceLabel || request.specialty}</p>
                <p><strong>Técnico Asignado:</strong> {request.providerName || 'Personal Autorizado'}</p>
              </div>
            </div>

            {/* Editor de Ítems (Sólo pantalla) */}
            <div className="no-print proforma-item-editor">
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Agregar concepto / repuesto a la cotización:</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <input
                  type="text"
                  placeholder="Descripción del trabajo o material..."
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  style={{ flex: 2 }}
                />
                <input
                  type="number"
                  placeholder="Precio S/."
                  value={newItemPrice || ''}
                  onChange={(e) => setNewItemPrice(Number(e.target.value))}
                  style={{ width: 110 }}
                />
                <button type="button" className="btn btn-secondary" onClick={addItem}>
                  <Plus size={16} />
                  <span>Añadir</span>
                </button>
              </div>
            </div>

            {/* Tabla de Ítems */}
            <table className="proforma-table">
              <thead>
                <tr>
                  <th style={{ width: '60%' }}>Descripción del Servicio / Insumos</th>
                  <th style={{ textAlign: 'center', width: '15%' }}>Cant.</th>
                  <th style={{ textAlign: 'right', width: '15%' }}>P. Unit (S/.)</th>
                  <th style={{ textAlign: 'right', width: '10%' }}>Total</th>
                  <th className="no-print" style={{ width: '5%' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.description}</td>
                    <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                    <td style={{ textAlign: 'right' }}>S/. {item.unitPrice.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>S/. {(item.quantity * item.unitPrice).toFixed(2)}</td>
                    <td className="no-print" style={{ textAlign: 'center' }}>
                      {items.length > 1 && (
                        <button
                          type="button"
                          className="btn-icon-danger"
                          onClick={() => removeItem(item.id)}
                          title="Eliminar concepto"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Resumen de Totales */}
            <div className="proforma-totals-wrap">
              <div className="proforma-notes">
                <strong>Términos & Condiciones de Garantía:</strong>
                <p>{notes}</p>
                <textarea
                  className="no-print proforma-notes-edit"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="proforma-totals-table">
                <div className="proforma-total-row">
                  <span>Subtotal:</span>
                  <span>S/. {subtotal.toFixed(2)}</span>
                </div>
                <div className="proforma-total-row">
                  <span>I.G.V. (18%):</span>
                  <span>S/. {igv.toFixed(2)}</span>
                </div>
                <div className="proforma-total-row proforma-total-final">
                  <span>TOTAL ESTIMADO:</span>
                  <span>S/. {total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Sello de Garantía y Firma */}
            <div className="proforma-footer">
              <div className="proforma-stamp">
                <div className="stamp-circle">
                  <span>🛡️ COBERTURA</span>
                  <strong>30 DÍAS</strong>
                  <span>GARANTIZADO</span>
                </div>
              </div>
              <div className="proforma-sign">
                <div className="sign-line"></div>
                <span>Central de Operaciones & Calidad</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Maestro a Domicilio S.A.C.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Acciones del Modal */}
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
                <span>Enviar por WhatsApp</span>
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
              onClick={handleDownloadPDF}
              title="Generar y descargar archivo PDF de alta resolución vectorial"
            >
              <Download size={16} />
              <span>Descargar PDF Vectorial</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
