import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { evaluateLocationCompliance, type LocationIssue } from '../services/locationCompliance';
import { remindLocationOff, resetLocationReminder } from '../services/locationReminder';

const CHECK_INTERVAL_MS = 60 * 1000;

/**
 * Vigila que el técnico disponible tenga la ubicación encendida y con permiso durante su jornada.
 * Revisa al abrir la app, al volver a ella y cada minuto. Si falla algo: devuelve el problema (la pantalla
 * muestra un aviso con el botón para corregirlo) y, si la app no está a la vista, lanza una notificación local.
 */
export function useLocationCompliance(options: { available: boolean }) {
  const { available } = options;
  const [issue, setIssue] = useState<LocationIssue | null>(null);
  const previousIssue = useRef<LocationIssue | null>(null);

  const check = useCallback(async () => {
    if (!available) return;
    try {
      const [servicesEnabled, permission] = await Promise.all([
        Location.hasServicesEnabledAsync(),
        Location.getForegroundPermissionsAsync(),
      ]);
      const found = evaluateLocationCompliance({
        available: true,
        servicesEnabled,
        permissionGranted: permission.granted,
        now: new Date(),
      });
      setIssue(found);
      if (found && AppState.currentState !== 'active') void remindLocationOff(found);
      // Al corregirse, el siguiente apagado vuelve a avisar sin esperar los 15 minutos.
      if (!found && previousIssue.current) void resetLocationReminder();
      previousIssue.current = found;
    } catch {
      // Sin poder consultar el estado no se avisa: mejor ningún aviso que uno falso.
    }
  }, [available]);

  useEffect(() => {
    if (!available) return;
    void check();
    const timer = setInterval(() => { void check(); }, CHECK_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void check(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [available, check]);

  /** Intenta encender la ubicación (Android) o lleva a los ajustes del teléfono; luego vuelve a comprobar. */
  const fix = useCallback(async () => {
    try {
      if (issue === 'PERMISSION_DENIED') {
        const requested = await Location.requestForegroundPermissionsAsync();
        if (!requested.granted && !requested.canAskAgain) await Linking.openSettings();
      } else if (Platform.OS === 'android') {
        await Location.enableNetworkProviderAsync();
      } else {
        await Linking.openSettings();
      }
    } catch {
      await Linking.openSettings().catch(() => {});
    }
    void check();
  }, [issue, check]);

  return { issue: available ? issue : null, fix, recheck: check };
}
