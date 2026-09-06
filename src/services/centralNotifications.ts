import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { queueDemoPushNotification } from './demoPushService';
import { withTimeout } from './async';

export async function notifyCentral(requestId: string, title: string, body: string, eventType: string) {
  if (process.env.EXPO_PUBLIC_NOTIFICATION_MODE !== 'demo-direct') return;
  const senderUid = auth.currentUser?.uid;
  if (!senderUid) return;
  try {
    const operators = await withTimeout(getDocs(query(collection(db, 'users'), where('role', 'in', ['OPERATOR', 'ADMIN']))), 6000);
    if (auth.currentUser?.uid !== senderUid) return;
    await Promise.allSettled(operators.docs.map(async (operator) => {
      const snapshot = await withTimeout(getDoc(doc(db, 'push_tokens', operator.id)), 6000);
      if (auth.currentUser?.uid !== senderUid) return;
      await queueDemoPushNotification(snapshot.data()?.tokens || [], title, body,
        { requestId, screen: 'operator_home', type: eventType, recipientId: operator.id }, { requestId, eventType, senderUserId: senderUid });
    }));
  } catch { console.warn('No se pudo preparar la alerta de la central. La solicitud permanece en la bandeja.'); }
}
