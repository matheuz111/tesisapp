import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { type User, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface AuthContextType {
  user: User | null;
  role: string | null;
  userName: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  userName: null,
  loading: true,
  error: null,
  login: async () => {},
  logout: async () => {},
  clearError: () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.role === 'OPERATOR' || data.role === 'ADMIN') {
              setUser(currentUser);
              setRole(data.role);
              setUserName(data.name || data.full_name || currentUser.email?.split('@')[0] || 'Operador');
              setError(null);
            } else {
              await signOut(auth);
              setUser(null);
              setRole(null);
              setUserName(null);
              setError('Acceso denegado. Este panel es exclusivo para operadores y administradores de la central.');
            }
          } else {
            await signOut(auth);
            setUser(null);
            setRole(null);
            setError('Perfil de usuario no registrado en el sistema.');
          }
        } catch (err: any) {
          setError(err.message || 'Error al validar credenciales del operador.');
          setUser(null);
          setRole(null);
        }
      } else {
        setUser(null);
        setRole(null);
        setUserName(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
      const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
      if (!userDoc.exists() || !['OPERATOR', 'ADMIN'].includes(userDoc.data()?.role)) {
        await signOut(auth);
        throw new Error('Acceso no autorizado: se requiere rol de Operador o Administrador.');
      }
    } catch (err: any) {
      setError(err.message || 'Credenciales inválidas.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setError(null);
    await signOut(auth);
    setUser(null);
    setRole(null);
    setUserName(null);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{ user, role, userName, loading, error, login, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
