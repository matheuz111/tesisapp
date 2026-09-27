import { collection, query, where, limit, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import type { ProviderPresence, ProviderOperationalStatus, OperationalZone } from '../types/canonical';

/**
 * Repository to manage technician presence subscriptions from Firestore.
 * Supports scalable queries prioritizing active technicians (AVAILABLE and BUSY)
 * to avoid downloading unbounded offline records.
 */
export const presenceRepository = {
  /**
   * Subscribes to active provider presence (AVAILABLE and BUSY) or specific filtered states.
   */
  subscribeActive(
    onData: (providers: ProviderPresence[]) => void,
    onError?: (err: Error) => void,
    options?: {
      statusFilter?: 'ALL' | ProviderOperationalStatus;
      zoneFilter?: 'ALL' | OperationalZone;
    }
  ): Unsubscribe {
    const presenceRef = collection(db, 'provider_presence');
    let q;

    if (options?.statusFilter && options.statusFilter !== 'ALL') {
      q = query(presenceRef, where('status', '==', options.statusFilter));
    } else {
      // Priorizar técnicos activos en servicio o disponibles
      q = query(presenceRef, where('status', 'in', ['AVAILABLE', 'BUSY']));
    }

    return onSnapshot(
      q,
      (snapshot) => {
        const list: ProviderPresence[] = snapshot.docs.map((docSnap) => ({
          providerId: docSnap.id,
          ...docSnap.data(),
        })) as ProviderPresence[];
        onData(list);
      },
      (err) => {
        console.error('[presenceRepository] Error querying active presence:', err);
        if (onError) onError(err);
      }
    );
  },

  /**
   * Subscribes to all provider presence updates with safety limit.
   */
  subscribeAll(
    onData: (providers: ProviderPresence[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    const presenceRef = collection(db, 'provider_presence');
    const q = query(presenceRef, limit(100));

    return onSnapshot(
      q,
      (snapshot) => {
        const list: ProviderPresence[] = snapshot.docs.map((docSnap) => ({
          providerId: docSnap.id,
          ...docSnap.data(),
        })) as ProviderPresence[];
        onData(list);
      },
      (err) => {
        console.error('[presenceRepository] Error listening to provider presence:', err);
        if (onError) onError(err);
      }
    );
  },
};
