import { Notifications, isExpoGo } from '../services/notificationsWrapper';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../config/firebase';
import { registerForPushNotificationsAsync } from '../../utils/pushNotifications';
import { useTheme } from '../context/ThemeContext';
import { flushDemoPushOutbox, getPushDiagnostics } from '../services/demoPushService';
import { useSession } from '../context/SessionContext';
import { withTimeout } from '../services/async';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function NotificationSettings() {
  const { colors } = useTheme();
  const { user } = useSession();
  const uid = user?.uid;
  const mounted = useRef(true);
  const registering = useRef(false);
  const [message, setMessage] = useState('Comprobando permisos de notificación…');
  const [busy, setBusy] = useState(false);
  const [diagnostic, setDiagnostic] = useState('');
  const refresh = useCallback(async () => {
    if (!uid || auth.currentUser?.uid !== uid) return;
    const result = await getPushDiagnostics(uid);
    if (!mounted.current || auth.currentUser?.uid !== uid) return;
    setDiagnostic(result.lastError ? `Hay un problema al enviar avisos: ${result.lastError}. Informa a la central.` : result.pending ? `${result.pending} avisos pendientes de envío. Se reintentan con la app abierta.` : 'Sin avisos pendientes de envío.');
  }, [uid]);
  useEffect(() => {
    mounted.current = true;
    if (isExpoGo) {
      setMessage('Estás usando Expo Go. Las notificaciones push remotas en Android requieren el APK nativo de la tesis.');
      return;
    }
    const check = () => withTimeout(Notifications.getPermissionsAsync(), 5000).then((permission) => { if (mounted.current) setMessage(permission.granted ? 'Permiso de notificaciones activo en este teléfono.' : 'Las notificaciones están desactivadas. Permítelas para recibir asignaciones y mensajes.'); }).catch(() => { if (mounted.current) setMessage('No se pudo consultar el permiso.'); });
    check();
    refresh().catch(() => {});
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') check(); });
    return () => { mounted.current = false; subscription.remove(); };
  }, [uid, refresh]);
  const register = async () => {
    if (isExpoGo) {
      setMessage('Expo Go no admite notificaciones push remotas en Android (SDK 53+). Instala el APK para pruebas completas.');
      return;
    }
    if (!uid || auth.currentUser?.uid !== uid || registering.current) return;
    registering.current = true;
    setBusy(true);
    try {
      await AsyncStorage.removeItem(`push-last-error:${uid}`).catch(() => {});
      if (mounted.current) setDiagnostic('');
      const token = await withTimeout(registerForPushNotificationsAsync(uid, { force: true, requestPermission: true }), 15000);
      if (!mounted.current || auth.currentUser?.uid !== uid) return;
      void flushDemoPushOutbox(uid).catch(() => {});
      await refresh();
      setMessage(token ? 'Teléfono registrado para recibir avisos. La recepción también depende de la conexión y de los ajustes de batería.' : 'No se pudo registrar. Revisa permisos, conexión e intenta de nuevo desde el APK instalado.');
    } catch {
      if (mounted.current && auth.currentUser?.uid === uid) setMessage('No se pudo confirmar el registro. Revisa tu conexión y vuelve a intentarlo.');
    } finally { registering.current = false; if (mounted.current) setBusy(false); }
  };
  return <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginVertical: 16 }}>
    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 17 }}>Notificaciones de servicios</Text>
    <Text style={{ color: colors.subtext, marginVertical: 10 }}>{message}</Text>
    <Text style={{ color: colors.subtext }}>{diagnostic}</Text>
    <TouchableOpacity disabled={busy} onPress={register} style={{ paddingVertical: 10 }}><Text style={{ color: colors.primary, fontWeight: '800' }}>{busy ? 'Registrando…' : 'Activar o actualizar este teléfono'}</Text></TouchableOpacity>
    <TouchableOpacity onPress={() => Linking.openSettings()} style={{ paddingVertical: 10 }}><Text style={{ color: colors.primary }}>Abrir ajustes del teléfono</Text></TouchableOpacity>
  </View>;
}
