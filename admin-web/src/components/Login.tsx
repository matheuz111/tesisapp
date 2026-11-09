import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Loader2 } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

export const Login = () => {
  const { login, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setLocalError('Por favor ingresa correo y contraseña.');
      return;
    }
    setLocalError(null);
    clearError();
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setLocalError(err.message || 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Panel izquierdo — identidad del producto */}
      <aside className="login-brand-panel" aria-hidden="true">
        <div className="login-brand-inner">
          <BrandLogo height={38} />
          <h1 className="login-brand-title">Central de Operaciones</h1>
          <p className="login-brand-desc">
            Gestión de solicitudes, asignación de técnicos y trazabilidad
            completa de cada servicio a domicilio.
          </p>
          <div className="login-brand-stats">
            <div className="login-stat">
              <span className="login-stat-value">24/7</span>
              <span className="login-stat-label">Monitoreo activo</span>
            </div>
            <div className="login-stat-divider" />
            <div className="login-stat">
              <span className="login-stat-value">30d</span>
              <span className="login-stat-label">Garantía por servicio</span>
            </div>
            <div className="login-stat-divider" />
            <div className="login-stat">
              <span className="login-stat-value">GPS</span>
              <span className="login-stat-label">Despacho en ruta</span>
            </div>
          </div>
          <p className="login-brand-contact">
            WhatsApp Central: <strong>924-167-911</strong>
          </p>
        </div>
      </aside>

      {/* Panel derecho — formulario en hoja blanca */}
      <main className="login-form-panel">
        <div className="login-sheet">
          <div className="login-sheet-header">
            <h2 className="login-sheet-title">Iniciar sesión</h2>
            <p className="login-sheet-sub">Acceso exclusivo para operadores autorizados</p>
          </div>

          {(error || localError) && (
            <div className="alert alert-danger" role="alert">
              <AlertCircle size={16} />
              <span>{error || localError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Correo institucional</label>
              <input
                id="email"
                type="email"
                placeholder="operador@maestroadomicilio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spinner" />
                  <span>Ingresando…</span>
                </>
              ) : (
                'Ingresar como operador'
              )}
            </button>
          </form>

          <p className="login-sheet-footer">
            Plataforma interna · gestión de servicios y exportación SPSS
          </p>
        </div>
      </main>
    </div>
  );
};
