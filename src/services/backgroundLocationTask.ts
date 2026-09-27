import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../config/firebase';
import { updateProviderPresence } from './providerPresenceService';
import type { OperationalZone } from '../types/canonical';

export const BACKGROUND_LOCATION_TASK_NAME = 'MAESTRO_BACKGROUND_LOCATION_TASK';
export const BACKGROUND_TRACKING_CONTEXT_KEY = 'maestro:provider_tracking_context';

export interface ProviderTrackingContext {
  providerId: string;
  providerName: string;
  providerPhone?: string;
  specialties?: string[];
  zones?: OperationalZone[];
  activeRequestId?: string | null;
}

let activeProviderContext: ProviderTrackingContext | null = null;

/**
 * Persiste el contexto mínimo necesario en almacenamiento local seguro para que
 * TaskManager pueda recuperarlo cuando Android reinicie el proceso en segundo plano.
 */
export async function setBackgroundTrackingContext(context: ProviderTrackingContext | null): Promise<void> {
  activeProviderContext = context;
  try {
    if (context) {
      const minimalContext: ProviderTrackingContext = {
        providerId: context.providerId,
        providerName: context.providerName,
        providerPhone: context.providerPhone || '',
        specialties: context.specialties || [],
        zones: context.zones || [],
        activeRequestId: context.activeRequestId || null,
      };
      await AsyncStorage.setItem(BACKGROUND_TRACKING_CONTEXT_KEY, JSON.stringify(minimalContext));
    } else {
      await AsyncStorage.removeItem(BACKGROUND_TRACKING_CONTEXT_KEY);
    }
  } catch (err) {
    console.warn('[BackgroundLocationTask] Error al sincronizar almacenamiento local:', err);
  }
}

/**
 * Elimina el contexto persistido al cerrar sesión o desactivar disponibilidad,
 * garantizando que nunca se mantenga el contexto de una cuenta anterior.
 */
export async function clearBackgroundTrackingContext(): Promise<void> {
  activeProviderContext = null;
  try {
    await AsyncStorage.removeItem(BACKGROUND_TRACKING_CONTEXT_KEY);
  } catch (err) {
    console.warn('[BackgroundLocationTask] Error al eliminar contexto persistido:', err);
  }
}

// Definición en el ámbito superior según directiva arquitectónica
if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK_NAME)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.warn('[BackgroundLocationTask] Error en tarea de fondo:', error.message);
      return;
    }

    if (data) {
      const { locations } = data as { locations?: Location.LocationObject[] };
      if (!locations || locations.length === 0) return;

      const latestLocation = locations[locations.length - 1];
      if (!latestLocation || !latestLocation.coords) return;

      // Descartar muestras desfasadas mayores a 2 minutos
      const ageMs = Date.now() - latestLocation.timestamp;
      if (ageMs > 120000) return;

      // Si el proceso de Android se reinició en segundo plano, recuperar el contexto persistido
      let context = activeProviderContext;
      if (!context) {
        try {
          const raw = await AsyncStorage.getItem(BACKGROUND_TRACKING_CONTEXT_KEY);
          if (raw) {
            context = JSON.parse(raw) as ProviderTrackingContext;
            activeProviderContext = context;
          }
        } catch (storageErr) {
          console.warn('[BackgroundLocationTask] Error al recuperar contexto desde AsyncStorage:', storageErr);
        }
      }

      if (!context) return;

      // Seguridad: Verificar que el contexto no pertenezca a una cuenta anterior
      const currentUid = auth.currentUser?.uid;
      if (currentUid && currentUid !== context.providerId) {
        console.warn('[BackgroundLocationTask] Contexto de cuenta previa detectado. Purgando contexto obsoleto.');
        await clearBackgroundTrackingContext();
        return;
      }

      try {
        await updateProviderPresence(db, {
          providerId: context.providerId,
          providerName: context.providerName,
          providerPhone: context.providerPhone || '',
          status: context.activeRequestId ? 'BUSY' : 'AVAILABLE',
          latitude: latestLocation.coords.latitude,
          longitude: latestLocation.coords.longitude,
          accuracy: latestLocation.coords.accuracy,
          specialties: context.specialties,
          zones: context.zones,
          activeRequestId: context.activeRequestId,
        });
      } catch (err) {
        console.warn('[BackgroundLocationTask] Error al actualizar presencia en segundo plano:', err);
      }
    }
  });
}

/**
 * Determina si se está ejecutando bajo Expo Go donde las tareas de fondo están restringidas.
 */
export function isExpoGoClient(): boolean {
  return Constants.appOwnership === 'expo';
}

/**
 * Inicia el seguimiento en segundo plano si los permisos y el entorno lo soportan.
 */
export async function startBackgroundLocationUpdates(
  context: ProviderTrackingContext
): Promise<{ success: boolean; isExpoGo: boolean; message: string }> {
  await setBackgroundTrackingContext(context);

  if (Platform.OS === 'web') {
    return { success: false, isExpoGo: false, message: 'No aplicable en web' };
  }

  // Degradación controlada y limpia en Expo Go sin provocar errores
  if (isExpoGoClient()) {
    console.info(
      '[BackgroundLocation] Expo Go detectado. El seguimiento en segundo plano requiere Development Build o APK nativo. Degradando limpiamente a primer plano.'
    );
    return {
      success: false,
      isExpoGo: true,
      message: 'Expo Go solo permite validar seguimiento en primer plano. Para segundo plano usa Development Build o APK.',
    };
  }

  try {
    const isAvailable = await Location.isBackgroundLocationAvailableAsync();
    if (!isAvailable) {
      return { success: false, isExpoGo: false, message: 'Ubicación en segundo plano no disponible en este hardware' };
    }

    const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
      return { success: false, isExpoGo: false, message: 'Permiso de ubicación en segundo plano no otorgado' };
    }

    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);
    if (!alreadyStarted) {
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 15000,
        distanceInterval: 25,
        deferredUpdatesInterval: 15000,
        foregroundService: {
          notificationTitle: 'Maestro a Domicilio — Servicio Activo',
          notificationBody: 'Tu ubicación se comparte con la central mientras estás disponible.',
          notificationColor: '#0284c7',
        },
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
      });
    }

    return { success: true, isExpoGo: false, message: 'Seguimiento en segundo plano activo' };
  } catch (err: any) {
    console.warn('[BackgroundLocation] Error al iniciar seguimiento en segundo plano:', err);
    return { success: false, isExpoGo: false, message: err?.message || 'Error al iniciar seguimiento' };
  }
}

/**
 * Detiene el seguimiento en segundo plano y limpia el contexto en memoria y almacenamiento.
 */
export async function stopBackgroundLocationUpdates(): Promise<void> {
  await clearBackgroundTrackingContext();
  if (Platform.OS === 'web') return;

  try {
    const isStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);
    if (isStarted) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);
    }
  } catch (err) {
    console.warn('[BackgroundLocation] Error al detener seguimiento en segundo plano:', err);
  }
}
