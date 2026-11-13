import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOCATION_REMINDER_COPY, shouldRemind, type LocationIssue } from './locationCompliance';
import { Notifications } from './notificationsWrapper';

const LAST_REMINDER_KEY = 'maestro:last_location_reminder_at';

/**
 * Notificación local inmediata para pedir que se encienda la ubicación. Funciona sin servidor:
 * la dispara la propia app (en primer plano) o la tarea de ubicación en segundo plano cuando falla.
 * Respeta un intervalo de 15 minutos entre recordatorios. Devuelve true si se mostró.
 */
export async function remindLocationOff(issue: LocationIssue, now: number = Date.now()): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(LAST_REMINDER_KEY);
    const last = stored ? Number(stored) : null;
    if (!shouldRemind(Number.isFinite(last as number) ? last : null, now)) return false;

    const schedule = (Notifications as { scheduleNotificationAsync?: typeof Notifications.scheduleNotificationAsync }).scheduleNotificationAsync;
    if (typeof schedule !== 'function') return false; // Expo Go: sin notificaciones locales
    await AsyncStorage.setItem(LAST_REMINDER_KEY, String(now));
    const copy = LOCATION_REMINDER_COPY[issue];
    await schedule.call(Notifications, {
      content: { title: copy.title, body: copy.body, data: { screen: 'provider_home', action: 'ENABLE_GPS' } },
      trigger: null,
    });
    return true;
  } catch (error) {
    console.warn('[locationReminder] No se pudo mostrar el recordatorio:', error);
    return false;
  }
}

/** Permite volver a avisar de inmediato (por ejemplo, cuando el técnico ya corrigió el problema). */
export async function resetLocationReminder(): Promise<void> {
  await AsyncStorage.removeItem(LAST_REMINDER_KEY).catch(() => {});
}
