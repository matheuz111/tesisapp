import { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Users,
  ShieldCheck,
  MapPin,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import {
  GOOGLE_SHEETS_URL,
  GOOGLE_SPREADSHEET_ID,
  syncUserToGoogleSheet,
} from '../services/googleSheetsSync';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleSheetsModal = ({ isOpen, onClose }: Props) => {
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSyncAll = async () => {
    setSyncing(true);
    setSyncSuccess(null);
    setSyncError(null);

    try {
      const snap = await getDocs(collection(db, 'users'));
      const docs = snap.docs.filter((d) => !d.data().email?.startsWith('sync_'));
      let syncedCount = 0;

      for (const d of docs) {
        const data = d.data();
        let roleVal = 'CLIENTE';
        if (data.role === 'PROVIDER' || data.role === 'TECNICO') roleVal = 'TECNICO';
        else if (data.role === 'ADMIN') roleVal = 'ADMIN';
        else if (data.role === 'OPERATOR') roleVal = 'OPERADOR';

        await syncUserToGoogleSheet({
          uid: d.id,
          name: data.full_name || data.name || 'Usuario',
          dni: data.dni || '',
          email: data.email || '',
          phone: data.phone || data.phone_number || '',
          district: data.district || 'Lima',
          zone: data.zone || 'LIMA_CENTRO',
          role: roleVal,
          is_verified: Boolean(data.is_verified || data.approval_status === 'APPROVED'),
        });
        syncedCount++;
      }

      setSyncSuccess(`¡Se sincronizaron ${syncedCount} usuarios con Google Sheets exitosamente!`);
    } catch (err: any) {
      setSyncError(err.message || 'Error al conectar con la base de datos de usuarios.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="modal-backdrop-smooth" role="dialog" aria-modal="true">
      <div className="modal-sheet-curved" style={{ maxWidth: 640 }}>
        {/* Cabecera */}
        <div className="modal-sheet-header">
          <div className="header-badge-title">
            <div
              className="icon-badge-round"
              style={{ background: 'rgba(22, 163, 74, 0.12)', color: '#16a34a' }}
            >
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                Directorio en Google Sheets
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                Registro oficial en vivo de clientes, técnicos y operadores
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Card de Estado Conectado */}
          <div
            style={{
              background: 'var(--card-bg, #ffffff)',
              border: '1px solid var(--border, #e2e8f0)',
              borderRadius: 12,
              padding: 16,
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: '#16a34a',
                    boxShadow: '0 0 0 3px rgba(22, 163, 74, 0.2)',
                  }}
                />
                <span style={{ fontWeight: 700, fontSize: 14 }}>Hoja Oficial Conectada</span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  background: 'rgba(3, 105, 161, 0.1)',
                  color: '#0369a1',
                  padding: '3px 8px',
                  borderRadius: 12,
                  fontWeight: 600,
                }}
              >
                ID: {GOOGLE_SPREADSHEET_ID.slice(0, 10)}...
              </span>
            </div>

            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-secondary, #475569)' }}>
              <strong>Maestro a Domicilio - Registro de Clientes y Usuarios</strong>
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
              Todos los datos de la aplicación móvil y de la central están vinculados a esta tabla de Google Sheets.
            </p>
          </div>

          {/* Grid de Características / Validaciones Combobox */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
            }}
          >
            <div
              style={{
                background: 'rgba(3, 105, 161, 0.04)',
                border: '1px solid rgba(3, 105, 161, 0.15)',
                borderRadius: 10,
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0369a1' }}>
                <MapPin size={16} />
                <span style={{ fontWeight: 700, fontSize: 12 }}>Distritos (Combobox)</span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                50 distritos oficiales con menú desplegable editable con un botón sin errores de tipeo.
              </p>
            </div>

            <div
              style={{
                background: 'rgba(22, 163, 74, 0.04)',
                border: '1px solid rgba(22, 163, 74, 0.15)',
                borderRadius: 10,
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a' }}>
                <Users size={16} />
                <span style={{ fontWeight: 700, fontSize: 12 }}>Roles (Combobox)</span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                Seleccionable entre CLIENTE, TECNICO, ADMIN y OPERADOR.
              </p>
            </div>

            <div
              style={{
                background: 'rgba(234, 88, 12, 0.04)',
                border: '1px solid rgba(234, 88, 12, 0.15)',
                borderRadius: 10,
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ea580c' }}>
                <ChevronDown size={16} />
                <span style={{ fontWeight: 700, fontSize: 12 }}>Zona Operativa</span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                LIMA_CENTRO, LIMA_NORTE, LIMA_SUR, LIMA_ESTE y CALLAO.
              </p>
            </div>

            <div
              style={{
                background: 'rgba(147, 51, 234, 0.04)',
                border: '1px solid rgba(147, 51, 234, 0.15)',
                borderRadius: 10,
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9333ea' }}>
                <ShieldCheck size={16} />
                <span style={{ fontWeight: 700, fontSize: 12 }}>Estado Verificación</span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                VERIFICADO, PENDIENTE o RECHAZADO con control de calidad.
              </p>
            </div>
          </div>

          {/* Mensajes de Feedback */}
          {syncSuccess && (
            <div
              style={{
                background: 'rgba(22, 163, 74, 0.1)',
                border: '1px solid rgba(22, 163, 74, 0.3)',
                color: '#16a34a',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <CheckCircle2 size={16} />
              <span>{syncSuccess}</span>
            </div>
          )}

          {syncError && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertCircle size={16} />
              <span>{syncError}</span>
            </div>
          )}
        </div>

        {/* Footer con Acciones */}
        <div
          className="modal-sheet-footer"
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleSyncAll}
            disabled={syncing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Sincronizando...' : 'Sincronizar Todo Ahora'}</span>
          </button>

          <a
            href={GOOGLE_SHEETS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: '#16a34a',
              borderColor: '#16a34a',
              color: '#ffffff',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            <FileSpreadsheet size={16} />
            <span>Abrir en Google Sheets</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
};
