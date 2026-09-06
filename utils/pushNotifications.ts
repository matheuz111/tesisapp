import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import {
  Notifications,
  isExpoGo,
  type DevicePushToken,
} from '../src/services/notificationsWrapper';
import { arrayRemove, arrayUnion, collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, type DocumentReference } from 'firebase/firestore';
import { Platform } from 'react-native';
import { auth, db } from '../src/config/firebase';
import { withTimeout } from '../src/services/async';
import { MONITORED_STATUSES } from '../src/services/monitoring';

type RegistrationOptions = { devicePushToken?: DevicePushToken; requestPermission?: boolean; force?: boolean };
type Registration = { uid: string; token: string; nativeToken?: string; confirmedAt: number };
type PushSession = { uid: string; role: string; refs: DocumentReference[]; stop: () => void };
let registration: Registration | undefined;
let generation = 0;
let signOutTask: Promise<void> | undefined;
let inFlight: { uid: string; promise: Promise<string | undefined>; nextToken?: DevicePushToken } | undefined;
let pushSession: PushSession | undefined;
const TOKEN_CACHE_MS = 10 * 60 * 1000;

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const recipientId = notification.request.content.data?.recipientId;
    const show = !!auth.currentUser && (!recipientId || recipientId === auth.currentUser.uid) && !signOutTask;
    return { shouldPlaySound: show, shouldSetBadge: show, shouldShowBanner: show, shouldShowList: show };
  },
});

/** One registration at a time; token events use their supplied native token, never fetch it recursively. */
export function registerForPushNotificationsAsync(userId: string, options: RegistrationOptions = {}): Promise<string | undefined> {
  if (!Device.isDevice || signOutTask || auth.currentUser?.uid !== userId || isExpoGo) return Promise.resolve(undefined);
  if (inFlight?.uid === userId) {
    if (options.devicePushToken) inFlight.nextToken = options.devicePushToken;
    return inFlight.promise;
  }
  const nativeToken = options.devicePushToken ? JSON.stringify(options.devicePushToken) : undefined;
  if (!options.force && registration?.uid === userId && registration.confirmedAt
    && (!nativeToken || nativeToken === registration.nativeToken)
    && Date.now() - registration.confirmedAt < TOKEN_CACHE_MS) return Promise.resolve(registration.token);

  const attempt = generation;
  const current = () => !signOutTask && attempt === generation && auth.currentUser?.uid === userId;
  const run = async () => {
    try {
      if (Platform.OS === 'android') {
        await withTimeout(Notifications.setNotificationChannelAsync('default', {
          name: 'Solicitudes y servicios', description: 'Asignaciones, mensajes y estados del servicio',
          importance: Notifications.AndroidImportance.MAX, vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C', sound: 'default', enableVibrate: true, showBadge: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        }), 5000);
      }
      let permission = await withTimeout(Notifications.getPermissionsAsync(), 5000);
      if (!permission.granted && options.requestPermission !== false && permission.canAskAgain && current()) {
        permission = await Notifications.requestPermissionsAsync();
      }
      if (!permission.granted || !current()) return;
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) throw new Error('Falta el identificador de proyecto EAS.');
      const devicePushToken = options.devicePushToken || await withTimeout(Notifications.getDevicePushTokenAsync(), 8000);
      if (!current()) return;
      const result = await withTimeout(Notifications.getExpoPushTokenAsync({ projectId, devicePushToken }), 8000);
      if (!current()) return;
      // Remember before the remote write so logout can remove a queued registration too.
      registration = { uid: userId, token: result.data, nativeToken: JSON.stringify(devicePushToken), confirmedAt: 0 };
      await withTimeout(AsyncStorage.setItem(`push-device:${userId}`, result.data), 1000);
      if (typeof AsyncStorage.removeItem === 'function') {
        await AsyncStorage.removeItem(`push-last-error:${userId}`).catch(() => {});
      }
      if (!current()) return;
      await withTimeout(setDoc(doc(db, 'push_tokens', userId), {
        tokens: options.force ? [result.data] : arrayUnion(result.data), updatedAt: serverTimestamp(),
      }, { merge: true }), 5000, 'La base de datos no confirmó el registro del teléfono.');
      if (!current()) return;
      registration.confirmedAt = Date.now();
      return result.data;
    } catch (error) {
      if (current()) console.warn('No se pudo confirmar el registro de notificaciones:', error instanceof Error ? error.message : 'Error de conexión');
      return undefined;
    }
  };
  const promise = run().finally(() => {
    if (inFlight?.promise !== promise) return;
    const nextToken = inFlight.nextToken;
    inFlight = undefined;
    if (current() && nextToken && registration?.confirmedAt && JSON.stringify(nextToken) !== registration.nativeToken) {
      void registerForPushNotificationsAsync(userId, { devicePushToken: nextToken, requestPermission: false });
    }
  });
  inFlight = { uid: userId, promise };
  return promise;
}

/** Mirrors tokens only into active services, using the already loaded session role. */
export function watchServicePushTokens(userId: string, role: string): () => void {
  pushSession?.stop();
  const session: PushSession = { uid: userId, role, refs: [], stop: () => {} };
  pushSession = session;
  if (!['CLIENT', 'PROVIDER'].includes(role)) return () => { if (pushSession === session) pushSession = undefined; };
  const side = role === 'CLIENT' ? 'client' : 'provider';
  let stopped = false;
  let loaded = false;
  let tokens: string[] = [];
  let services: { ref: DocumentReference; tokens: string[] }[] = [];
  const writing = new Set<string>();
  const sync = () => {
    if (stopped || signOutTask || auth.currentUser?.uid !== userId || !loaded) return;
    for (const service of services) {
      if (writing.has(service.ref.path) || JSON.stringify([...service.tokens].sort()) === JSON.stringify([...tokens].sort())) continue;
      writing.add(service.ref.path);
      void updateDoc(service.ref, { [`notificationTokens.${side}`]: tokens }).catch(() => {}).finally(() => writing.delete(service.ref.path));
    }
  };
  const stopTokens = onSnapshot(doc(db, 'push_tokens', userId), (snapshot) => {
    tokens = (snapshot.data()?.tokens || []).filter((token: unknown): token is string => typeof token === 'string');
    loaded = true; sync();
  }, () => {});
  const stopRequests = onSnapshot(query(collection(db, 'service_requests'),
    where(`${side}Id`, '==', userId), where('status', 'in', [...MONITORED_STATUSES, 'COMPLETED'])), (snapshot) => {
    services = snapshot.docs.map((item) => ({ ref: item.ref, tokens: item.data().notificationTokens?.[side] || [] }));
    session.refs = services.map((service) => service.ref);
    sync();
  }, () => {});
  session.stop = () => { stopped = true; stopTokens(); stopRequests(); if (pushSession === session) pushSession = undefined; };
  return session.stop;
}

/** Logout is a local auth operation. Remote cleanup is best effort with a single 1.5 s budget. */
export function signOutWithNotifications(): Promise<void> {
  if (signOutTask) return signOutTask;
  const uid = auth.currentUser?.uid;
  const previousRegistration = registration?.uid === uid ? registration : undefined;
  const previousSession = pushSession?.uid === uid ? pushSession : undefined;
  generation++;
  registration = undefined;
  inFlight = undefined;
  previousSession?.stop();
  const cleanup = async () => {
    if (!uid) return;
    const token = previousRegistration?.token || await withTimeout(AsyncStorage.getItem(`push-device:${uid}`), 300);
    if (auth.currentUser?.uid !== uid) return;
    const tasks: Promise<unknown>[] = [];
    if (previousSession?.role === 'PROVIDER') tasks.push(updateDoc(doc(db, 'users', uid), { is_active: false }));
    if (token) {
      tasks.push(setDoc(doc(db, 'push_tokens', uid), { tokens: arrayRemove(token), updatedAt: serverTimestamp() }, { merge: true }));
      const side = previousSession?.role === 'CLIENT' ? 'client' : 'provider';
      for (const ref of previousSession?.refs || []) tasks.push(updateDoc(ref, { [`notificationTokens.${side}`]: arrayRemove(token) }));
    }
    const outcomes = await Promise.allSettled(tasks);
    if (outcomes.some((outcome) => outcome.status === 'rejected')) console.warn('La limpieza remota de notificaciones no se confirmó; la sesión local se cerrará.');
  };
  signOutTask = (async () => {
    try { await withTimeout(cleanup(), 1500); }
    catch { console.warn('La limpieza remota tardó demasiado; se continúa con el cierre de sesión local.'); }
    finally {
      // Do not let a Firestore outage, permission error or pending write lock the user in.
      await auth.signOut();
      void Notifications.dismissAllNotificationsAsync().catch(() => {});
      void Notifications.clearLastNotificationResponseAsync().catch(() => {});
    }
  })().finally(() => { signOutTask = undefined; });
  return signOutTask;
}
