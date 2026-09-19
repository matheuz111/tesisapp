import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

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
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon-badge">
            <ShieldCheck size={36} color="#0284c7" />
          </div>
          <h1 className="login-title">MAESTRO A DOMICILIO</h1>
          <p className="login-subtitle">Panel Central de Operaciones y Monitoreo</p>
        </div>

        {(error || localError) && (
          <div className="alert alert-danger">
            <AlertCircle size={18} />
            <span>{error || localError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Correo Institucional</label>
            <input
              id="email"
              type="email"
              placeholder="operador@maestroadomicilio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
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
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={18} className="spinner" />
                <span>Ingresando al sistema...</span>
              </>
            ) : (
              'Iniciar Sesión como Operador'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>
            Plataforma interna para gestión de servicios, monitoreo técnico y exportación de matriz científica SPSS.
          </p>
        </div>
      </div>
    </div>
  );
};
