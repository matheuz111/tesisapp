import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { arrayUnion, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../src/config/firebase';

// Configuración de cómo se comporta la notificación cuando la app está abierta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// FUNCIÓN 1: Pedir permiso y obtener el Token único del celular
export async function registerForPushNotificationsAsync(userId: string) {
  let token: string | undefined;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Solicitudes y servicios',
      description: 'Alertas importantes sobre solicitudes y estados del servicio',
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
    const permResult: any = await Notifications.getPermissionsAsync();
    let isGranted = permResult?.granted || permResult?.status === 'granted';
    if (!isGranted) {
      const requestResult: any = await Notifications.requestPermissionsAsync();
      isGranted = requestResult?.granted || requestResult?.status === 'granted';
    }
    if (!isGranted) {
      console.log('Fallo al obtener el push token para las notificaciones');
      return;
    }
    try {
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      if (!projectId) {
        throw new Error('No se encontró extra.eas.projectId en la configuración de Expo.');
      }
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      
      // Los tokens viven en una colección privada; no forman parte del perfil público.
      if (token && userId) {
        await setDoc(doc(db, 'push_tokens', userId), {
          tokens: arrayUnion(token),
          updatedAt: serverTimestamp(),
        }, { merge: true });
        console.log("Push Token guardado:", token);
      }
    } catch (error) {
      console.error("Error guardando el Push Token en Firebase:", error);
    }
  } else {
    console.log('Debes usar un dispositivo físico para las Notificaciones Push');
  }

  return token;
}
