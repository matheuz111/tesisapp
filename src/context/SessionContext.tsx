import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot, type DocumentData } from 'firebase/firestore';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { auth, db } from '../config/firebase';

export interface SessionProfile extends DocumentData {
  uid: string;
  role?: string;
}

export interface SessionState {
  user: User | null;
  profile: SessionProfile | null;
  authLoading: boolean;
  loading: boolean;
  error: string | null;
  fromCache: boolean;
}

const initialState: SessionState = {
  user: null, profile: null, authLoading: true, loading: true, error: null, fromCache: false,
};
const PROFILE_WAIT_MS = 8000;

/** A single profile listener per session; late results from a previous account are discarded. */
export function subscribeToSession(onChange: (state: SessionState) => void) {
  let state = initialState;
  let generation = 0;
  let disposed = false;
  let stopProfile = () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const publish = (patch: Partial<SessionState>) => {
    if (disposed) return;
    state = { ...state, ...patch };
    onChange(state);
  };
  const clearWait = () => { if (timer) clearTimeout(timer); timer = undefined; };
  const watchProfile = (user: User, preserveProfile: boolean) => {
    const attempt = ++generation;
    stopProfile(); clearWait();
    publish({
      user, authLoading: false, loading: !preserveProfile, error: null,
      ...(preserveProfile ? {} : { profile: null, fromCache: false }),
    });
    const isCurrent = () => !disposed && attempt === generation && auth.currentUser?.uid === user.uid;
    timer = setTimeout(() => {
      if (isCurrent()) publish({ loading: false, error: 'La conexión está tardando. Puedes reintentar o cerrar sesión.' });
    }, PROFILE_WAIT_MS);
    stopProfile = onSnapshot(doc(db, 'users', user.uid), { includeMetadataChanges: true }, (snapshot) => {
      if (!isCurrent()) return;
      if (snapshot.exists()) {
        clearWait();
        publish({ profile: { ...snapshot.data(), uid: user.uid }, loading: false, error: null, fromCache: snapshot.metadata.fromCache });
      } else if (!snapshot.metadata.fromCache) {
        clearWait();
        publish({ profile: null, loading: false, error: 'No encontramos el perfil de esta cuenta. Reintenta o comunícate con la central.', fromCache: false });
      }
      // An empty local cache is not proof that the profile is missing on the server.
    }, (error) => {
      if (!isCurrent()) return;
      clearWait();
      publish({ loading: false, error: error.code === 'permission-denied'
        ? 'No se pudo acceder al perfil. Cierra sesión y vuelve a ingresar.'
        : 'No se pudo actualizar el perfil. Revisa la conexión o reintenta.' });
    });
  };
  timer = setTimeout(() => publish({ authLoading: false, loading: false, error: 'No se pudo recuperar la sesión. Reintenta o vuelve a ingresar.' }), PROFILE_WAIT_MS);
  const stopAuth = onAuthStateChanged(auth, (user) => {
    if (disposed) return;
    if (user) { watchProfile(user, state.user?.uid === user.uid && !!state.profile); return; }
    generation++; stopProfile(); clearWait();
    publish({ user: null, profile: null, authLoading: false, loading: false, error: null, fromCache: false });
  }, () => {
    generation++; stopProfile(); clearWait();
    publish({ user: null, profile: null, authLoading: false, loading: false, error: 'No se pudo recuperar la sesión.', fromCache: false });
  });
  return {
    retry: () => {
      const user = auth.currentUser;
      if (user) watchProfile(user, state.user?.uid === user.uid && !!state.profile);
      else publish({ user: null, profile: null, authLoading: false, loading: false, error: null, fromCache: false });
    },
    stop: () => { disposed = true; generation++; clearWait(); stopAuth(); stopProfile(); },
  };
}

const SessionContext = createContext<(SessionState & { retry: () => void }) | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>(initialState);
  const subscription = useRef<ReturnType<typeof subscribeToSession> | null>(null);
  useEffect(() => {
    const current = subscribeToSession(setState);
    subscription.current = current;
    return () => { current.stop(); subscription.current = null; };
  }, []);
  const retry = useCallback(() => subscription.current?.retry(), []);
  return <SessionContext.Provider value={{ ...state, retry }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession requires SessionProvider');
  return value;
}

export function getRoleHome(role?: string) {
  if (role === 'CLIENT') return '/client/home' as const;
  if (role === 'PROVIDER') return '/provider/home' as const;
  if (role === 'ADMIN' || role === 'OPERATOR') return '/operator/home' as const;
  return null;
}
