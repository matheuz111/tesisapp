import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { usePathname, useRouter } from 'expo-router';
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebase';
import { useSession } from '../context/SessionContext';
import { useTheme } from '../context/ThemeContext';
import { createLocationPublisher } from '../services/locationPublisher';
import { MONITORED_STATUSES } from '../services/monitoring';

interface LocationSharingValue {
  eligible: boolean;
  enabled: boolean;
  busy: boolean;
  services: string[];
  status: string;
  enable: () => Promise<void>;
  pause: () => void;
}

const LocationSharingContext = createContext<LocationSharingValue | null>(null);
const dismissedThisRun = new Set<string>();

export function useLocationSharing() {
  const value = useContext(LocationSharingContext);
  if (!value) throw new Error('useLocationSharing requires ServiceLocationProvider');
  return value;
}

// A new identity gets a fresh instance: neither consent nor pending GPS callbacks
// from the previous account can enable location sharing for the next account.
export function ServiceLocationProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useSession();
  return <LocationSessionProvider key={user?.uid ?? 'signed-out'} uid={user?.uid ?? ''} role={profile?.uid === user?.uid ? profile?.role ?? '' : ''}>
    {children}
  </LocationSessionProvider>;
}

function LocationSessionProvider({ children, uid, role }: { children: React.ReactNode; uid: string; role: string }) {
  const { colors } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const eligible = !!uid && ['CLIENT', 'PROVIDER'].includes(role);
  const [services, setServices] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [status, setStatus] = useState('Ubicación pausada. Puedes activarla durante un servicio.');
  const [promptReady, setPromptReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const mounted = useRef(true);
  const permissionAttempt = useRef(0);
  const requestingPermission = useRef(false);
  const pendingWrite = useRef<Promise<void> | null>(null);
  const storageKey = `service-location-prompt-dismissed:v1:${uid}`;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    AsyncStorage.getItem(storageKey).then((saved) => {
      if (!cancelled) setDismissed(saved === '1' || dismissedThisRun.has(uid));
    }).catch(() => {
      if (!cancelled) setDismissed(dismissedThisRun.has(uid));
    }).finally(() => { if (!cancelled) setPromptReady(true); });
    return () => { cancelled = true; };
  }, [storageKey, uid]);

  const dismiss = useCallback(() => {
    dismissedThisRun.add(uid);
    setDismissed(true);
    // Storage failure must never prevent closing the dialog or navigating away.
    AsyncStorage.setItem(storageKey, '1').catch(() => {});
  }, [storageKey, uid]);

  useEffect(() => {
    if (!eligible) {
      permissionAttempt.current++; requestingPermission.current = false;
      setServices([]); setEnabled(false); setBusy(false); return;
    }
    let cancelled = false;
    const stop = onSnapshot(query(collection(db, 'service_requests'),
      where(role === 'CLIENT' ? 'clientId' : 'providerId', '==', uid),
      where('status', 'in', MONITORED_STATUSES)), (snapshot) => {
      if (cancelled || auth.currentUser?.uid !== uid) return;
      const next = snapshot.docs.map((item) => item.id).sort();
      setServices((previous) => previous.join(',') === next.join(',') ? previous : next);
      if (!next.length) {
        permissionAttempt.current++; requestingPermission.current = false;
        setEnabled(false); setBusy(false); setStatus('Ubicación pausada. Se activa durante un servicio.');
      }
    }, () => {
      if (!cancelled) {
        permissionAttempt.current++; requestingPermission.current = false;
        setServices([]); setEnabled(false); setBusy(false);
        setStatus('No se pudo consultar el servicio. Comprueba tu conexión.');
      }
    });
    return () => { cancelled = true; stop(); };
  }, [eligible, role, uid]);

  const pause = useCallback(() => {
    permissionAttempt.current++;
    requestingPermission.current = false;
    setBusy(false);
    setEnabled(false);
    setStatus('Ubicación pausada. Puedes volver a activarla aquí.');
  }, []);

  const enable = useCallback(async () => {
    if (!eligible || !services.length || requestingPermission.current || auth.currentUser?.uid !== uid) return;
    requestingPermission.current = true;
    const attempt = ++permissionAttempt.current;
    setBusy(true);
    try {
      // This is the only permission request, reached from an explicit button tap.
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!mounted.current || permissionAttempt.current !== attempt || auth.currentUser?.uid !== uid) return;
      if (!permission.granted) {
        setStatus('Permiso de ubicación desactivado. Puedes habilitarlo en los ajustes del teléfono.');
        return;
      }
      setEnabled(true);
      setStatus('Obteniendo ubicación…');
      dismiss();
    } catch {
      if (mounted.current && permissionAttempt.current === attempt) setStatus('No se pudo activar la ubicación. Intenta nuevamente.');
    } finally {
      if (mounted.current && permissionAttempt.current === attempt) { requestingPermission.current = false; setBusy(false); }
    }
  }, [dismiss, eligible, services.length, uid]);

  useEffect(() => {
    if (!eligible || !enabled || !services.length || appState !== 'active') return;
    let cancelled = false;
    let watcher: Location.LocationSubscription | undefined;
    let latest: Location.LocationObject | undefined;
    const publisher = createLocationPublisher(async () => {
      if (cancelled || auth.currentUser?.uid !== uid || !latest) return;
      // Preserve the same write limit when the watcher restarts (foreground,
      // service changes or repeated pause/resume) while Firestore is offline.
      if (pendingWrite.current) return pendingWrite.current;
      const position = latest;
      // One outstanding batch maximum; offline telemetry must not grow without bound.
      const write = Promise.allSettled(services.map((id) => setDoc(doc(db, 'service_requests', id, 'locations', uid), {
        latitude: position.coords.latitude, longitude: position.coords.longitude,
        accuracy: position.coords.accuracy, capturedAt: position.timestamp, updatedAt: serverTimestamp(),
      }))).then((results) => {
        if (results.some((result) => result.status === 'rejected')) throw new Error('Location write failed');
      });
      pendingWrite.current = write;
      try { await write; } finally { if (pendingWrite.current === write) pendingWrite.current = null; }
    }, (state) => {
      if (cancelled || auth.currentUser?.uid !== uid) return;
      setStatus(state === 'confirmed' ? 'Ubicación compartida con la central.' : state === 'waiting'
        ? 'Esperando conexión para confirmar la ubicación. Se reintenta al recuperar la conexión.'
        : 'No se pudo actualizar la ubicación. Comprueba tu conexión y permisos.');
    });
    const start = async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (cancelled || auth.currentUser?.uid !== uid) return;
      if (!permission.granted) { setEnabled(false); setStatus('Permiso de ubicación desactivado. Revisa los ajustes del teléfono.'); return; }
      setStatus('Obteniendo ubicación…');
      watcher = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 0 }, (position) => {
        if (cancelled || auth.currentUser?.uid !== uid || AppState.currentState !== 'active') return;
        latest = position;
        publisher.publish();
      }, () => { if (!cancelled) setStatus('GPS no disponible. Comprueba la ubicación del teléfono.'); });
      if (cancelled || auth.currentUser?.uid !== uid) watcher.remove();
    };
    start().catch(() => {
      if (!cancelled) { setEnabled(false); setStatus('No se pudo iniciar GPS. Intenta nuevamente.'); }
    });
    return () => { cancelled = true; watcher?.remove(); publisher.dispose(); };
  }, [eligible, enabled, services, appState, uid]);

  const value = useMemo(() => ({ eligible, enabled, busy, services, status: enabled && appState !== 'active'
    ? 'Compartir ubicación se pausa mientras la aplicación está en segundo plano.' : status, enable, pause }),
  [eligible, enabled, busy, services, status, appState, enable, pause]);
  // Initial guidance appears only on the dashboard. Profile, chat and authentication
  // routes always retain their full space and cannot be covered by this dialog.
  const showPrompt = eligible && services.length > 0 && promptReady && !dismissed && appState === 'active'
    && (pathname === '/client/home' || pathname === '/provider/home');

  return <LocationSharingContext.Provider value={value}>
    {children}
    <Modal visible={showPrompt} transparent animationType="fade" onRequestClose={dismiss}>
      <SafeAreaView style={styles.overlay}>
        <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: colors.card }]}>
          <TouchableOpacity accessibilityLabel="Cerrar aviso de ubicación" accessibilityRole="button" onPress={dismiss} style={styles.close}>
            <Text style={{ color: colors.text, fontSize: 26 }}>×</Text>
          </TouchableOpacity>
          <ScrollView contentContainerStyle={styles.dialogContent}>
            <Text style={[styles.title, { color: colors.text }]}>Comparte tu ubicación con la central</Text>
            <Text style={[styles.description, { color: colors.subtext }]}>La central supervisa el chat de tu servicio. Si lo deseas, también puedes compartir tu GPS mientras el servicio esté activo y tengas abierta la aplicación.</Text>
            <Text style={[styles.description, { color: colors.subtext }]}>Puedes cerrar este aviso y cambiar esta opción cuando quieras en Mi perfil → Ubicación durante el servicio.</Text>
            {busy && <Text style={{ color: colors.subtext }}>Esperando permiso del teléfono…</Text>}
            {!busy && status.includes('Permiso') && <Text style={{ color: colors.subtext }}>{status}</Text>}
            <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={enable} style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}>
              <Text style={styles.primaryLabel}>{busy ? 'Activando…' : 'Activar ubicación'}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={() => { dismiss(); router.push('/profile'); }} style={styles.textButton}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Configurar en mi perfil</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={dismiss} style={styles.textButton}>
              <Text style={{ color: colors.subtext }}>Ahora no</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  </LocationSharingContext.Provider>;
}

export function LocationSharingSettings() {
  const { colors } = useTheme();
  const { eligible, enabled, busy, services, status, enable, pause } = useLocationSharing();
  if (!eligible) return null;
  return <View style={[styles.settings, { backgroundColor: colors.card }]}>
    <Text style={[styles.title, { color: colors.text }]}>Ubicación durante el servicio</Text>
    <Text style={[styles.description, { color: colors.subtext }]}>La central puede ver tu ubicación si activas esta opción. Se comparte solo durante un servicio con la aplicación abierta y se pausa al cerrar sesión.</Text>
    <Text accessibilityLiveRegion="polite" style={{ color: colors.subtext }}>{status}</Text>
    {!services.length && <Text style={[styles.description, { color: colors.subtext }]}>Estará disponible cuando tengas un servicio activo.</Text>}
    <TouchableOpacity accessibilityRole="button" disabled={!enabled && (!services.length || busy)} onPress={enabled ? pause : enable}
      style={[styles.textButton, { opacity: !enabled && (!services.length || busy) ? 0.5 : 1 }]}>
      <Text style={{ color: colors.primary, fontWeight: '800' }}>{enabled ? 'Pausar ubicación' : busy ? 'Activando…' : 'Compartir ubicación con la central'}</Text>
    </TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" onPress={() => Linking.openSettings().catch(() => {})} style={styles.textButton}>
      <Text style={{ color: colors.primary }}>Abrir permisos del teléfono</Text>
    </TouchableOpacity>
  </View>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 },
  dialog: { borderRadius: 24, maxHeight: '90%', width: '100%', maxWidth: 480, alignSelf: 'center', overflow: 'hidden' },
  close: { minWidth: 48, minHeight: 48, alignSelf: 'flex-end', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  dialogContent: { paddingHorizontal: 24, paddingBottom: 16 },
  title: { fontSize: 19, fontWeight: '800' },
  description: { fontSize: 14, lineHeight: 21, marginVertical: 10 },
  primaryButton: { minHeight: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 12, padding: 12 },
  primaryLabel: { color: '#FFFFFF', fontWeight: '800' },
  textButton: { minHeight: 48, paddingVertical: 12, justifyContent: 'center' },
  settings: { borderRadius: 16, padding: 16, marginVertical: 12 },
});
