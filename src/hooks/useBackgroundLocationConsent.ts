import { useState, useEffect, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CONSENT_STORAGE_KEY = 'MAESTRO_BG_LOCATION_CONSENT_V1';

export interface BackgroundLocationConsentState {
  hasConsent: boolean;
  foregroundGranted: boolean;
  backgroundGranted: boolean;
  isSupported: boolean;
  requestConsentAndPermissions: () => Promise<boolean>;
  revokeConsent: () => Promise<void>;
}

/**
 * Hook to manage background location tracking with explicit user consent.
 * Compliant with Google Play & Apple App Store background location disclosure rules.
 */
export function useBackgroundLocationConsent(): BackgroundLocationConsentState {
  const [hasConsent, setHasConsent] = useState(false);
  const [foregroundGranted, setForegroundGranted] = useState(false);
  const [backgroundGranted, setBackgroundGranted] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkStatus() {
      try {
        const storedConsent = await AsyncStorage.getItem(CONSENT_STORAGE_KEY);
        const consentGiven = storedConsent === 'true';

        const supported = await Location.isBackgroundLocationAvailableAsync();
        const fgStatus = await Location.getForegroundPermissionsAsync();
        const bgStatus = await Location.getBackgroundPermissionsAsync();

        if (mounted) {
          setHasConsent(consentGiven);
          setIsSupported(supported);
          setForegroundGranted(fgStatus.granted);
          setBackgroundGranted(bgStatus.granted);
        }
      } catch (err) {
        console.warn('[useBackgroundLocationConsent] Error checking permissions:', err);
      }
    }

    checkStatus();
    return () => {
      mounted = false;
    };
  }, []);

  const requestConsentAndPermissions = useCallback(async (): Promise<boolean> => {
    return new Promise((resolve) => {
      // 1. Prominent in-app disclosure dialog as required by mobile operating systems
      Alert.alert(
        'Seguimiento Operativo en Segundo Plano',
        'Maestro a Domicilio recopila datos de ubicación cuando la app está cerrada o en segundo plano para permitir la asignación automática de solicitudes cercanas y mostrar tu disponibilidad a la central de despacho.',
        [
          {
            text: 'Rechazar',
            style: 'cancel',
            onPress: async () => {
              await AsyncStorage.setItem(CONSENT_STORAGE_KEY, 'false');
              setHasConsent(false);
              resolve(false);
            },
          },
          {
            text: 'Aceptar y Permitir',
            onPress: async () => {
              try {
                await AsyncStorage.setItem(CONSENT_STORAGE_KEY, 'true');
                setHasConsent(true);

                // 2. Request Foreground Permission first
                const fg = await Location.requestForegroundPermissionsAsync();
                setForegroundGranted(fg.granted);
                if (!fg.granted) {
                  resolve(false);
                  return;
                }

                // 3. Request Background Permission if supported on native device
                if (Platform.OS !== 'web') {
                  const bg = await Location.requestBackgroundPermissionsAsync();
                  setBackgroundGranted(bg.granted);
                  resolve(bg.granted);
                } else {
                  resolve(true);
                }
              } catch (err) {
                console.warn('[useBackgroundLocationConsent] Permission request failed:', err);
                resolve(false);
              }
            },
          },
        ]
      );
    });
  }, []);

  const revokeConsent = useCallback(async () => {
    await AsyncStorage.setItem(CONSENT_STORAGE_KEY, 'false');
    setHasConsent(false);
  }, []);

  return {
    hasConsent,
    foregroundGranted,
    backgroundGranted,
    isSupported,
    requestConsentAndPermissions,
    revokeConsent,
  };
}
