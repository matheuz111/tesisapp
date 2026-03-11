import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
// @ts-ignore - The type definition is missing in some TS configurations, but the export exists at runtime in React Native
import { Auth, getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';

// REEMPLAZA ESTO CON TUS CREDENCIALES DE LA CONSOLA FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyA-SNgfj5gYjujQV0woDj7DOkOU8z2P5o4",
    authDomain: "tesis-servicios.firebaseapp.com",
    projectId: "tesis-servicios",
    storageBucket: "tesis-servicios.firebasestorage.app",
    messagingSenderId: "656189561118",
    appId: "1:656189561118:web:f52a2652645d4aead6910f"
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

export { auth, db };

