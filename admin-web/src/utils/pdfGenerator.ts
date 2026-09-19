import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ServiceRequest } from '../types';
import logoImg from '../assets/logo-maestro.png';

export interface QuotePDFData {
  request: ServiceRequest;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  subtotal: number;
  igv: number;
  total: number;
  notes: string;
}

const loadLogo = (): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = logoImg;
  });
};

/**
 * Genera y descarga un PDF vectorial de alta calidad para la Proforma / Cotización con logo
 */
export const generateProformaPDF = async (data: QuotePDFData) => {
  const { request, items, subtotal, igv, total, notes } = data;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const logo = await loadLogo();

  const primaryColor: [number, number, number] = [37, 99, 235]; // #2563eb
  const darkTextColor: [number, number, number] = [15, 23, 42]; // #0f172a
  const mutedTextColor: [number, number, number] = [100, 116, 139]; // #64748b

  // ── 1. Encabezado Corporativo ──
  doc.setFillColor(37, 99, 235);
  doc.rect(14, 14, 182, 3, 'F');

  if (logo) {
    doc.addImage(logo, 'PNG', 14, 19, 32, 14);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...primaryColor);
    doc.text('MAESTRO A DOMICILIO S.A.C.', 49, 24);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...mutedTextColor);
    doc.text('R.U.C. 20608942110 · Servicios Técnicos y Mantenimiento Residencial', 49, 28.5);
    doc.text('Central de Operaciones Lima · Tel: (01) 700-8890 · www.maestroadomicilio.pe', 49, 33);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...primaryColor);
    doc.text('MAESTRO A DOMICILIO S.A.C.', 14, 25);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...mutedTextColor);
    doc.text('R.U.C. 20608942110 · Servicios Técnicos y Mantenimiento Residencial', 14, 30);
    doc.text('Central de Operaciones Lima · Tel: (01) 700-8890 · www.maestroadomicilio.pe', 14, 34);
  }

  // Cuadro de Número de Cotización (Derecha)
  doc.setDrawColor(37, 99, 235);
  doc.setFillColor(240, 249, 255);
  doc.roundedRect(132, 20, 64, 16, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);
  doc.text('COTIZACIÓN FORMAL', 164, 25, { align: 'center' });

  const cotNumber = request.code ? `COT-${request.code.replace('SOL-POST-', '')}` : 'COT-2026-0001';
  doc.setFontSize(11);
  doc.setTextColor(...darkTextColor);
  doc.text(cotNumber, 164, 30, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setTextColor(...mutedTextColor);
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-PE')}`, 164, 34, { align: 'center' });

  // ── 2. Cuadro de Información del Cliente & Servicio ──
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 42, 182, 26, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...darkTextColor);
  doc.text('INFORMACIÓN DEL CLIENTE Y SERVICIO', 18, 48);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Cliente:`, 18, 54);
  doc.setFont('helvetica', 'bold');
  doc.text(request.clientName || 'Cliente Particular', 35, 54);

  doc.setFont('helvetica', 'normal');
  doc.text(`Teléfono:`, 18, 60);
  doc.text(request.clientPhone || 'No registrado', 35, 60);

  doc.text(`Distrito:`, 18, 65);
  doc.text(request.district || 'Lima Metropolitana', 35, 65);

  doc.text(`Dirección:`, 105, 54);
  doc.text(request.address || 'Domicilio del cliente', 125, 54);

  doc.text(`Especialidad:`, 105, 60);
  doc.setFont('helvetica', 'bold');
  doc.text(request.serviceLabel || request.specialty || 'General', 125, 60);

  doc.setFont('helvetica', 'normal');
  doc.text(`Técnico Asig.:`, 105, 65);
  doc.text(request.providerName || 'Personal Técnico Calificado', 125, 65);

  // ── 3. Tabla de Conceptos (AutoTable) ──
  const tableRows = items.map((item, idx) => [
    (idx + 1).toString(),
    item.description,
    item.quantity.toString(),
    `S/. ${item.unitPrice.toFixed(2)}`,
    `S/. ${(item.quantity * item.unitPrice).toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: 73,
    head: [['#', 'Descripción del Servicio / Repuestos', 'Cant.', 'P. Unitario', 'Total']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'left',
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 105 },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 120;

  // ── 4. Totales y Términos de Garantía ──
  // Términos y Notas
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, finalY + 6, 110, 32, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...darkTextColor);
  doc.text('TÉRMINOS Y CONDICIONES DE GARANTÍA', 18, finalY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...mutedTextColor);
  const splitNotes = doc.splitTextToSize(notes || 'Incluye 30 días de garantía post-servicio sobre mano de obra.', 102);
  doc.text(splitNotes, 18, finalY + 17);

  // Cuadro de Totales (Derecha)
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(128, finalY + 6, 68, 32, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkTextColor);
  doc.text('Subtotal:', 132, finalY + 13);
  doc.text(`S/. ${subtotal.toFixed(2)}`, 190, finalY + 13, { align: 'right' });

  doc.text('I.G.V. (18%):', 132, finalY + 20);
  doc.text(`S/. ${igv.toFixed(2)}`, 190, finalY + 20, { align: 'right' });

  doc.setFillColor(37, 99, 235);
  doc.rect(128, finalY + 25, 68, 13, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL:', 132, finalY + 33);
  doc.text(`S/. ${total.toFixed(2)}`, 190, finalY + 33, { align: 'right' });

  // ── 5. Pie de Página y Sello de Garantía ──
  const footerY = Math.max(finalY + 50, 245);

  // Sello 30 Días
  doc.setDrawColor(22, 163, 74);
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(14, footerY, 50, 18, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(22, 163, 74);
  doc.text('🛡️ GARANTÍA CERTIFICADA', 39, footerY + 6, { align: 'center' });
  doc.setFontSize(10);
  doc.text('30 DÍAS', 39, footerY + 11, { align: 'center' });
  doc.setFontSize(6.5);
  doc.text('RESPALDO MULTISERVICIOS', 39, footerY + 15, { align: 'center' });

  // Firma
  doc.setDrawColor(100, 116, 139);
  doc.line(130, footerY + 12, 190, footerY + 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...darkTextColor);
  doc.text('Central de Operaciones & Calidad', 160, footerY + 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...mutedTextColor);
  doc.text('Maestro a Domicilio S.A.C.', 160, footerY + 20, { align: 'center' });

  // Descarga directa
  const fileName = `Cotizacion_${request.code || 'SOLICITUD'}.pdf`;
  doc.save(fileName);
};

/**
 * Genera y descarga un PDF vectorial oficial para el Certificado de Garantía 30 Días con logo
 */
export const generateWarrantyPDF = async (request: ServiceRequest) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const logo = await loadLogo();

  const base = request.validatedAt || request.finishedAt || request.createdAt;
  const startDate = base ? (base.toDate ? base.toDate() : new Date(base)) : new Date();
  const expiryDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

  const startStr = startDate.toLocaleDateString('es-PE', { dateStyle: 'long' });
  const expStr = expiryDate.toLocaleDateString('es-PE', { dateStyle: 'long' });

  // Marco decorativo doble
  doc.setDrawColor(2, 132, 199);
  doc.setLineWidth(1.5);
  doc.rect(10, 10, 190, 277);

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.rect(13, 13, 184, 271);

  // Logo centrado en cabecera
  if (logo) {
    doc.addImage(logo, 'PNG', 85, 17, 40, 17);
  }

  // Encabezado
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(2, 132, 199);
  doc.text('CERTIFICADO DE GARANTÍA DIGITAL', 105, 40, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('MAESTRO A DOMICILIO S.A.C. · COBERTURA TÉCNICA RESIDENCIAL DE 30 DÍAS', 105, 45, { align: 'center' });

  doc.setFillColor(240, 249, 255);
  doc.setDrawColor(2, 132, 199);
  doc.roundedRect(55, 49, 100, 7.5, 3.5, 3.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(2, 132, 199);
  doc.text(`SELLO DE CONFORMIDAD: GAR-${request.code ? request.code.replace('SOL-POST-', '') : '2026'}-30D`, 105, 54, { align: 'center' });

  // Declaración
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  const statement = 'Por medio del presente documento, la Central de Operaciones de Maestro a Domicilio certifica que el servicio técnico detallado a continuación ha sido culminado satisfactoriamente y auditado bajo registro de evidencias fotográficas, contando con respaldo post-servicio:';
  const splitStatement = doc.splitTextToSize(statement, 160);
  doc.text(splitStatement, 25, 63);

  // Grid de datos
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(25, 78, 160, 42, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Cliente Titular:', 30, 87);
  doc.setFont('helvetica', 'normal');
  doc.text(request.clientName || 'Cliente Particular', 65, 87);

  doc.setFont('helvetica', 'bold');
  doc.text('Dirección:', 30, 95);
  doc.setFont('helvetica', 'normal');
  doc.text(`${request.address || 'Lima'}, ${request.district || 'Lima'}`, 65, 95);

  doc.setFont('helvetica', 'bold');
  doc.text('Servicio Ejecutado:', 30, 103);
  doc.setFont('helvetica', 'normal');
  doc.text(request.serviceLabel || request.specialty || 'Servicio General', 65, 103);

  doc.setFont('helvetica', 'bold');
  doc.text('Técnico Responsable:', 30, 111);
  doc.setFont('helvetica', 'normal');
  doc.text(request.providerName || 'Especialista Autorizado', 65, 111);

  // Período de Validez
  doc.setDrawColor(22, 163, 74);
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(25, 128, 160, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(22, 163, 74);
  doc.text('PERÍODO DE COBERTURA GARANTIZADA (30 DÍAS)', 105, 136, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`Válido desde el ${startStr} hasta el ${expStr}`, 105, 143, { align: 'center' });

  // Cláusulas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('TÉRMINOS Y ALCANCE DE LA GARANTÍA:', 25, 162);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  const clauses = [
    '1. Cobertura de Mano de Obra: Ante cualquier reincidencia de la falla reportada, se enviará un técnico de reajuste sin cobro de visita diagnóstica ni tarifa de servicio adicional.',
    '2. Trazabilidad Fotográfica: El servicio cuenta con respaldo fotográfico de Antes (EVID_INI) y Después (EVID_FIN) validado por la central.',
    '3. Soporte Inmediato: El cliente puede solicitar activación de garantía directamente desde la aplicación móvil o comunicándose a la central con su código de solicitud.',
  ];

  let currentY = 170;
  clauses.forEach((cl) => {
    const splitCl = doc.splitTextToSize(cl, 160);
    doc.text(splitCl, 25, currentY);
    currentY += splitCl.length * 5 + 3;
  });

  // Firmas y QR simulado
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(1);
  doc.rect(30, 225, 28, 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('QR VERIFICACIÓN', 44, 237, { align: 'center' });
  doc.setFontSize(8);
  doc.text(request.code || 'OFICIAL', 44, 243, { align: 'center' });

  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.5);
  doc.line(115, 240, 175, 240);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Gerencia Técnica de Calidad', 145, 245, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Maestro a Domicilio S.A.C.', 145, 249, { align: 'center' });

  const fileName = `Certificado_Garantia_${request.code || '30D'}.pdf`;
  doc.save(fileName);
};
