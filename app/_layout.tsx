import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeProvider } from '../src/context/ThemeContext';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../src/config/firebase';
import { registerForPushNotificationsAsync, watchServicePushTokens } from '../utils/pushNotifications';
import { flushDemoPushOutbox } from '../src/services/demoPushService';
import { ServiceLocationProvider } from '../src/components/ServiceLocationSharing';
import { SessionProvider, useSession } from '../src/context/SessionContext';
import { withTimeout } from '../src/services/async';
import {
  Notifications,
  isExpoGo,
  type EventSubscription,
  type NotificationResponse,
} from '../src/services/notificationsWrapper';

export default function Layout() {
  return <SessionProvider><ThemeProvider><AppShell /></ThemeProvider></SessionProvider>;
}

function AppShell() {
  const router = useRouter();
  const segments = useSegments();
  const { user, profile, authLoading } = useSession();
  const uid = user?.uid;
  const role = profile?.role;
  const insets = useSafeAreaInsets();
  const notificationListener = useRef<EventSubscription | null>(null);
  const responseListener = useRef<EventSubscription | null>(null);
  const handledNotificationId = useRef<string | null>(null);

  // Remove protected screens from the visible flow promptly when the local session ends.
  useEffect(() => {
    if (!authLoading && !uid && !['auth', 'onboarding'].includes(segments[0] || '')) router.replace('/auth/login');
  }, [authLoading, uid, segments, router]);

  useEffect(() => {
    if (isExpoGo || !uid) return;
    const register = (requestPermission = false) => {
      if (auth.currentUser?.uid !== uid) return;
      void registerForPushNotificationsAsync(uid, { requestPermission });
      void flushDemoPushOutbox(uid).catch(() => {});
    };
    register(true);
    const foreground = AppState.addEventListener('change', (state) => { if (state === 'active') register(); });
    const tokenListener = Notifications.addPushTokenListener((devicePushToken) => {
      // Android emits this event when fetching a token too. Reuse its value to avoid a loop.
      if (auth.currentUser?.uid === uid) void registerForPushNotificationsAsync(uid, { devicePushToken, requestPermission: false });
    });
    const retry = setInterval(() => { if (AppState.currentState === 'active') void flushDemoPushOutbox(uid).catch(() => {}); }, 30000);
    return () => { foreground.remove(); tokenListener.remove(); clearInterval(retry); };
  }, [isExpoGo, uid]);

  useEffect(() => {
    if (!isExpoGo && uid && role) return watchServicePushTokens(uid, role);
  }, [isExpoGo, uid, role]);

  useEffect(() => {
    if (isExpoGo || !uid || !role) return;
    let disposed = false;

    try {
      // Listener: notificación recibida mientras la app está ABIERTA (foreground)
      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        const data = notification.request.content.data as any;
        if (data?.recipientId && data.recipientId !== uid) void Notifications.dismissNotificationAsync(notification.request.identifier).catch(() => {});
      });

      const handleNotificationResponse = async (response: NotificationResponse) => {
        const notificationId = response.notification.request.identifier;
        if (disposed || auth.currentUser?.uid !== uid || handledNotificationId.current === notificationId) return;

        const data = response.notification.request.content.data as any;
        if (!data?.screen || (data.recipientId && data.recipientId !== uid)) return;

        try {
          if (data.screen === 'chat' && typeof data.requestId === 'string' && !data.requestId.includes('/')) {
            const service = await withTimeout(getDoc(doc(db, 'service_requests', data.requestId)), 6000);
            if (disposed || auth.currentUser?.uid !== uid) return;
            if (service.data()?.clientId === uid || service.data()?.providerId === uid) {
              handledNotificationId.current = notificationId;
              router.push({ pathname: '/chat/[id]', params: { id: data.requestId } }); return;
            }
          }
          if (disposed || auth.currentUser?.uid !== uid) return;
          handledNotificationId.current = notificationId;
          if (role === 'PROVIDER') {
            router.replace('/provider/home');
          } else if (role === 'CLIENT') {
            router.replace('/client/home');
          } else if (role === 'ADMIN' || role === 'OPERATOR') {
            router.replace('/operator/home' as any);
          }
        } catch { Toast.show({ type: 'error', text1: 'No se pudo abrir el aviso', text2: 'Revisa tu conexión y consulta tus servicios.' }); }
      };

      // Listener: usuario toca la notificación con la app en background.
      responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

      // Cold start: el listener todavía no existía cuando Android/iOS abrió la app.
      Notifications.getLastNotificationResponseAsync()
        .then((response: NotificationResponse | null) => {
          if (response) {
            handleNotificationResponse(response);
            return Notifications.clearLastNotificationResponseAsync();
          }
        })
        .catch((error: unknown) => console.warn('No se pudo leer la notificación inicial:', error));
    } catch (e) {
      console.warn('Error al inicializar notificaciones en Expo Go:', e);
    }

    return () => {
      disposed = true;
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [isExpoGo, router, uid, role]);

  return (
    <ServiceLocationProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#f4511e' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ title: 'Iniciar Sesión', headerShown: false }} />
        <Stack.Screen name="auth/register" options={{ title: 'Crear Cuenta' }} />
        <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />

        <Stack.Screen name="client/home" options={{ headerShown: false }} />
        <Stack.Screen name="client/history" options={{ headerShown: false }} />
        <Stack.Screen name="provider/home" options={{ headerShown: false }} />
        <Stack.Screen name="provider/history" options={{ headerShown: false }} />

        <Stack.Screen name="operator/home" options={{ headerShown: false }} />
        <Stack.Screen name="operator/monitor/[id]" options={{ headerShown: false }} />

        <Stack.Screen name="profile/index" options={{ title: 'Mi Perfil' }} />
        <Stack.Screen name="profile/help" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
      </Stack>
      <Toast topOffset={insets.top + 12} bottomOffset={insets.bottom + 12} />
    </ServiceLocationProvider>
  );
}
