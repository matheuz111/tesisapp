import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA-SNgfj5gYjujQV0woDj7DOkOU8z2P5o4",
  authDomain: "tesis-servicios.firebaseapp.com",
  projectId: "tesis-servicios",
  storageBucket: "tesis-servicios.firebasestorage.app",
  messagingSenderId: "656189561118",
  appId: "1:656189561118:web:f52a2652645d4aead6910f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function main() {
  const email = `sync_reader@maestroadomicilio.com`;
  const pass = 'SyncBot2026!Secure';
  await signInWithEmailAndPassword(auth, email, pass);

  try {
    const snap = await getDocs(query(collection(db, 'service_requests'), limit(5)));
    console.log(`Successfully fetched ${snap.docs.length} service requests!`);
    snap.docs.forEach(d => {
      const data = d.data();
      console.log(d.id, data.code, data.clientName, data.clientPhone, data.district);
    });
  } catch (err) {
    console.log('Cannot read service_requests with regular user:', err.message);
  }
}

main();
