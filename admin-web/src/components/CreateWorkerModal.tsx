import { useState } from 'react';
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { X, UserPlus, ShieldCheck } from 'lucide-react';
import { firebaseConfig } from '../firebase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

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

export const CreateWorkerModal = ({ isOpen, onClose, onCreated }: Props) => {
  const [fullName, setFullName] = useState('');
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [specialty, setSpecialty] = useState('Gasfitero');
  const [tempPassword, setTempPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const isValidEmail = (val: string) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val);
  const isSecurePassword = (val: string) =>
    val.length >= 8 && /[A-Z]/.test(val) && /[a-z]/.test(val) && /[0-9]/.test(val) && /[!@#$%^&*(),.?":{}|<>_\-+=[\]\\/`~;]/.test(val);

  const reset = () => {
    setFullName(''); setDni(''); setEmail(''); setPhone('');
    setSpecialty('Gasfitero'); setTempPassword(''); setError(''); setSuccess('');
  };

  const handleCreate = async () => {
    setError(''); setSuccess('');
    const cleanName = fullName.trim();
    const cleanDni = dni.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim().replace(/\D/g, '');

    if (cleanName.split(/\s+/).length < 2 || cleanName.length < 5) {
      setError('Ingresa el nombre y apellido completos del trabajador.'); return;
    }
    if (!/^\d{8}$/.test(cleanDni)) {
      setError('El DNI debe tener exactamente 8 dígitos.'); return;
    }
    if (!isValidEmail(cleanEmail)) {
      setError('Ingresa un correo válido: será el usuario de acceso del trabajador.'); return;
    }
    if (!/^9\d{8}$/.test(cleanPhone)) {
      setError('El celular debe tener 9 dígitos y comenzar con 9.'); return;
    }
    if (!isSecurePassword(tempPassword)) {
      setError('La contraseña temporal debe tener 8+ caracteres, mayúscula, minúscula, número y un símbolo.'); return;
    }

    setSaving(true);
    let secondaryApp: FirebaseApp | null = null;
    try {
      const existing = getApps().find((a) => a.name === 'worker-creator');
      secondaryApp = existing ?? initializeApp(firebaseConfig, 'worker-creator');
      const secondaryAuth = getAuth(secondaryApp);
      const secondaryDb = getFirestore(secondaryApp);

      const cred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, tempPassword);
      const uid = cred.user.uid;

      await setDoc(doc(secondaryDb, 'users', uid), {
        uid,
        full_name: cleanName,
        name: cleanName,
        email: cleanEmail,
        dni: cleanDni,
        phone: cleanPhone,
        role: 'PROVIDER',
        specialty,
        price_range: '',
        rating: 0,
        total_rating: 0,
        review_count: 0,
        jobs_completed: 0,
        is_active: true,
        approval_status: 'APPROVED',
        is_verified: true,
        service_radius_km: 10,
        description: '',
        created_at: serverTimestamp(),
        created_by: 'CENTRAL_PANEL',
      });

      await sendEmailVerification(cred.user);
      await signOut(secondaryAuth);

      setSuccess(`Cuenta creada para ${cleanName}. Se envió el correo de verificación a ${cleanEmail}; el trabajador debe abrirlo para activar su acceso y luego ingresar a la app con la contraseña temporal (podrá cambiarla desde «Olvidé mi contraseña»).`);
      onCreated?.();
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Ese correo ya tiene una cuenta registrada.');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña temporal no cumple la política de Firebase.');
      } else {
        setError(err.message || 'No se pudo crear la cuenta del trabajador.');
      }
    } finally {
      if (secondaryApp) {
        try { await deleteApp(secondaryApp); } catch { /* noop */ }
      }
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <UserPlus size={20} />
            <h3 style={{ margin: 0 }}>Nuevo Trabajador</h3>
          </div>
          <button type="button" className="btn btn-outline" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body modal-scrollable">
          <p style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--text-muted)', fontSize: 13, marginTop: 0 }}>
            <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            Las cuentas de profesionales las crea la central tras validar la contratación. El trabajador recibirá un correo de verificación para activar su acceso.
          </p>

          <div className="form-group"><label>Nombre y apellido completos</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ej. Juan Pérez Quispe" /></div>

          <div className="form-group"><label>DNI (8 dígitos)</label>
          <input value={dni} maxLength={8} inputMode="numeric"
            onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="12345678" /></div>

          <div className="form-group"><label>Correo electrónico (usuario de acceso)</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="trabajador@correo.com" /></div>

          <div className="form-group"><label>Celular (9 dígitos)</label>
          <input value={phone} maxLength={9} inputMode="numeric"
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="987654321" /></div>

          <div className="form-group"><label>Especialidad</label>
          <select value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
            {SPECIALTIES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select></div>

          <div className="form-group"><label>Contraseña temporal</label>
          <input type="text" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)}
            placeholder="8+ caracteres, mayúscula, minúscula, número y símbolo" /></div>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '6px 0 0' }}>
            Entrégala al trabajador por un canal seguro. Podrá cambiarla desde la app con «Olvidé mi contraseña».
          </p>

          {error && <div className="alert alert-danger" style={{ marginTop: 12 }}>{error}</div>}
          {success && <div className="alert alert-success" style={{ marginTop: 12 }}>{success}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={() => { reset(); onClose(); }} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creando cuenta…' : 'Crear cuenta de trabajador'}
          </button>
        </div>
      </div>
    </div>
  );
};
