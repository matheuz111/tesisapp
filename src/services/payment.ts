import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { withTimeout } from './async';

export type PaymentMethod = 'YAPE' | 'PLIN' | 'CASH' | 'TRANSFER';
export type PaymentStatus = 'PENDING' | 'PAID' | 'CONFIRMED';

export const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: string }[] = [
  { id: 'YAPE', label: 'Yape', icon: 'phone-portrait-outline' },
  { id: 'PLIN', label: 'Plin', icon: 'phone-portrait-outline' },
  { id: 'CASH', label: 'Efectivo', icon: 'cash-outline' },
  { id: 'TRANSFER', label: 'Transferencia bancaria', icon: 'card-outline' },
];

export interface ClientPaymentData {
  requestId: string;
  method: PaymentMethod;
  voucherPhoto?: string | null;
}

export function isValidPaymentMethod(method: unknown): method is PaymentMethod {
  return typeof method === 'string' && ['YAPE', 'PLIN', 'CASH', 'TRANSFER'].includes(method);
}

export async function submitClientPayment({
  requestId,
  method,
  voucherPhoto,
}: ClientPaymentData): Promise<void> {
  if (!requestId || typeof requestId !== 'string') {
    throw new Error('Identificador de servicio inválido.');
  }
  if (!isValidPaymentMethod(method)) {
    throw new Error('Método de pago no reconocido.');
  }

  const requestRef = doc(db, 'service_requests', requestId);
  await withTimeout(
    updateDoc(requestRef, {
      paymentStatus: 'PAID',
      paymentMethod: method,
      ...(voucherPhoto ? { paymentVoucher: voucherPhoto } : {}),
      paidAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    8000
  );
}

export async function confirmProviderPayment(requestId: string, providerUid?: string): Promise<void> {
  if (!requestId || typeof requestId !== 'string') {
    throw new Error('Identificador de servicio inválido.');
  }

  const requestRef = doc(db, 'service_requests', requestId);
  await withTimeout(
    updateDoc(requestRef, {
      paymentStatus: 'CONFIRMED',
      paymentConfirmedByProvider: true,
      ...(providerUid ? { paymentConfirmedByUid: providerUid } : {}),
      paymentConfirmedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    8000
  );
}
