import { useState } from 'react';
import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { X, PlusCircle, Loader2 } from 'lucide-react';
import type { IntakeChannel, Priority } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (code: string) => void;
}

const DISTRICTS = [
  'Miraflores', 'San Isidro', 'Santiago de Surco', 'San Borja', 'Jesús María',
  'Magdalena del Mar', 'Pueblo Libre', 'Lince', 'Barranco', 'La Molina',
  'San Miguel', 'Surquillo', 'Cercado de Lima', 'Ate', 'Chorrillos', 'Los Olivos'
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
  const [district, setDistrict] = useState(DISTRICTS[0]);
  const [address, setAddress] = useState('');
  const [addressReference, setAddressReference] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const QUICK_PRESETS: Record<string, Array<{ text: string; fee: number }>> = {
    Gasfitero: [
      { text: 'Fuga de agua en llave de paso o tubería', fee: 60 },
      { text: 'Destape de inodoro / desagüe atorado', fee: 70 },
      { text: 'Instalación o cambio de grifería/llaves', fee: 50 },
    ],
    Electricista: [
      { text: 'Cortocircuito / Salto constante de llave térmica', fee: 80 },
      { text: 'Instalación de luminaria / tomacorrientes nuevos', fee: 50 },
      { text: 'Mantenimiento y revisión de tablero eléctrico', fee: 90 },
    ],
    Cerrajero: [
      { text: 'Apertura de puerta trabada / llave perdida', fee: 60 },
      { text: 'Cambio e instalación de cerradura de seguridad', fee: 80 },
    ],
    Tecnico: [
      { text: 'Revisión técnica de lavadora (no centrifuga / bota agua)', fee: 60 },
      { text: 'Revisión y carga de gas para refrigeradora', fee: 80 },
    ],
  };

  const applyPreset = (presetText: string) => {
    setDescription((prev) => (prev ? `${prev} - ${presetText}` : presetText));
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !address.trim() || !description.trim()) {
      setError('Completa el nombre, dirección y descripción del problema.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let generatedCode = '';
      await runTransaction(db, async (transaction) => {
        // 1. Obtener correlativo atómico
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

        transaction.set(newRequestRef, {
          code: generatedCode,
          intakeChannel,
          origin: 'OPERATOR',
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
          address: address.trim(),
          addressReference: addressReference.trim(),
          description: description.trim(),
          technicalVisitFee: 50.00,
          price_agreed: 'Visita técnica: S/. 50.00 (Deducible)',
          securityPin,
          operatorId: user?.uid,
          operatorName: userName || 'Central',
          createdAt: serverTimestamp(),
          firstResponseAt: serverTimestamp(), // Como la central lo transcribe, el primer contacto es inmediato
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
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <PlusCircle size={22} color="#0284c7" />
            <h2>Nuevo Pedido Manual (Central)</h2>
          </div>
          <button type="button" className="btn-close" onClick={onClose} disabled={loading}>
            <X size={20} />
          </button>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Canal de Recepción (Multicanalidad)</label>
            <div className="radio-pill-group">
              {(['WHATSAPP', 'PHONE', 'EMAIL'] as IntakeChannel[]).map((channel) => (
                <label key={channel} className={`radio-pill ${intakeChannel === channel ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="intakeChannel"
                    value={channel}
                    checked={intakeChannel === channel}
                    onChange={() => setIntakeChannel(channel)}
                  />
                  {channel === 'WHATSAPP' ? '💬 WhatsApp' : channel === 'PHONE' ? '📞 Llamada' : '✉️ Correo'}
                </label>
              ))}
            </div>
          </div>

          {/* Selector de Urgencia Operativa */}
          <div className="form-group">
            <label>Tiempo de Atención Solicitado por el Cliente</label>
            <div className="radio-pill-group">
              <label className={`radio-pill ${urgency === 'NOW' ? 'active' : ''}`} style={urgency === 'NOW' ? { borderColor: '#ef4444', color: '#ef4444', background: 'rgba(239,68,68,0.1)' } : {}}>
                <input
                  type="radio"
                  name="urgency"
                  value="NOW"
                  checked={urgency === 'NOW'}
                  onChange={() => {
                    setUrgency('NOW');
                    setPriority('HIGH');
                  }}
                />
                ⚡ Inmediato (Urgencia)
              </label>
              <label className={`radio-pill ${urgency === 'TODAY' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="urgency"
                  value="TODAY"
                  checked={urgency === 'TODAY'}
                  onChange={() => {
                    setUrgency('TODAY');
                    setPriority('NORMAL');
                  }}
                />
                📅 Para Hoy
              </label>
              <label className={`radio-pill ${urgency === 'SCHEDULED' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="urgency"
                  value="SCHEDULED"
                  checked={urgency === 'SCHEDULED'}
                  onChange={() => {
                    setUrgency('SCHEDULED');
                    setPriority('NORMAL');
                  }}
                />
                🕒 Programado
              </label>
            </div>
          </div>

          {urgency === 'SCHEDULED' && (
            <div className="form-row">
              <div className="form-group flex-1">
                <label htmlFor="preferredDate">Fecha Deseada</label>
                <input
                  id="preferredDate"
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  required={urgency === 'SCHEDULED'}
                />
              </div>
              <div className="form-group flex-1">
                <label htmlFor="preferredTime">Rango Horario</label>
                <input
                  id="preferredTime"
                  type="text"
                  placeholder="Ej. 10:00 AM - 12:00 PM"
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="clientName">Nombre del Cliente *</label>
              <input
                id="clientName"
                type="text"
                placeholder="Ej. Carlos Mendoza"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
              />
            </div>
            <div className="form-group flex-1">
              <label htmlFor="clientPhone">Teléfono / WhatsApp</label>
              <input
                id="clientPhone"
                type="tel"
                placeholder="999 888 777"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="specialty">Especialidad Requerida *</label>
              <select
                id="specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
              >
                {SPECIALTIES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group flex-1">
              <label htmlFor="priority">Nivel de Prioridad</label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                <option value="NORMAL">Normal</option>
                <option value="HIGH">🚨 Alta (Urgencia)</option>
              </select>
            </div>
          </div>

          {/* Presets / Baremo de fallas comunes para agilizar transcripción */}
          {QUICK_PRESETS[specialty] && (
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Sugerencias Rápidas de Falla (Click para añadir):</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {QUICK_PRESETS[specialty].map((item, i) => (
                  <button
                    key={i}
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: 14 }}
                    onClick={() => applyPreset(item.text)}
                  >
                    + {item.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="district">Distrito *</label>
              <select
                id="district"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              >
                {DISTRICTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="form-group flex-1">
              <label htmlFor="address">Dirección *</label>
              <input
                id="address"
                type="text"
                placeholder="Av. Larco 450"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="addressReference">Referencia (Piso, dpto, urbanización)</label>
            <input
              id="addressReference"
              type="text"
              placeholder="Dpto 302, frente al parque"
              value={addressReference}
              onChange={(e) => setAddressReference(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Descripción del Requerimiento / Falla *</label>
            <textarea
              id="description"
              rows={3}
              placeholder="Detalle del problema reportado por el cliente..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={16} className="spinner" />
                  <span>Registrando...</span>
                </>
              ) : (
                'Registrar y Generar Correlativo'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
