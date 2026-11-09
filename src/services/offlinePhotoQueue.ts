import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { uploadServiceImage } from './mediaStorage';

const QUEUE_STORAGE_KEY = '@maestro_offline_photo_queue_v1';

export interface QueuedPhoto {
  id: string;
  requestId: string;
  userId: string;
  type: 'issue' | 'completion';
  base64: string;
  capturedAt: number; // Marca temporal local del dispositivo
  status: 'PENDING_UPLOAD' | 'UPLOADING' | 'FAILED';
  retryCount: number;
  lastError?: string;
}

class OfflinePhotoQueueService {
  private queue: QueuedPhoto[] = [];
  private isProcessing = false;
  private listeners: Set<(queue: QueuedPhoto[]) => void> = new Set();

  constructor() {
    void this.loadQueue();
  }

  private async loadQueue() {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        this.notify();
      }
    } catch (err) {
      console.warn('Error cargando cola de fotos offline:', err);
    }
  }

  private async saveQueue() {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
      this.notify();
    } catch (err) {
      console.warn('Error persistiendo cola de fotos offline:', err);
    }
  }

  private notify() {
    this.listeners.forEach((l) => l([...this.queue]));
  }

  public subscribe(listener: (queue: QueuedPhoto[]) => void): () => void {
    this.listeners.add(listener);
    listener([...this.queue]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Encola una foto tomada sin conexión o con red inestable.
   * Guarda capturedAt local pero la marca oficial será del servidor al subir.
   */
  public async queuePhoto(
    requestId: string,
    userId: string,
    type: 'issue' | 'completion',
    base64: string
  ): Promise<QueuedPhoto> {
    const item: QueuedPhoto = {
      id: `${requestId}_${type}_${Date.now()}`,
      requestId,
      userId,
      type,
      base64,
      capturedAt: Date.now(),
      status: 'PENDING_UPLOAD',
      retryCount: 0,
    };

    // Reemplazar si ya había una pendiente del mismo tipo para este servicio
    this.queue = this.queue.filter(
      (q) => !(q.requestId === requestId && q.type === type && q.status === 'PENDING_UPLOAD')
    );
    this.queue.push(item);
    await this.saveQueue();
    return item;
  }

  public getQueue(): QueuedPhoto[] {
    return [...this.queue];
  }

  public getPendingForRequest(requestId: string): QueuedPhoto[] {
    return this.queue.filter((q) => q.requestId === requestId && q.status === 'PENDING_UPLOAD');
  }

  /**
   * Procesa la cola cuando se restablece la conexión.
   */
  public async flushQueue(): Promise<number> {
    if (this.isProcessing || this.queue.length === 0) return 0;
    this.isProcessing = true;
    let uploadedCount = 0;

    try {
      const pendingItems = this.queue.filter((q) => q.status === 'PENDING_UPLOAD');

      for (const item of pendingItems) {
        item.status = 'UPLOADING';
        this.notify();

        try {
          // 1. Subir a Firebase Storage
          const photoUrl = await uploadServiceImage(
            item.requestId,
            item.userId,
            item.base64,
            item.type
          );

          if (photoUrl) {
            // 2. Actualizar Firestore: capturedAt es adicional, la oficial es updatedAt / serverTimestamp
            const reqRef = doc(db, 'service_requests', item.requestId);
            if (item.type === 'issue') {
              await updateDoc(reqRef, {
                issuePhoto: photoUrl,
                issue_photo: photoUrl,
                issueCapturedAt: item.capturedAt, // Marca local auditada
                updatedAt: serverTimestamp(),     // Marca oficial de servidor
              });
            } else {
              await updateDoc(reqRef, {
                evidencePhoto: photoUrl,
                evidence_photo: photoUrl,
                completionCapturedAt: item.capturedAt, // Marca local auditada
                updatedAt: serverTimestamp(),          // Marca oficial de servidor
              });
            }

            // Remover de la cola tras éxito
            this.queue = this.queue.filter((q) => q.id !== item.id);
            uploadedCount++;
          }
        } catch (err: any) {
          console.warn(`Error al subir foto en cola (${item.id}):`, err);
          item.status = 'PENDING_UPLOAD';
          item.retryCount += 1;
          item.lastError = err?.message || 'Error de red';
        }
      }

      await this.saveQueue();
    } finally {
      this.isProcessing = false;
    }

    return uploadedCount;
  }
}

export const offlinePhotoQueue = new OfflinePhotoQueueService();
