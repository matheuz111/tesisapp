import { useEffect, useRef, useState } from 'react';
import { convertIntake, subscribeNewIntakes, type ConversionResult } from '../services/intakeService';

interface Options {
  operator: { uid: string; name: string } | null;
  /** Sin conexión no se procesa: la transacción fallaría y se reintentaría en bucle. */
  enabled: boolean;
  onCreated: (result: Extract<ConversionResult, { kind: 'created' }>) => void;
  onRejected: (result: Extract<ConversionResult, { kind: 'rejected' }>) => void;
}

/**
 * Convierte en solicitudes oficiales las entradas que llegan por WhatsApp (Google Forms → Sheets → Firestore).
 * Corre en el panel de la central: no hay Cloud Functions en el plan gratuito, así que mientras el panel está
 * abierto cada entrada nueva se registra sola, con correlativo y PIN, y aparece en la bandeja en tiempo real.
 * Devuelve cuántas entradas esperan ser procesadas.
 */
export function useWhatsappIntake({ operator, enabled, onCreated, onRejected }: Options): { pending: number } {
  const [pending, setPending] = useState(0);
  const inFlight = useRef(new Set<string>());
  const callbacks = useRef({ onCreated, onRejected });
  useEffect(() => { callbacks.current = { onCreated, onRejected }; });

  const operatorId = operator?.uid;
  const operatorName = operator?.name;

  useEffect(() => {
    if (!operatorId || !enabled) return;
    const unsubscribe = subscribeNewIntakes(
      (entries) => {
        setPending(entries.length);
        for (const entry of entries) {
          if (inFlight.current.has(entry.id)) continue;
          inFlight.current.add(entry.id);
          convertIntake(entry, { uid: operatorId, name: operatorName || 'Central' })
            .then((result) => {
              if (result.kind === 'created') callbacks.current.onCreated(result);
              else if (result.kind === 'rejected') callbacks.current.onRejected(result);
            })
            .catch(() => {
              // Falla transitoria (red, conflicto): se vuelve a intentar con la siguiente notificación del listener.
            })
            .finally(() => { inFlight.current.delete(entry.id); });
        }
      },
      () => setPending(0),
    );
    return () => unsubscribe();
  }, [operatorId, operatorName, enabled]);

  return { pending: enabled ? pending : 0 };
}
