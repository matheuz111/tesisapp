import { isRunningInExpoGo } from 'expo';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type * as NotificationsTypes from 'expo-notifications';

export const isExpoGo =
  isRunningInExpoGo() || Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let nativeNotifications: typeof NotificationsTypes | null = null;

if (!isExpoGo) {
  try {
    // Se requiere condicionalmente solo fuera de Expo Go para evitar el crash fatal
    // de expo-notifications en Android SDK 53+ ("Android Push notifications removed from Expo Go").
    nativeNotifications = require('expo-notifications');
  } catch (err) {
    console.warn('No se pudo inicializar expo-notifications nativo:', err);
  }
}

const dummyNotifications = {
  setNotificationHandler: () => {},
  addPushTokenListener: () => ({ remove: () => {} }),
  addNotificationReceivedListener: () => ({ remove: () => {} }),
  addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
  dismissNotificationAsync: async () => {},
  dismissAllNotificationsAsync: async () => {},
  getLastNotificationResponseAsync: async () => null,
  clearLastNotificationResponseAsync: async () => {},
  setNotificationChannelAsync: async () => null,
  getExpoPushTokenAsync: async () => ({ data: '', type: 'expo' }),
  getDevicePushTokenAsync: async () => ({ data: '', type: 'unknown' as any }),
  getPermissionsAsync: async () => ({
    status: 'undetermined' as any,
    granted: false,
    canAskAgain: false,
    expires: 'never' as any,
  }),
  requestPermissionsAsync: async () => ({
    status: 'undetermined' as any,
    granted: false,
    canAskAgain: false,
    expires: 'never' as any,
  }),
  AndroidImportance: {
    DEFAULT: 3,
    HIGH: 4,
    LOW: 2,
    MAX: 5,
    MIN: 1,
    NONE: 0,
    UNSPECIFIED: -1000,
  },
  AndroidNotificationVisibility: {
    PRIVATE: 0,
    PUBLIC: 1,
    SECRET: -1,
  },
} as unknown as typeof NotificationsTypes;

export const Notifications = (nativeNotifications || dummyNotifications) as typeof NotificationsTypes;

export type EventSubscription = NotificationsTypes.EventSubscription;
export type NotificationResponse = NotificationsTypes.NotificationResponse;
export type DevicePushToken = NotificationsTypes.DevicePushToken;
