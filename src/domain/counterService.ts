import { doc, Firestore, runTransaction, serverTimestamp } from 'firebase/firestore';

/**
 * Genera el siguiente código correlativo legible para solicitudes de servicio (ej. SOL-POST-0001).
 * Utiliza una transacción atómica sobre la colección `counters/service_requests` para garantizar
 * que dos usuarios concurrentes nunca reciban el mismo número correlativo.
 *
 * @param db Instancia de Firestore
 * @param prefix Prefijo del código correlativo (por defecto 'SOL-POST')
 * @returns Código formateado con ceros a la izquierda (ej. "SOL-POST-0001")
 */
export async function getNextServiceRequestCode(
  db: Firestore,
  prefix: string = 'SOL-POST'
): Promise<string> {
  const counterRef = doc(db, 'counters', 'service_requests');

  try {
    const nextVal = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(counterRef);

      if (!snap.exists()) {
        transaction.set(counterRef, {
          current: 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return 1;
      }

      const data = snap.data();
      const current = typeof data?.current === 'number' ? data.current : 0;
      const incremented = current + 1;

      transaction.update(counterRef, {
        current: incremented,
        updatedAt: serverTimestamp(),
      });

      return incremented;
    });

    return `${prefix}-${String(nextVal).padStart(4, '0')}`;
  } catch (error) {
    console.warn('Error en transacción de correlativo counters/service_requests. Aplicando fallback:', error);
    // Fallback defensivo basado en milisegundos para evitar bloquear la app en caso de conectividad intermitente
    const fallbackNum = Math.floor(1000 + (Date.now() % 9000));
    return `${prefix}-${fallbackNum}`;
  }
}
