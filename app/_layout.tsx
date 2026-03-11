import { Stack } from 'expo-router';
import Toast from 'react-native-toast-message';
import { ThemeProvider } from '../src/context/ThemeContext';

export default function Layout() {
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

        <Stack.Screen name="profile/index" options={{ title: 'Mi Perfil' }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
      </Stack>
      <Toast />
    </ThemeProvider>
  );
}