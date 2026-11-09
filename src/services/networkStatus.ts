import { useState, useEffect, useCallback } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';

type NetworkListener = (isOnline: boolean) => void;

class NetworkStatusService {
  private static instance: NetworkStatusService;
  private isOnline = true;
  private listeners: Set<NetworkListener> = new Set();
  private checkInterval: any = null;

  private constructor() {
    this.init();
  }

  public static getInstance(): NetworkStatusService {
    if (!NetworkStatusService.instance) {
      NetworkStatusService.instance = new NetworkStatusService();
    }
    return NetworkStatusService.instance;
  }

  private init() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      window.addEventListener('online', () => this.updateStatus(true));
      window.addEventListener('offline', () => this.updateStatus(false));
    } else {
      // En móvil: verificar inicialmente y escuchar AppState
      void this.checkConnectivity();
      AppState.addEventListener('change', (state: AppStateStatus) => {
        if (state === 'active') {
          void this.checkConnectivity();
        }
      });
      // Verificación periódica ligera cada 15 segundos
      this.checkInterval = setInterval(() => {
        void this.checkConnectivity();
      }, 15000);
    }
  }

  public async checkConnectivity(): Promise<boolean> {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const online = navigator.onLine;
      this.updateStatus(online);
      return online;
    }

    try {
      // Ping ultraligero con timeout de 3 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      // Usar endpoint generate_204 confiable de Google
      const response = await fetch('https://clients3.google.com/generate_204', {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const online = response.status === 204 || response.ok;
      this.updateStatus(online);
      return online;
    } catch {
      this.updateStatus(false);
      return false;
    }
  }

  private updateStatus(newStatus: boolean) {
    if (this.isOnline !== newStatus) {
      this.isOnline = newStatus;
      this.listeners.forEach((listener) => listener(newStatus));
    }
  }

  public getStatus(): boolean {
    return this.isOnline;
  }

  public subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    listener(this.isOnline);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const networkStatusService = NetworkStatusService.getInstance();

export function useNetworkStatus(): {
  isOnline: boolean;
  checkConnectivity: () => Promise<boolean>;
} {
  const [isOnline, setIsOnline] = useState<boolean>(networkStatusService.getStatus());

  useEffect(() => {
    const unsubscribe = networkStatusService.subscribe((status) => {
      setIsOnline(status);
    });
    return unsubscribe;
  }, []);

  const checkConnectivity = useCallback(async () => {
    return networkStatusService.checkConnectivity();
  }, []);

  return { isOnline, checkConnectivity };
}
