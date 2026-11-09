import { useState } from 'react';
import { collection, doc, runTransaction, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
  X,
  PlusCircle,
  Loader2,
  Phone,
  MessageSquare,
  Mail,
  Globe,
  Smartphone,
  Zap,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  MapPin,
  Sparkles,
} from 'lucide-react';
import type { IntakeChannel, Priority } from '../types';
import { getDefaultVisitFee, getFormattedVisitFee } from '../services/pricingPolicyService';
import { resolveOperationalZone } from '../types/canonical';
import { syncUserToGoogleSheet } from '../services/googleSheetsSync';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (code: string) => void;
}

const DISTRICT_GROUPS = [
  {
    zone: 'Lima Centro',
    districts: [
      'Miraflores',
      'San Isidro',
      'San Borja',
      'Santiago de Surco',
      'Jesús María',
      'Magdalena del Mar',
      'Pueblo Libre',
      'Lince',
      'Barranco',
      'Surquillo',
      'Cercado de Lima',
      'San Miguel',
      'Breña',
      'La Victoria',
      'Rímac',
    ],
  },
  {
    zone: 'Lima Norte',
    districts: [
      'Los Olivos',
      'San Martín de Porres',
      'Independencia',
      'Comas',
      'Carabayllo',
      'Puente Piedra',
      'Ancón',
      'Santa Rosa',
    ],
  },
  {
    zone: 'Lima Sur',
    districts: [
      'Chorrillos',
      'San Juan de Miraflores',
      'Villa María del Triunfo',
      'Villa El Salvador',
      'Lurín',
      'Pachacámac',
      'San Bartolo',
      'Punta Hermosa',
      'Punta Negra',
      'Santa María del Mar',
      'Pucusana',
    ],
  },
  {
    zone: 'Lima Este',
    districts: [
      'La Molina',
      'Ate',
      'San Juan de Lurigancho',
      'Santa Anita',
      'El Agustino',
      'Lurigancho-Chosica',
      'Chaclacayo',
      'Cieneguilla',
    ],
  },
  {
    zone: 'Callao',
    districts: [
      'Callao',
      'Bellavista',
      'Carmen de la Legua',
      'La Perla',
      'La Punta',
      'Ventanilla',
      'Mi Perú',
    ],
  },
];

const SPECIALTIES = [
  { id: 'Gasfitero', label: 'Gasfitería' },
  { id: 'Electricista', label: 'Electricidad' },
  { id: 'Pintor', label: 'Pintura' },
  { id: 'Carpintero', label: 'Carpintería' },
  { id: 'Albañil', label: 'Albañilería' },
  { id: 'Cerrajero', label: 'Cerrajería' },
  { id: 'Tecnico', label: 'Línea Blanca / TV' },
  { id: 'Otro', label: 'Otro Servicio' },
];

export const NewManualRequestModal = ({ isOpen, onClose, onCreated }: Props) => {
  const { user, userName } = useAuth();
  const [intakeChannel, setIntakeChannel] = useState<IntakeChannel>('WHATSAPP');
  const [urgency, setUrgency] = useState<'NOW' | 'TODAY' | 'SCHEDULED'>('TODAY');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [specialty, setSpecialty] = useState('Gasfitero');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [district, setDistrict] = useState('Miraflores');
  const [address, setAddress] = useState('');
  const [addressReference, setAddressReference] = useState('');
  const [description, setDescription] = useState('');
  const [searchingPhone, setSearchingPhone] = useState(false);
  const [recurringClient, setRecurringClient] = useState<{ name: string; count: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Contador dinámico de campos faltantes
  const missingFields: string[] = [];
  if (!intakeChannel) missingFields.push('Canal de Ingreso');
  if (clientName.trim().length < 3) missingFields.push('Nombre');
  if (clientPhone.trim().replace(/\D/g, '').length < 8) missingFields.push('Teléfono');
  if (!district) missingFields.push('Distrito');
  if (address.trim().length < 4) missingFields.push('Dirección');
  if (description.trim().length < 6) missingFields.push('Falla');
  if (urgency === 'SCHEDULED' && !preferredDate) missingFields.push('Fecha');

  const totalRequired = urgency === 'SCHEDULED' ? 7 : 6;
  const completedFields = totalRequired - missingFields.length;
  const progressPct = Math.round((completedFields / totalRequired) * 100);
  const isCompleteRegistration = missingFields.length === 0;

  const handlePhoneChange = async (val: string) => {
    setClientPhone(val);
    const digits = val.trim().replace(/\D/g, '');
    if (digits.length >= 8) {
      setSearchingPhone(true);
      try {
        const q = query(collection(db, 'service_requests'), where('clientPhone', '==', val.trim()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const prevData = snap.docs[0].data();
          if (prevData.clientName && !clientName) setClientName(prevData.clientName);
          if (prevData.district) setDistrict(prevData.district);
          if (prevData.address && !address) setAddress(prevData.address);
          if (prevData.addressReference && !addressReference) setAddressReference(prevData.addressReference);
          setRecurringClient({ name: prevData.clientName || 'Cliente', count: snap.size });
        } else {
          setRecurringClient(null);
        }
      } catch {
        // Ignorar
      } finally {
        setSearchingPhone(false);
      }
    } else {
      setRecurringClient(null);
    }
  };

  const QUICK_PRESETS: Record<string, Array<{ text: string }>> = {
    Gasfitero: [
      { text: 'Fuga de agua en llave de paso o tubería empotrada' },
      { text: 'Destape de inodoro / desagüe atorado' },
      { text: 'Instalación o cambio de grifería y llaves angulares' },
    ],
    Electricista: [
      { text: 'Cortocircuito / Salto de llave termomagnética' },
      { text: 'Instalación de luminaria / tomacorrientes a tierra' },
      { text: 'Revisión técnica de tablero eléctrico' },
    ],
    Cerrajero: [
      { text: 'Apertura de puerta trabada / llave rota' },
      { text: 'Cambio de cerradura de alta seguridad' },
    ],
    Tecnico: [
      { text: 'Revisión de lavadora (no centrifuga / pierde agua)' },
      { text: 'Carga de gas para refrigeradora' },
    ],
  };

  const applyPreset = (presetText: string) => {
    setDescription((prev) => (prev ? `${prev} - ${presetText}` : presetText));
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!clientName.trim() || !address.trim() || !description.trim()) {
      setError('Por favor completa todos los campos requeridos marcados con (*).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let generatedCode = '';
      await runTransaction(db, async (transaction) => {
        // 1. Obtener correlativo atómico SOL-POST-xxxx
        const counterRef = doc(db, 'counters', 'service_requests');
        const counterSnap = await transaction.get(counterRef);
        let nextNumber = 1;
        if (counterSnap.exists()) {
          nextNumber = (counterSnap.data().current || 0) + 1;
          transaction.update(counterRef, { current: nextNumber, updatedAt: serverTimestamp() });
        } else {
          transaction.set(counterRef, { current: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        }
        generatedCode = `SOL-POST-${String(nextNumber).padStart(4, '0')}`;

        // 2. Crear documento de la solicitud
        const newRequestRef = doc(collection(db, 'service_requests'));
        const securityPin = Math.floor(1000 + Math.random() * 9000).toString();
        const calculatedZone = resolveOperationalZone({ district });

        transaction.set(newRequestRef, {
          code: generatedCode,
          intakeChannel,
          origin: 'OPERATOR',
          datosCompletos: isCompleteRegistration,
          status: 'PENDING_ASSIGNMENT',
          clientName: clientName.trim(),
          clientPhone: clientPhone.trim(),
          specialty,
          serviceLabel: SPECIALTIES.find((s) => s.id === specialty)?.label || specialty,
          priority: urgency === 'NOW' ? 'HIGH' : priority,
          urgency,
          preferredDate: urgency === 'SCHEDULED' ? preferredDate : null,
          preferredTime: urgency === 'SCHEDULED' ? preferredTime : null,
          district,
          zone: calculatedZone,
          address: address.trim(),
          addressReference: addressReference.trim(),
          description: description.trim(),
          technicalVisitFee: getDefaultVisitFee(calculatedZone, specialty),
          price_agreed: getFormattedVisitFee(calculatedZone, specialty),
          securityPin,
          operatorId: user?.uid,
          operatorName: userName || 'Central',
          createdAt: serverTimestamp(),
          firstResponseAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // 3. Crear hito inicial en status_history
        const historyRef = doc(collection(db, 'service_requests', newRequestRef.id, 'status_history'));
        transaction.set(historyRef, {
          fromStatus: null,
          toStatus: 'PENDING_ASSIGNMENT',
          actorId: user?.uid || 'central',
          actorRole: 'OPERATOR',
          timestamp: serverTimestamp(),
          notes: `Transcripción manual vía ${intakeChannel} [Urgencia: ${urgency}]`,
        });
      });

      // Sincronización en segundo plano con Google Sheets del cliente registrado
      syncUserToGoogleSheet({
        uid: `manual-${Date.now()}`,
        name: clientName.trim(),
        phone: clientPhone.trim(),
        district,
        zone: resolveOperationalZone({ district }),
        role: 'CLIENTE',
        is_verified: true,
      }).catch(() => {});

      onCreated(generatedCode);
      onClose();
    } catch (err: any) {
      console.error('Error al registrar pedido manual:', err);
      setError(err.message || 'No se pudo registrar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop-smooth">
      <div className="modal-sheet-curved">
        {/* Cabecera Estilizada y Curva */}
        <div className="modal-sheet-header">
          <div className="header-badge-title">
            <div className="icon-badge-round">
              <PlusCircle size={20} color="var(--primary)" />
            </div>
            <div>
              <h2 className="sheet-main-title">Nuevo Registro de Pedido</h2>
              <p className="sheet-sub-title">Central de Despacho & Trazabilidad · Transcripción Inmediata</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Medidor de Progreso */}
            <div className="progress-meter-box">
              <div className="progress-meter-label">
                <span>Progreso: {progressPct}%</span>
                <span className="mono-tabular">({completedFields}/{totalRequired})</span>
              </div>
              <div className="progress-meter-bar-track">
                <div
                  className="progress-meter-bar-fill"
                  style={{
                    width: `${progressPct}%`,
                    backgroundColor: isCompleteRegistration ? 'var(--status-completed-fg)' : 'var(--primary)',
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              className="btn-close-round"
              onClick={onClose}
              disabled={loading}
              title="Cerrar ventana (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {error && (
          <div className="alert-sheet-danger">
            <AlertTriangle size={15} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-sheet-body">
          {/* SECCIÓN 1: CANAL DE INGRESO & URGENCIAS */}
          <div className="form-section-card">
            <div className="section-card-header">
              <div className="section-title-with-icon">
                <Sparkles size={15} color="var(--primary)" />
                <span className="section-title-text">1. Canal de Ingreso & Urgencia Operativa</span>
              </div>
              {isCompleteRegistration ? (
                <span className="badge-status-pill badge-pill-success">
                  <CheckCircle2 size={12} />
                  <span>Registro Completo</span>
                </span>
              ) : (
                <span className="badge-status-pill badge-pill-pending">
                  <AlertTriangle size={12} />
                  <span>Falta: {missingFields.join(', ')}</span>
                </span>
              )}
            </div>

            {/* Selector de Canales con Tarjetas Interactivas Redondeadas */}
            <div className="channel-cards-selector">
              {(
                [
                  { id: 'WHATSAPP', label: 'WhatsApp', icon: <MessageSquare size={16} color="#16a34a" /> },
                  { id: 'PHONE', label: 'Llamada Central', icon: <Phone size={16} color="#0369a1" /> },
                  { id: 'APP', label: 'App Móvil', icon: <Smartphone size={16} color="#0369a1" /> },
                  { id: 'WEB', label: 'Portal Web', icon: <Globe size={16} color="#0284c7" /> },
                  { id: 'EMAIL', label: 'Correo', icon: <Mail size={16} color="#64748b" /> },
                ] as const
              ).map((ch) => (
                <label
                  key={ch.id}
                  className={`channel-pill-card ${intakeChannel === ch.id ? 'active' : ''}`}
                >
                  <input
                    type="radio"
                    name="intakeChannel"
                    value={ch.id}
                    checked={intakeChannel === ch.id}
                    onChange={() => setIntakeChannel(ch.id)}
                    required
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                  />
                  <div className="channel-pill-icon">{ch.icon}</div>
                  <span className="channel-pill-text">{ch.label}</span>
                </label>
              ))}
            </div>

            {/* Selector de Urgencia como Pastillas Suaves */}
            <div style={{ marginTop: 14 }}>
              <span className="field-micro-label">Tiempo de Atención Solicitado por el Cliente:</span>
              <div className="urgency-pills-row" style={{ marginTop: 6 }}>
                <label
                  className={`urgency-pill-select ${urgency === 'NOW' ? 'active-urgent' : ''}`}
                >
                  <input
                    type="radio"
                    name="urgency"
                    value="NOW"
                    checked={urgency === 'NOW'}
                    onChange={() => {
                      setUrgency('NOW');
                      setPriority('HIGH');
                    }}
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                  />
                  <Zap size={14} color={urgency === 'NOW' ? '#dc2626' : 'currentColor'} />
                  <span>Inmediato (Urgencia)</span>
                </label>

                <label
                  className={`urgency-pill-select ${urgency === 'TODAY' ? 'active-today' : ''}`}
                >
                  <input
                    type="radio"
                    name="urgency"
                    value="TODAY"
                    checked={urgency === 'TODAY'}
                    onChange={() => {
                      setUrgency('TODAY');
                      setPriority('NORMAL');
                    }}
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                  />
                  <Calendar size={14} />
                  <span>Para Hoy</span>
                </label>

                <label
                  className={`urgency-pill-select ${urgency === 'SCHEDULED' ? 'active-scheduled' : ''}`}
                >
                  <input
                    type="radio"
                    name="urgency"
                    value="SCHEDULED"
                    checked={urgency === 'SCHEDULED'}
                    onChange={() => {
                      setUrgency('SCHEDULED');
                      setPriority('NORMAL');
                    }}
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                  />
                  <Clock size={14} />
                  <span>Programado</span>
                </label>
              </div>
            </div>

            {/* Si es Programado: Campos Condicionales */}
            {urgency === 'SCHEDULED' && (
              <div className="grid-2-col" style={{ marginTop: 12 }}>
                <div className="field-rounded-wrap">
                  <label htmlFor="preferredDate" className="field-label-curved">Fecha Deseada *</label>
                  <input
                    id="preferredDate"
                    type="date"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    required={urgency === 'SCHEDULED'}
                    className="input-curved-field"
                  />
                </div>

                <div className="field-rounded-wrap">
                  <label htmlFor="preferredTime" className="field-label-curved">Rango Horario</label>
                  <input
                    id="preferredTime"
                    type="text"
                    placeholder="Ej. 10:00 AM - 12:00 PM"
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    className="input-curved-field"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SECCIÓN 2: CLIENTE & CONTACTO */}
          <div className="form-section-card">
            <div className="section-card-header">
              <div className="section-title-with-icon">
                <User size={15} color="var(--primary)" />
                <span className="section-title-text">2. Datos del Cliente & Contacto</span>
              </div>
              {recurringClient && (
                <span className="badge-client-registered">
                  <CheckCircle2 size={12} color="#16a34a" />
                  <span>Cliente Recurrente: {recurringClient.name} ({recurringClient.count} servicios)</span>
                </span>
              )}
            </div>

            <div className="grid-2-col">
              <div className="field-rounded-wrap">
                <label htmlFor="clientPhone" className="field-label-curved">
                  <span>Teléfono de Contacto *</span>
                  {searchingPhone && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Buscando...</span>}
                </label>
                <div className="input-icon-wrapper">
                  <Phone size={14} className="input-left-icon" />
                  <input
                    id="clientPhone"
                    type="tel"
                    placeholder="Ej. 924 167 911"
                    value={clientPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    required
                    className="input-curved-field with-icon mono-tabular"
                  />
                </div>
              </div>

              <div className="field-rounded-wrap">
                <label htmlFor="clientName" className="field-label-curved">
                  <span>Nombre Completo *</span>
                </label>
                <div className="input-icon-wrapper">
                  <User size={14} className="input-left-icon" />
                  <input
                    id="clientName"
                    type="text"
                    placeholder="Ej. Carlos Mendoza"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    required
                    className="input-curved-field with-icon"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: SERVICIO & UBICACIÓN */}
          <div className="form-section-card">
            <div className="section-card-header">
              <div className="section-title-with-icon">
                <MapPin size={15} color="var(--primary)" />
                <span className="section-title-text">3. Especialidad, Ubicación & Requerimiento</span>
              </div>
            </div>

            <div className="grid-2-col">
              <div className="field-rounded-wrap">
                <label htmlFor="specialty" className="field-label-curved">Especialidad Requerida *</label>
                <select
                  id="specialty"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="input-curved-field select-curved"
                >
                  {SPECIALTIES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-rounded-wrap">
                <label htmlFor="priority" className="field-label-curved">Nivel de Prioridad</label>
                <select
                  id="priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="input-curved-field select-curved"
                >
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">Alta (Urgencia Operativa)</option>
                </select>
              </div>
            </div>

            {/* Presets de Fallas Comunes */}
            {QUICK_PRESETS[specialty] && (
              <div style={{ marginTop: 10 }}>
                <span className="field-micro-label">Sugerencias Rápidas de Falla (click para añadir):</span>
                <div className="preset-chips-cluster" style={{ marginTop: 5 }}>
                  {QUICK_PRESETS[specialty].map((item, i) => (
                    <button
                      key={i}
                      type="button"
                      className="preset-chip-btn"
                      onClick={() => applyPreset(item.text)}
                    >
                      + {item.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Distrito y Dirección */}
            <div className="grid-2-col" style={{ marginTop: 12 }}>
              <div className="field-rounded-wrap">
                <label htmlFor="district" className="field-label-curved">Distrito (50 en Lima y Callao) *</label>
                <select
                  id="district"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="input-curved-field select-curved"
                >
                  {DISTRICT_GROUPS.map((grp) => (
                    <optgroup key={grp.zone} label={grp.zone}>
                      {grp.districts.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="field-rounded-wrap">
                <label htmlFor="address" className="field-label-curved">Dirección *</label>
                <div className="input-icon-wrapper">
                  <MapPin size={14} className="input-left-icon" />
                  <input
                    id="address"
                    type="text"
                    placeholder="Av. / Jr. / Calle y Número"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                    className="input-curved-field with-icon"
                  />
                </div>
              </div>
            </div>

            {/* Referencia */}
            <div className="field-rounded-wrap" style={{ marginTop: 12 }}>
              <label htmlFor="addressReference" className="field-label-curved">Referencia de Ubicación</label>
              <input
                id="addressReference"
                type="text"
                placeholder="Dpto 302, frente al parque / esquina de referencia"
                value={addressReference}
                onChange={(e) => setAddressReference(e.target.value)}
                className="input-curved-field"
              />
            </div>

            {/* Descripción */}
            <div className="field-rounded-wrap" style={{ marginTop: 12 }}>
              <label htmlFor="description" className="field-label-curved">
                <span>Descripción Detallada del Problema *</span>
              </label>
              <textarea
                id="description"
                rows={3}
                placeholder="Detalle reportado por el cliente para el diagnóstico inicial..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="input-curved-field textarea-curved"
              />
            </div>
          </div>

          {/* Pie de Acciones Curvo */}
          <div className="modal-sheet-footer">
            <button
              type="button"
              className="btn-sheet-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-sheet-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spinner" />
                  <span>Generando Correlativo...</span>
                </>
              ) : (
                <>
                  <PlusCircle size={16} />
                  <span>Registrar y Generar Correlativo</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
