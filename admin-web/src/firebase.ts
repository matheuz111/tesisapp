import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyA-SNgfj5gYjujQV0woDj7DOkOU8z2P5o4",
  authDomain: "tesis-servicios.firebaseapp.com",
  projectId: "tesis-servicios",
  storageBucket: "tesis-servicios.firebasestorage.app",
  messagingSenderId: "656189561118",
  appId: "1:656189561118:web:f52a2652645d4aead6910f"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
