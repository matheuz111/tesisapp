import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// REEMPLAZA ESTO CON TUS CREDENCIALES DE LA CONSOLA FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyA-SNgfj5gYjujQV0woDj7DOkOU8z2P5o4",
  authDomain: "tesis-servicios.firebaseapp.com",
  projectId: "tesis-servicios",
  storageBucket: "tesis-servicios.firebasestorage.app",
  messagingSenderId: "656189561118",
  appId: "1:656189561118:web:f52a2652645d4aead6910f"
};

const app = initializeApp(firebaseConfig);

// 2. CAMBIA LA INICIALIZACIÓN DE AUTH POR ESTA LÍNEA ESPECIAL:
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

const db = getFirestore(app);

export { auth, db };
