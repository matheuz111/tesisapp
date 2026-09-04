import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
// @ts-ignore - The type definition is missing in some TS configurations, but the export exists at runtime in React Native
import { Auth, getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';

// Configuración de Firebase (soporta variables de entorno y fallback)
const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyA-SNgfj5gYjujQV0woDj7DOkOU8z2P5o4",
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "tesis-servicios.firebaseapp.com",
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "tesis-servicios",
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "tesis-servicios.firebasestorage.app",
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "656189561118",
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:656189561118:web:f52a2652645d4aead6910f"
};

let app: FirebaseApp;
let auth: Auth;

if (!getApps().length) {
    app = initializeApp(firebaseConfig);
    // 2. CAMBIA LA INICIALIZACIÓN DE AUTH POR ESTA LÍNEA ESPECIAL:
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });
} else {
    app = getApp();
    auth = getAuth(app);
}

const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

export { auth, db, storage };

