import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import Toast from 'react-native-toast-message';
import { ThemeProvider } from '../src/context/ThemeContext';

export default function Layout() {
  const router = useRouter();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Listener: notificación recibida mientras la app está ABIERTA (foreground)
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data as any;
      console.log('Notificación recibida en foreground:', data);
    });

    // Listener: usuario TAP sobre la notificación (app cerrada o background)
    // Este es el handler que abre la pantalla correcta al tocar la notificación
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any;
      console.log('Notificación tocada, data:', data);

      if (!data?.screen) return;

      // Pequeño delay para asegurar que el router esté listo
      setTimeout(() => {
        if (data.screen === 'provider_home') {
          router.replace('/provider/home');
        } else if (data.screen === 'client_home') {
          router.replace('/client/home');
        }
      }, 300);
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

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
        <Stack.Screen name="client/map" options={{ headerShown: false }} />

        <Stack.Screen name="provider/home" options={{ headerShown: false }} />
        <Stack.Screen name="provider/history" options={{ headerShown: false }} />

        <Stack.Screen name="profile/index" options={{ title: 'Mi Perfil' }} />
        <Stack.Screen name="profile/help" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
      </Stack>
      <Toast />
    </ThemeProvider>
  );
}