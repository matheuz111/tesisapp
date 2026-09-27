import { collection, onSnapshot, orderBy, query, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import type { ServiceRequest } from '../types';

/**
 * Service Request Repository for Firestore.
 * Isolates data access and external persistence logic.
 */
export const serviceRequestRepository = {
  /**
   * Subscribes in real-time to service requests sorted by creation date descending.
   */
  subscribeAll(
    onData: (requests: ServiceRequest[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const requestsRef = collection(db, 'service_requests');
    const q = query(requestsRef, orderBy('createdAt', 'desc'));

    return onSnapshot(
      q,
      (snapshot) => {
        const list: ServiceRequest[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as ServiceRequest[];
        onData(list);
      },
      (err) => {
        console.error('[serviceRequestRepository] Error listening to requests:', err);
        if (onError) onError(err);
      }
    );
  },
};
