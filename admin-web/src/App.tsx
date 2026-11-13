import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { Loader2 } from 'lucide-react';
import { VerifyCertificatePage } from './components/VerifyCertificatePage';
import './index.css';

const MainApp = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <Loader2 size={36} className="spinner" color="#0284c7" />
        <p>Cargando panel de operaciones...</p>
      </div>
    );
  }

  return user ? <Dashboard /> : <Login />;
};

export const App = () => {
  // Página pública del QR: no pasa por el inicio de sesión de la central.
  const verify = window.location.pathname.match(/^\/verificar\/?([^/]*)/);
  if (verify) {
    return (
      <ThemeProvider>
        <VerifyCertificatePage rawCode={decodeURIComponent(verify[1] || '')} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
