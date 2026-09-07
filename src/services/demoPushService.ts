// ═══════════════════════════════════════════════════════════════════════════════════
// DEMO_ONLY: Solución provisional de Notificaciones Push Directas para Demostración Académica.
//
// ⚠️ AVISO DE ARQUITECTURA Y SEGURIDAD:
// Este módulo envía notificaciones directamente desde el cliente móvil hacia la
// API pública de Expo (https://exp.host/--/api/v2/push/send).
// Esta práctica es EXCLUSIVA para entornos de prueba o sustentación académica donde
// no se cuenta con Firebase Cloud Functions (Plan Blaze de pago por uso).
//
// En un entorno de producción comercial, el envío debe realizarse SIEMPRE desde un
// servidor backend seguro (o Cloud Functions) para evitar spoofing de notificaciones,
// garantizar auditoría y proteger la integridad del flujo.
// ═══════════════════════════════════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../config/firebase';

export interface PushNotificationPayload {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

export interface DemoPushOptions {
  requestId?: string;
  eventType?: string;
  senderUserId?: string;
  eventId?: string;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const DEFAULT_TIMEOUT_MS = 6000;

// Caché en memoria para evitar notificaciones duplicadas en transiciones rápidas
const sentEventsCache = new Map<string, number>();
const DEDUP_TTL_MS = 15000; // 15 segundos

/**
 * Limpia eventos antiguos de la caché de deduplicación
 */
function cleanupDedupCache() {
  const now = Date.now();
  for (const [key, timestamp] of sentEventsCache.entries()) {
    if (now - timestamp > DEDUP_TTL_MS) {
      sentEventsCache.delete(key);
    }
  }
}

/**
 * Valida tokens de Expo (tanto formato moderno como heredado)
 */
export function isExpoPushToken(token: any): boolean {
  if (typeof token !== 'string') return false;
  return /^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$/.test(token);
}

/**
 * Enmascara un token para no exponerlo en logs
 */
export function maskToken(token: string): string {
  if (!token || typeof token !== 'string') return '***';
  if (token.length <= 16) return 'ExpoPushToken[***]';
  return `${token.substring(0, 16)}...${token.slice(-3)}]`;
}

/**
 * Extrae y deduplica tokens válidos desde un objeto o array
 */
export function extractValidTokens(rawTokens: any): string[] {
  if (!rawTokens) return [];
  const list = Array.isArray(rawTokens) ? rawTokens : [rawTokens];
  const unique = new Set<string>();

  for (const item of list) {
    if (typeof item === 'string' && isExpoPushToken(item.trim())) {
      unique.add(item.trim());
    }
  }

  return Array.from(unique);
}

/**
 * Construye el payload limpio con ÚNICAMENTE campos soportados por Expo Push API.
 * NO incluye objetos 'android' o 'apns' anidados que puedan ser rechazados.
 */
export function buildExpoPayload(
  token: string,
  title: string,
  body: string,
  data?: Record<string, any>,
  channelId: string = 'default'
): PushNotificationPayload {
  return {
    to: token,
    title,
    body,
    data: data || {},
    sound: 'default',
    priority: 'high',
    channelId,
  };
}

/**
 * Envía una notificación directa a través de Expo Push Service
 * Solo opera cuando EXPO_PUBLIC_NOTIFICATION_MODE === 'demo-direct'.
 */
export async function sendDemoPushNotification(
  targetTokens: string | string[] | undefined | null,
  title: string,
  body: string,
  data: Record<string, any> = {},
  options: DemoPushOptions = {}
): Promise<boolean> {
  const senderUid = auth.currentUser?.uid;
  if (!senderUid || (options.senderUserId && options.senderUserId !== senderUid)) return false;
  const mode = process.env.EXPO_PUBLIC_NOTIFICATION_MODE;
  if (mode !== 'demo-direct') {
    // Si no está en modo demo-direct, delega al backend/Cloud Functions estándar
    return false;
  }

  const validTokens = extractValidTokens(targetTokens);
  if (validTokens.length === 0) {
    return false;
  }

  // Distinguish recipient sets and individual messages from service transitions.
  cleanupDedupCache();
  const dedupKey = options.requestId && options.eventType
    ? `${options.requestId}_${options.eventType}_${options.eventId || ''}_${[...validTokens].sort().join(',')}` : '';
  if (options.requestId && options.eventType) {
    if (sentEventsCache.has(dedupKey)) {
      console.log('[DEMO_PUSH] Evento duplicado ignorado.');
      return false;
    }
  }

  const messages = validTokens.map((token) =>
    buildExpoPayload(token, title, body, data, 'default')
  );

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
      signal: controller.signal,
    });


    if (!response.ok) {
      console.warn(`[DEMO_PUSH] Expo HTTP Error ${response.status}: ${response.statusText}`);
      return false;
    }

    const result = await response.json();
    const tickets = Array.isArray(result?.data) ? result.data : [];

    let successCount = 0;
    tickets.forEach((ticket: any, index: number) => {
      const masked = maskToken(validTokens[index]);
      if (ticket?.status === 'ok') {
        successCount++;
      } else {
        console.warn(`[DEMO_PUSH] Ticket error para ${masked}:`, ticket?.details?.error || ticket?.message);
      }
    });

    // Tickets acknowledge Expo acceptance; receipts report the later FCM result.
    const uid = senderUid;
    if (auth.currentUser?.uid === uid) {
      try {
        const receipts = JSON.parse(await AsyncStorage.getItem(`push-receipts:${uid}`) || '[]');
        await AsyncStorage.setItem(`push-receipts:${uid}`, JSON.stringify([...receipts, ...tickets.filter((ticket: any) => ticket.status === 'ok' && ticket.id).map((ticket: any) => ({ id: ticket.id, createdAt: Date.now() }))]));
        const failure = tickets.find((ticket: any) => ticket.status === 'error');
        if (failure) await AsyncStorage.setItem(`push-last-error:${uid}`, String(failure.details?.error || failure.message || 'Expo rechazó el aviso'));
      } catch { /* Diagnostic persistence must not cause a duplicate send. */ }
    }

    if (dedupKey && successCount === validTokens.length) sentEventsCache.set(dedupKey, Date.now());
    console.log(`[DEMO_PUSH] Expo aceptó ${successCount}/${validTokens.length} notificaciones; la entrega al dispositivo se verifica con receipts.`);
    return successCount > 0;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      console.warn('[DEMO_PUSH] Timeout al contactar Expo Push Service.');
    } else {
      console.warn('[DEMO_PUSH] No se pudo enviar la notificación:', error?.message || error);
    }
    // No interrumpir la experiencia del usuario si falla la notificación
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

type PendingPush = { id: string; createdAt: number; tokens: string[]; title: string; body: string; data: Record<string, any>; options: DemoPushOptions };
let queueLock = Promise.resolve();
const flushing = new Map<string, Promise<void>>();

function editQueue(uid: string, edit: (items: PendingPush[]) => PendingPush[]) {
  const task = queueLock.then(async () => {
    const key = `push-outbox:${uid}`;
    const raw = await AsyncStorage.getItem(key);
    const items = raw ? JSON.parse(raw) as PendingPush[] : [];
    await AsyncStorage.setItem(key, JSON.stringify(edit(items)));
  });
  queueLock = task.catch(() => {});
  return task;
}

// Persist before sending; retry on foreground/reconnect. Never claim guaranteed delivery.
export async function queueDemoPushNotification(
  tokens: string | string[] | null | undefined, title: string, body: string,
  data: Record<string, any> = {}, options: DemoPushOptions = {}
) {
  if (process.env.EXPO_PUBLIC_NOTIFICATION_MODE !== 'demo-direct') return false;
  const uid = auth.currentUser?.uid;
  const valid = extractValidTokens(tokens);
  if (!uid || !valid.length) return false;
  const item: PendingPush = { id: `${Date.now()}-${Math.random()}`, createdAt: Date.now(), tokens: valid, title, body: body.slice(0, 160), data, options };
  try {
    // One queue entry per device: one successful device must not discard a
    // failed delivery to another device registered to the same account.
    await editQueue(uid, (items) => [...items, ...valid.map((token, index) => ({ ...item, id: `${item.id}-${index}`, tokens: [token] }))]);
    // The UI waits only for local durability, never a backlog of network requests.
    void flushDemoPushOutbox(uid).catch(() => {});
    return true;
  } catch { console.warn('No se pudo preparar la notificación. Revisa conexión y almacenamiento.'); return false; }
}

export function flushDemoPushOutbox(uid: string): Promise<void> {
  if (process.env.EXPO_PUBLIC_NOTIFICATION_MODE !== 'demo-direct' || auth.currentUser?.uid !== uid) return Promise.resolve();
  const existing = flushing.get(uid);
  if (existing) return existing;
  const run = async () => {
    const attempted = new Set<string>();
    while (attempted.size < 20) {
      await queueLock;
      const items = JSON.parse(await AsyncStorage.getItem(`push-outbox:${uid}`) || '[]') as PendingPush[];
      const item = items.find((entry) => !attempted.has(entry.id));
      if (!item) break;
      attempted.add(item.id);
      if (auth.currentUser?.uid !== uid) break;
      if (Date.now() - item.createdAt > 24 * 60 * 60 * 1000) { await editQueue(uid, (queue) => queue.filter((entry) => entry.id !== item.id)); continue; }
      const accepted = await sendDemoPushNotification(item.tokens, item.title, item.body, item.data, item.options);
      if (!accepted) continue;
      await editQueue(uid, (queue) => queue.filter((entry) => entry.id !== item.id));
    }
    if (auth.currentUser?.uid === uid) await checkPushReceipts(uid);
  };
  const task = run().finally(() => flushing.delete(uid));
  flushing.set(uid, task);
  return task;
}

export async function checkPushReceipts(uid: string) {
  const key = `push-receipts:${uid}`;
  const pending: { id: string; createdAt: number }[] = JSON.parse(await AsyncStorage.getItem(key) || '[]');
  const due = pending.filter((item) => Date.now() - item.createdAt >= 15000).slice(0, 100);
  if (!due.length || auth.currentUser?.uid !== uid) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: due.map((item) => item.id) }), signal: controller.signal });
    if (!response.ok) return;
    const result = await response.json();
    const receipts = result?.data || {};
    const failure: any = Object.values(receipts).find((receipt: any) => receipt.status === 'error');
    if (failure) await AsyncStorage.setItem(`push-last-error:${uid}`, String(failure.details?.error || failure.message || 'FCM rechazó el aviso'));
    else if (Object.values(receipts).some((receipt: any) => receipt.status === 'ok')) await AsyncStorage.removeItem(`push-last-error:${uid}`);
    await AsyncStorage.setItem(key, JSON.stringify(pending.filter((item) => !receipts[item.id] && Date.now() - item.createdAt < 24 * 60 * 60 * 1000)));
  } catch { /* Keep receipts for the next foreground retry. */ }
  finally { clearTimeout(timeout); }
}

export async function getPushDiagnostics(uid: string) {
  const items = JSON.parse(await AsyncStorage.getItem(`push-outbox:${uid}`) || '[]');
  return { pending: items.length, lastError: await AsyncStorage.getItem(`push-last-error:${uid}`) };
}
