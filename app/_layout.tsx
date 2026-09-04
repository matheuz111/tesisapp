import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import Toast from 'react-native-toast-message';
import { ThemeProvider } from '../src/context/ThemeContext';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../src/config/firebase';
import { registerForPushNotificationsAsync } from '../utils/pushNotifications';

export default function Layout() {
  const router = useRouter();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const handledNotificationId = useRef<string | null>(null);

  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

  useEffect(() => {
    if (isExpoGo) return;

    return onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) return;
      registerForPushNotificationsAsync(currentUser.uid).catch((error) => {
        console.warn('No se pudo registrar el dispositivo para notificaciones:', error);
      });
    });
  }, [isExpoGo]);

  useEffect(() => {
    if (isExpoGo) {
      console.log('Notificaciones push remotas deshabilitadas en Expo Go (SDK 54).');
      return;
    }

    try {
      // Listener: notificación recibida mientras la app está ABIERTA (foreground)
      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        const data = notification.request.content.data as any;
        console.log('Notificación recibida en foreground:', data);
      });

      const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
        const notificationId = response.notification.request.identifier;
        if (handledNotificationId.current === notificationId) return;
        handledNotificationId.current = notificationId;

        const data = response.notification.request.content.data as any;
        console.log('Notificación tocada, data:', data);

        if (!data?.screen) return;

        setTimeout(() => {
          if (data.screen === 'provider_home') {
            router.replace('/provider/home');
          } else if (data.screen === 'client_home') {
            router.replace('/client/home');
          } else if (data.screen === 'operator_home') {
            router.replace('/operator/home' as any);
          } else if (data.screen === 'chat' && typeof data.requestId === 'string') {
            router.push({ pathname: '/chat/[id]', params: { id: data.requestId } });
          }
        }, 300);
      };

      // Listener: usuario toca la notificación con la app en background.
      responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

      // Cold start: el listener todavía no existía cuando Android/iOS abrió la app.
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (response) {
            handleNotificationResponse(response);
            return Notifications.clearLastNotificationResponseAsync();
          }
        })
        .catch((error) => console.warn('No se pudo leer la notificación inicial:', error));
    } catch (e) {
      console.warn('Error al inicializar notificaciones en Expo Go:', e);
    }

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [isExpoGo, router]);

  return (
    <ThemeProvider>
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

        <Stack.Screen name="profile/index" options={{ title: 'Mi Perfil' }} />
        <Stack.Screen name="profile/help" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
      </Stack>
      <Toast />
    </ThemeProvider>
  );
}
