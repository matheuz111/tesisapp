import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { doc, updateDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../src/config/firebase'; // Ajusta esta ruta a tu archivo de configuración de Firebase

// Configuración de cómo se comporta la notificación cuando la app está abierta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true, // EXIGIDO POR LA NUEVA VERSIÓN DE EXPO
    shouldShowList: true,   // EXIGIDO POR LA NUEVA VERSIÓN DE EXPO
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

    // Obtenemos el token usando el ID de tu proyecto de Expo (el que está en app.json)
    token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log("Tu Push Token es:", token);

    // 🚀 INYECCIÓN EN FIREBASE: Guardamos el token en el perfil del usuario
    if (token && userId) {
      try {
        await updateDoc(doc(db, 'users', userId), {
          expoPushToken: token
        });
      } catch (error) {
        console.error("Error guardando el Push Token en Firebase:", error);
      }
    }

  } else {
    console.log('Debes usar un dispositivo físico para las Notificaciones Push');
  }

  return token;
}

// FUNCIÓN 2: El gatillo para disparar la notificación a otro usuario
export async function sendPushNotification(expoPushToken: string, title: string, body: string, data = {}) {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title: title,
    body: body,
    data: data,
  };

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
}