import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { doc, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../src/config/firebase';

// Configuración de cómo se comporta la notificación cuando la app está abierta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// FUNCIÓN 1: Pedir permiso y obtener el Token único del celular
export async function registerForPushNotificationsAsync(userId: string) {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Permiso denegado para notificaciones push');
      return;
    }

    // Obtener projectId del app.json/app.config.js
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;

    token = (await Notifications.getExpoPushTokenAsync({
      projectId: projectId || '95912a92-2f39-4e4d-a7c7-abab0dd8bc80',
    })).data;
    console.log("Tu Push Token es:", token);

    // Guardar token en Firebase con merge para no sobrescribir otros campos
    if (token && userId) {
      try {
        await setDoc(doc(db, 'users', userId), {
          expoPushToken: token
        }, { merge: true });
      } catch (error) {
        console.error("Error guardando el Push Token en Firebase:", error);
      }
    }

  } else {
    console.log('Debes usar un dispositivo físico para las Notificaciones Push');
  }

  return token;
}

// FUNCIÓN 2: Disparar notificación push a otro usuario
// NOTA: Esta función sigue disponible para usarla desde el servidor o donde se necesite,
// pero la entrega principal al proveedor ahora la hace la Cloud Function `onNewServiceRequest`.
export async function sendPushNotification(expoPushToken: string, title: string, body: string, data = {}) {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title: title,
    body: body,
    data: data,
    priority: 'high',
    channelId: 'default',
    ttl: 3600,
    android: {
      priority: 'high',
      sound: 'default',
      channelId: 'default',
    },
    apns: {
      payload: {
        aps: {
          'content-available': 1,
          sound: 'default',
        },
      },
      headers: {
        'apns-priority': '10',
      },
    },
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    const result = await response.json();
    console.log('Push result:', JSON.stringify(result));
    return result;
  } catch (error) {
    console.error('Error enviando push notification:', error);
  }
}
