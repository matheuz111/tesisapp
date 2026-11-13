import AsyncStorage from '@react-native-async-storage/async-storage';
import { resetToLogin } from '../../../src/navigation/resetStack';
import { signOutWithNotifications } from '../../../utils/pushNotifications';
import { HomeSkeleton } from '../../../src/components/Skeleton';
import { withTimeout } from '../../../src/services/async';
import { notifyCentral } from '../../../src/services/centralNotifications';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

import * as Haptics from 'expo-haptics';
import {
  GeoPoint,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  runTransaction,
  setDoc,
  addDoc,
  where,
} from 'firebase/firestore';
import { TechnicianRejectModal, type RejectionReasonCode } from '../../../src/components/TechnicianRejectModal';
import * as geofire from 'geofire-common';
import { ProviderDashboard } from '../../../src/components/ProviderDashboard';
import { auth, db } from '../../../src/config/firebase';
import { useTheme } from '../../../src/context/ThemeContext';
import { useSession } from '../../../src/context/SessionContext';
import { transitionServiceStatus } from '../../../src/domain/serviceRequestTransition';
import { uploadServiceImage } from '../../../src/services/mediaStorage';
import { queueDemoPushNotification as sendDemoPushNotification } from '../../../src/services/demoPushService';
import { confirmProviderPayment } from '../../../src/services/payment';
import { createAdaptivePresencePublisher, updateProviderPresence } from '../../../src/services/providerPresenceService';
import { setBackgroundTrackingContext, startBackgroundLocationUpdates, stopBackgroundLocationUpdates } from '../../../src/services/backgroundLocationTask';
import { FEATURE_FLAGS } from '../../../src/config/featureFlags';
import { useBackgroundLocationConsent } from '../../../src/hooks/useBackgroundLocationConsent';
import { OfflineBanner } from '../../../src/components/OfflineBanner';
import { useNetworkStatus } from '../../../src/services/networkStatus';
import { offlinePhotoQueue } from '../../../src/services/offlinePhotoQueue';


// ─────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────
export default function ProviderHome() {
  const router = useRouter();
  const { colors } = useTheme();

  const { user, profile, loading, error: profileError, retry } = useSession();
  const { isOnline } = useNetworkStatus();
  const [offlinePhotosCount, setOfflinePhotosCount] = useState(0);

  // Monitor de cola de fotos offline mediante suscripción reactiva
  useEffect(() => {
    const unsubscribe = offlinePhotoQueue.subscribe((queue) => {
      setOfflinePhotosCount(queue.length);
    });
    return () => unsubscribe();
  }, []);

  // Sincronizar automáticamente fotos al recuperar conexión a internet
  useEffect(() => {
    if (isOnline && user?.uid) {
      offlinePhotoQueue.flushQueue().then((syncedCount) => {
        if (syncedCount > 0) {
          Toast.show({
            type: 'success',
            text1: 'Evidencias sincronizadas ☁️',
            text2: `Se sincronizaron ${syncedCount} foto(s) guardadas sin conexión.`,
          });
        }
      }).catch((e) => console.warn('Error sincronizando cola offline:', e));
    }
  }, [isOnline, user?.uid]);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestAttempt, setRequestAttempt] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [specialty, setSpecialty] = useState('');
  const [location, setLocation] = useState<any>(null);
  const [providerName, setProviderName] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  // Gamification
  const [totalRating, setTotalRating] = useState('0.0');
  const [jobsCompleted, setJobsCompleted] = useState(0);
  const [serviceRadius, setServiceRadius] = useState(10);

  const [incomingRequest, setIncomingRequest] = useState<any>(null);
  const [currentJob, setCurrentJob] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingInitial, setUploadingInitial] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [inputPin, setInputPin] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [dismissedCompletedId, setDismissedCompletedId] = useState<string | null>(null);
  // Refs: los callbacks de suscripciones y publicadores viven más que un render y no deben leer valores viejos.
  const currentJobRef = useRef<any>(null);
  const dismissedCompletedRef = useRef<string | null>(null);
  const [pinAttempts, setPinAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
  const [rejectionTarget, setRejectionTarget] = useState<{ id: string; status: string } | null>(null);
  const [submittingRejection, setSubmittingRejection] = useState(false);
  const isAcceptingRef = useRef(false);
  const bgConsent = useBackgroundLocationConsent();

  // Refs de seguimiento continuo
  const publisherRef = useRef<ReturnType<typeof createAdaptivePresencePublisher> | null>(null);
  const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);

  // Limpieza al desmontar el componente
  useEffect(() => {
    return () => {
      locationWatcherRef.current?.remove();
      locationWatcherRef.current = null;
      publisherRef.current?.dispose();
      publisherRef.current = null;
      void stopBackgroundLocationUpdates();
    };
  }, []);

  // Cuenta regresiva de bloqueo por reintentos de PIN fallidos (HU-18)
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  // Animación del toggle
  const [toggleScale] = useState(() => new Animated.Value(1));


  // ── Cargar perfil ───────────────────────
  useEffect(() => {
    const data = profile;
    if (data && user && data.uid === user.uid) {
          setSpecialty(data.specialty || '');
          setIsActive(data.is_active || false);
          setProviderName(data.full_name || data.name || data.displayName || user.email?.split('@')[0] || '');
          setIsVerified(data.is_verified !== false);
          if (data.current_location) {
            setLocation({
              latitude: data.current_location.latitude,
              longitude: data.current_location.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            });
          }
          setTotalRating(data.review_count > 0 ? (data.total_rating / data.review_count).toFixed(1) : '0.0');
          setJobsCompleted(data.jobs_completed || 0);
          setServiceRadius(data.service_radius_km || 10);
    }
  }, [profile, user]);

  useEffect(() => {
    setIncomingRequest(null); setCurrentJob(null); setInputPin(''); setRequestError(null);
    isAcceptingRef.current = false;
  }, [user?.uid]);

  // Una consulta de servicios activos; el historial no se descarga en el inicio.
  useEffect(() => {
    if (!user) return;
    let active = true;
    let incomingId: string | null = null;
    const unsubscribe = onSnapshot(query(collection(db, 'service_requests'), where('providerId', '==', user.uid), where('status', 'in', ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'])), (snapshot) => {
      if (!active || auth.currentUser?.uid !== user.uid) return;
      setRequestError(null);
      const requests = snapshot.docs.map((item) => ({ id: item.id, ...item.data() as any }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      const incoming = requests.find((request) => request.status === 'PENDING') || null;
      if (incoming && incoming.id !== incomingId) {
        Vibration.vibrate([0, 500, 200, 500]);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        Toast.show({ type: 'success', text1: 'Nueva solicitud', text2: (incoming.clientName || 'Un cliente') + ' te necesita.' });
      }
      incomingId = incoming?.id || null;
      setIncomingRequest(incoming);
      const activeJob = requests.find((request) => request.status !== 'PENDING') || null;
      if (activeJob && activeJob.status === 'COMPLETED' && activeJob.id === dismissedCompletedRef.current) {
        setCurrentJob(null);
      } else {
        setCurrentJob(activeJob);
      }
      if (!incoming) isAcceptingRef.current = false;
    }, (error) => {
      if (!active || auth.currentUser?.uid !== user.uid) return;
      console.warn('No se pudo actualizar el servicio:', error.message);
      setRequestError('No se pudieron actualizar tus servicios. Vuelve a intentar.');
    });
    return () => { active = false; unsubscribe(); };
  }, [user, requestAttempt]);

  // ── Aceptar trabajo ─────────────────────
  const acceptJob = async () => {
    if (!incomingRequest || accepting || !user) return;
    isAcceptingRef.current = true;
    setAccepting(true);
    const targetRequest = incomingRequest;
    setIncomingRequest(null);
    try {
      await runTransaction(db, async (transaction) => {
        const ref = doc(db, 'service_requests', targetRequest.id);
        const snapshot = await transaction.get(ref);
        if (snapshot.data()?.status !== 'PENDING' || snapshot.data()?.providerId !== user?.uid) throw new Error('La asignación ya no está disponible.');
        transaction.update(ref, { status: 'ACCEPTED', acceptedAt: serverTimestamp(), updatedAt: serverTimestamp() });

        // Registrar hito inmutable en status_history
        const historyRef = doc(collection(ref, 'status_history'));
        transaction.set(historyRef, {
          fromStatus: 'PENDING',
          toStatus: 'ACCEPTED',
          actorId: user.uid,
          actorRole: 'PROVIDER',
          timestamp: serverTimestamp(),
          notes: 'Trabajo aceptado por el técnico',
        });
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Trabajo aceptado', text2: 'Consulta el destino y valida el PIN al llegar.' });

      // Notificar al cliente
      const clientTokens = targetRequest.notificationTokens?.client;
      if (clientTokens && clientTokens.length > 0) {
        const providerName = user?.displayName || 'El técnico';
        sendDemoPushNotification(
          clientTokens,
          'Técnico en camino',
          `${providerName} ha aceptado tu solicitud y va en camino.`,
          {
            requestId: targetRequest.id,
            screen: 'client_home',
            type: 'ACCEPTED',
          },
          {
            requestId: targetRequest.id,
            eventType: 'ACCEPTED',
          }
        ).catch(() => {});
      }
    } catch {
      Alert.alert('Error', 'No se pudo aceptar');
    } finally {
      setAccepting(false);
    }
  };

  // ── Rechazar trabajo asignado (Con motivo obligatorio para Central) ──
  const rejectJob = () => {
    if (!incomingRequest || !user) return;
    setRejectionTarget({ id: incomingRequest.id, status: incomingRequest.status });
    setRejectionModalVisible(true);
  };

  // ── Cancelar / abortar job en camino (Con motivo obligatorio para Central) ──
  const cancelJobAsProvider = () => {
    if (!currentJob || !user) return;
    setRejectionTarget({ id: currentJob.id, status: currentJob.status });
    setRejectionModalVisible(true);
  };

  // ── Procesar confirmación del modal con motivo estructurado ──
  const handleConfirmRejection = async (code: RejectionReasonCode, label: string, notes?: string) => {
    if (!rejectionTarget || !user) return;
    setSubmittingRejection(true);
    try {
      const fullReason = notes ? `${label} - ${notes}` : label;
      await transitionServiceStatus(
        db,
        rejectionTarget.id,
        'REQUIRES_REASSIGNMENT',
        { uid: user.uid, role: 'PROVIDER' },
        {
          fromStatus: rejectionTarget.status,
          notes: `Técnico devolvió asignación: ${fullReason}`,
          extraFields: {
            serviceStarted: false,
            rejectedProviderIds: arrayUnion(user.uid),
            rejectionReason: code,
            rejectionReasonText: fullReason,
            rejectedAt: serverTimestamp(),
          },
        }
      );

      void notifyCentral(
        rejectionTarget.id,
        'Servicio requiere reasignación',
        `Técnico ${user.displayName || 'Técnico'} devolvió asignación. Motivo: ${fullReason}`,
        'REQUIRES_REASSIGNMENT'
      );

      Toast.show({
        type: 'info',
        text1: 'Solicitud devuelta a Central',
        text2: `Motivo: ${label}`,
      });

      setRejectionModalVisible(false);
      setRejectionTarget(null);
      if (rejectionTarget.id === incomingRequest?.id) {
        setIncomingRequest(null);
      }
      if (rejectionTarget.id === currentJob?.id) {
        setCurrentJob(null);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo rechazar la solicitud.');
    } finally {
      setSubmittingRejection(false);
    }
  };

  // ── 1. Validar Llegada con PIN (Marca independiente de Llegada Presencial T_VIS) ──
  const validateArrivalPin = async () => {
    Keyboard.dismiss();
    if (!currentJob || !user) return;
    if (lockoutSeconds > 0) {
      Alert.alert(
        'Ingreso Temporalmente Bloqueado',
        `Por motivos de seguridad, espera ${lockoutSeconds} segundos antes de volver a ingresar el PIN.`
      );
      return;
    }
    const cleanPin = inputPin.trim();
    if (!cleanPin) {
      Alert.alert('PIN Requerido', 'Ingresa el código de 4 dígitos que aparece en la pantalla del cliente.');
      return;
    }
    if (cleanPin !== currentJob.securityPin) {
      const nextAttempts = pinAttempts + 1;
      setPinAttempts(nextAttempts);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (nextAttempts >= 3) {
        setLockoutSeconds(60);
        setPinAttempts(0);
        void notifyCentral(
          currentJob.id,
          'Alerta de Seguridad: PIN Inválido',
          `El técnico superó 3 intentos erróneos de PIN en la solicitud ${currentJob.id}.`,
          'REQUIRES_REASSIGNMENT'
        );
        Alert.alert(
          'Límite de Intentos Superado',
          'Has ingresado un PIN incorrecto 3 veces consecutivas. Por seguridad se bloqueó el ingreso por 60 segundos y se alertó a la central.'
        );
      } else {
        const remaining = 3 - nextAttempts;
        Alert.alert(
          'PIN Incorrecto',
          `PIN incorrecto. Te quedan ${remaining} ${remaining === 1 ? 'intento' : 'intentos'} antes del bloqueo de seguridad.`
        );
      }
      return;
    }
    setVerifyingPin(true);
    try {
      const ref = doc(db, 'service_requests', currentJob.id);
      await updateDoc(ref, {
        arrivalValidated: true,
        pinValidatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Auditoría status_history para la tesis
      await addDoc(collection(db, 'service_requests', currentJob.id, 'status_history'), {
        fromStatus: 'ACCEPTED',
        toStatus: 'ACCEPTED',
        actorId: user.uid,
        actorRole: 'PROVIDER',
        timestamp: serverTimestamp(),
        notes: 'Llegada al domicilio validada mediante PIN por el técnico (T_VIS completado)',
      });

      setPinAttempts(0);
      setInputPin('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({
        type: 'success',
        text1: '¡Llegada confirmada!',
        text2: 'PIN validado. Presiona "Iniciar trabajo" cuando comiences el desmontaje o revisión.',
      });
    } catch (err) {
      console.error('Error validando PIN de llegada:', err);
      Alert.alert('Error', 'No se pudo registrar la llegada con PIN.');
    } finally {
      setVerifyingPin(false);
    }
  };

  // ── 2. Iniciar Trabajo Técnico (Marca independiente de Inicio de Ejecución) ──
  const startJob = async () => {
    if (!currentJob || !user) return;
    try {
      await transitionServiceStatus(
        db,
        currentJob.id,
        'IN_PROGRESS',
        { uid: user.uid, role: 'PROVIDER' },
        {
          fromStatus: 'ACCEPTED',
          notes: 'Inicio formal de la ejecución del trabajo técnico por el operario',
          extraFields: {
            serviceStarted: true,
            startedAt: serverTimestamp(),
            pinValidatedAt: currentJob.pinValidatedAt || serverTimestamp(),
          },
        }
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({
        type: 'success',
        text1: 'Servicio en Ejecución',
        text2: 'Captura la fotografía inicial (Antes) para auditoría de calidad.',
      });

      // Notificar al cliente
      const clientTokens = currentJob.notificationTokens?.client;
      if (clientTokens && clientTokens.length > 0) {
        const providerName = user?.displayName || 'El técnico';
        sendDemoPushNotification(
          clientTokens,
          'Servicio en ejecución',
          `${providerName} ha iniciado los trabajos de reparación.`,
          { requestId: currentJob.id, screen: 'client_home', type: 'IN_PROGRESS' },
          { requestId: currentJob.id, eventType: 'IN_PROGRESS' }
        ).catch(() => {});
      }
    } catch (err) {
      console.error('Error iniciando trabajo:', err);
      Alert.alert('Error', 'No se pudo iniciar el trabajo.');
    }
  };

  // ── Selector optimizado de foto completa (Cámara o Galería sin recorte) ──
  const pickPhotoForService = async (title: string): Promise<string | null> => {
    return new Promise((resolve) => {
      Alert.alert(
        title,
        'Selecciona el origen de la imagen (se conservará completa y sin recortes):',
        [
          {
            text: 'Cámara 📷',
            onPress: async () => {
              const perm = await ImagePicker.requestCameraPermissionsAsync();
              if (!perm.granted) {
                Alert.alert('Permiso denegado', 'Se requiere acceso a la cámara.');
                resolve(null);
                return;
              }
              const res = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                quality: 0.7,
                base64: true,
                allowsEditing: false,
              });
              if (!res.canceled && res.assets?.[0]?.base64) {
                resolve(res.assets[0].base64);
              } else {
                resolve(null);
              }
            },
          },
          {
            text: 'Galería 🖼️',
            onPress: async () => {
              const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!perm.granted) {
                Alert.alert('Permiso denegado', 'Se requiere acceso a la galería.');
                resolve(null);
                return;
              }
              const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.7,
                base64: true,
                allowsEditing: false,
              });
              if (!res.canceled && res.assets?.[0]?.base64) {
                resolve(res.assets[0].base64);
              } else {
                resolve(null);
              }
            },
          },
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(null) },
        ]
      );
    });
  };

  // ── Registrar foto inicial (Antes) ────────
  const takeInitialPhoto = async () => {
    if (!currentJob || !user || uploadingInitial || currentJob.status !== 'IN_PROGRESS') return;
    const base64 = await pickPhotoForService('Foto de Estado Inicial (Antes)');
    if (!base64) return;

    setUploadingInitial(true);
    try {
      const issuePhoto = await uploadServiceImage(currentJob.id, user.uid, base64, 'issue');
      if (issuePhoto) {
        await updateDoc(doc(db, 'service_requests', currentJob.id), {
          issuePhoto,
          issue_photo: issuePhoto,
          updatedAt: serverTimestamp(),
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({
          type: 'success',
          text1: 'Foto inicial guardada',
          text2: 'Se registró el estado del problema (Antes) para auditoría y garantía.',
        });
      }
    } catch (err: any) {
      console.error('Error guardando foto inicial:', err);
      Alert.alert('Error', err.message || 'No se pudo subir la foto inicial. Inténtalo nuevamente.');
    } finally {
      setUploadingInitial(false);
    }
  };

  // ── Finalizar job ───────────────────────
  const finishJob = async () => {
    if (!currentJob || !user || uploading || currentJob.status !== 'IN_PROGRESS') return;
    const base64 = await pickPhotoForService('Evidencia de Finalización (Después)');
    if (!base64) return;

    setUploading(true);
    try {
      const evidencePhoto = await uploadServiceImage(currentJob.id, user.uid, base64, 'completion');

      await transitionServiceStatus(
        db,
        currentJob.id,
        'COMPLETED',
        { uid: user.uid, role: 'PROVIDER' },
        {
          fromStatus: 'IN_PROGRESS',
          notes: 'Evidencia fotográfica registrada y trabajo culminado',
          extraFields: {
            ...(evidencePhoto ? { evidence_photo: evidencePhoto, evidencePhoto } : {}),
            finished_at: serverTimestamp(),
            finishedAt: serverTimestamp(),
          },
        }
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Notificar al cliente
      const clientTokens = currentJob.notificationTokens?.client;
      if (clientTokens && clientTokens.length > 0) {
        const providerName = user?.displayName || 'El técnico';
        sendDemoPushNotification(
          clientTokens,
          'Trabajo culminado',
          `${providerName} ha completado el trabajo.`,
          {
            requestId: currentJob.id,
            screen: 'client_home',
            type: 'COMPLETED',
          },
          {
            requestId: currentJob.id,
            eventType: 'COMPLETED',
          }
        ).catch(() => {});
      }

      void notifyCentral(currentJob.id, 'Servicio por validar', 'El trabajador guardó la evidencia y terminó el servicio.', 'COMPLETED');
      Toast.show({ type: 'success', text1: 'Servicio completado', text2: 'Evidencia guardada. Esperando pago y validación.' });
    } catch (err: any) {
      console.error('Error guardando evidencia:', err);
      Alert.alert('No se finalizó el servicio', err.message || 'No se pudo guardar la evidencia. Intenta nuevamente.');
    } finally {
      setUploading(false);
    }
  };

  // ── Confirmar pago recibido ──────────────
  const handleConfirmPayment = async (requestId: string) => {
    if (!user || !requestId) return;
    setConfirmingPayment(true);
    try {
      await confirmProviderPayment(requestId, user.uid);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Toast.show({
        type: 'success',
        text1: '¡Pago confirmado!',
        text2: 'Has confirmado la recepción del pago del servicio.',
      });
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo confirmar el pago.');
    } finally {
      setConfirmingPayment(false);
    }
  };

  const handleDismissJob = () => {
    if (currentJob?.id) void releaseAfterJob(currentJob.id);
  };

  // ── Detención limpia de seguimiento y descarte de suscripciones ────────
  const stopAllTracking = async (targetUid?: string) => {
    locationWatcherRef.current?.remove();
    locationWatcherRef.current = null;
    publisherRef.current?.dispose();
    publisherRef.current = null;
    await stopBackgroundLocationUpdates();

    const uid = targetUid || user?.uid;
    if (uid) {
      // En paralelo y con tope: sin red, las escrituras de Firestore no resuelven y no deben bloquear el cierre.
      await withTimeout(Promise.allSettled([
        updateDoc(doc(db, 'users', uid), { is_active: false }),
        setDoc(doc(db, 'provider_presence', uid), {
          status: 'OFFLINE',
          updatedAt: serverTimestamp(),
          lastSeenAt: serverTimestamp(),
        }, { merge: true }),
      ]), 1200).catch(() => console.warn('No se confirmó el estado desconectado; se sincronizará al recuperar la red.'));
    }
  };

  const availabilityKey = (uid: string) => `provider-available:${uid}`;
  const resumedRef = useRef(false);

  /**
   * Conecta al técnico: permisos, ubicación, presencia y seguimiento. Con interactive=false (reanudación
   * al abrir la app) nunca muestra diálogos ni pide permisos: si falta algo, simplemente no conecta.
   */
  const goOnline = async (interactive: boolean): Promise<boolean> => {
    if (!user) return false;
    if (interactive && FEATURE_FLAGS.ENABLE_BACKGROUND_LOCATION_CONSENT && Platform.OS !== 'web' && !bgConsent.hasConsent) {
      await bgConsent.requestConsentAndPermissions();
    }

    const { status } = interactive
      ? await Location.requestForegroundPermissionsAsync()
      : await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      if (interactive) Alert.alert('Permiso Requerido', 'Debes otorgar permisos de ubicación para recibir servicios en tu zona.');
      return false;
    }

    try {
      const providerStatus = await Location.getProviderStatusAsync();
      if (!providerStatus.locationServicesEnabled) {
        if (Platform.OS === 'android' && interactive) {
          try {
            await Location.enableNetworkProviderAsync();
          } catch {
            if (interactive) Alert.alert('GPS Desactivado', 'Debes activar los servicios de ubicación (GPS) para recibir solicitudes.');
            return false;
          }
        } else {
          if (interactive) Alert.alert('GPS Desactivado', 'Por favor activa el GPS en los ajustes de tu dispositivo para poder conectarte.');
          return false;
        }
      }
    } catch (provErr) {
      console.warn('No se pudo verificar el estado del proveedor de ubicación:', provErr);
    }

    const locationData = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const coords = locationData.coords;

    setLocation({
      latitude: coords.latitude,
      longitude: coords.longitude,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    });

    const hash = geofire.geohashForLocation([coords.latitude, coords.longitude]);

    await updateDoc(doc(db, 'users', user.uid), {
      is_active: true,
      specialty,
      service_radius_km: serviceRadius,
      current_location: new GeoPoint(coords.latitude, coords.longitude),
      geohash: hash,
    });

    if (FEATURE_FLAGS.ENABLE_PROVIDER_PRESENCE) {
      // 1. Publicar de inmediato la ubicación actual en provider_presence
      await updateProviderPresence(db, {
        providerId: user.uid,
        providerName: providerName || 'Técnico',
        providerPhone: profile?.phone || '',
        status: currentJobRef.current ? 'BUSY' : 'AVAILABLE',
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        specialties: specialty ? [specialty] : ['General'],
        activeRequestId: currentJobRef.current?.id || null,
      }).catch((err) => console.warn('Error al actualizar provider_presence inmediata:', err));

      // 2. Instanciar publicador adaptativo (Heartbeat quieto cada 45s, movimiento cada 15s si >= 25m)
      publisherRef.current = createAdaptivePresencePublisher(
        async (c) => {
          if (!auth.currentUser || auth.currentUser.uid !== user.uid) return;
          await updateProviderPresence(db, {
            providerId: user.uid,
            providerName: providerName || 'Técnico',
            providerPhone: profile?.phone || '',
            status: currentJobRef.current ? 'BUSY' : 'AVAILABLE',
            latitude: c.latitude,
            longitude: c.longitude,
            accuracy: c.accuracy,
            specialties: specialty ? [specialty] : ['General'],
            activeRequestId: currentJobRef.current?.id || null,
          });
        },
        {
          stationaryIntervalMs: 45000,
          motionIntervalMs: 15000,
          motionThresholdMeters: 25,
        }
      );

      // 3. Suscripción en primer plano con watchPositionAsync
      locationWatcherRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000,
          distanceInterval: 15,
        },
        (sample) => {
          setLocation({
            latitude: sample.coords.latitude,
            longitude: sample.coords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          });
          publisherRef.current?.onLocationSample(sample.coords);
        }
      );

      // 4. Iniciar seguimiento en segundo plano con control de Expo Go
      if (FEATURE_FLAGS.ENABLE_BACKGROUND_LOCATION_CONSENT && Platform.OS !== 'web' && bgConsent.hasConsent) {
        const bgRes = await startBackgroundLocationUpdates({
          providerId: user.uid,
          providerName: providerName || 'Técnico',
          providerPhone: profile?.phone || '',
          specialties: specialty ? [specialty] : ['General'],
          activeRequestId: currentJobRef.current?.id || null,
        });
        if (bgRes.isExpoGo) {
          Toast.show({
            type: 'info',
            text1: 'Modo Expo Go',
            text2: 'Seguimiento en primer plano activo. Background requiere build nativo/APK.',
          });
        }
      }
    }

    void AsyncStorage.setItem(availabilityKey(user.uid), 'true').catch(() => {});
    if (interactive) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Toast.show({ type: 'success', text1: interactive ? '¡Disponible!' : 'Disponibilidad restablecida', text2: interactive ? 'La central ya puede asignarte servicios cercanos.' : 'Sigues conectado: la central puede asignarte servicios cercanos.' });
    return true;
  };

  // Al iniciar sesión o reabrir la app, restablece la disponibilidad si el técnico estaba conectado.
  // Sin diálogos: si faltan permisos o GPS, se deja desconectado de forma coherente en Firestore.
  useEffect(() => { resumedRef.current = false; }, [user?.uid]);
  useEffect(() => {
    if (!user || loading || !isVerified || !specialty.trim() || resumedRef.current) return;
    resumedRef.current = true;
    void (async () => {
      const wanted = await AsyncStorage.getItem(availabilityKey(user.uid)).catch(() => null);
      if (publisherRef.current || auth.currentUser?.uid !== user.uid) return;
      if (wanted !== 'true' && !isActive) return;
      setIsActive(true);
      const connected = await goOnline(false).catch(() => false);
      if (!connected && auth.currentUser?.uid === user.uid) {
        setIsActive(false);
        await stopAllTracking(user.uid);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, loading, isVerified, specialty]);

  // ── Disponibilidad automática al terminar un trabajo ────────────────────
  useEffect(() => { currentJobRef.current = currentJob; }, [currentJob]);
  useEffect(() => { dismissedCompletedRef.current = dismissedCompletedId; }, [dismissedCompletedId]);

  /** Apaga la disponibilidad a petición del técnico (botón "Descansar"). */
  const pauseAvailability = async () => {
    if (!user) return;
    setIsActive(false);
    await stopAllTracking(user.uid);
    void AsyncStorage.setItem(availabilityKey(user.uid), 'false').catch(() => {});
    Toast.show({ type: 'info', text1: 'Desconectado', text2: 'Ya no recibirás solicitudes.' });
  };

  /**
   * Cierra el servicio terminado y deja al técnico disponible otra vez, solo si lo estaba antes.
   * Si apagó su disponibilidad a propósito, no se reactiva.
   */
  const releaseAfterJob = async (jobId: string) => {
    if (!user || currentJobRef.current?.id !== jobId) return;
    dismissedCompletedRef.current = jobId;
    currentJobRef.current = null;
    setDismissedCompletedId(jobId);
    setCurrentJob(null);

    const stored = await AsyncStorage.getItem(availabilityKey(user.uid)).catch(() => null);
    if (!(isActive || stored === 'true')) return;

    if (!publisherRef.current) {
      setIsActive(true);
      const connected = await goOnline(false).catch(() => false);
      if (!connected) {
        setIsActive(false);
        await stopAllTracking(user.uid);
        return;
      }
    } else if (location) {
      await updateProviderPresence(db, {
        providerId: user.uid,
        providerName: providerName || 'Técnico',
        providerPhone: profile?.phone || '',
        status: 'AVAILABLE',
        latitude: location.latitude,
        longitude: location.longitude,
        specialties: specialty ? [specialty] : ['General'],
        activeRequestId: null,
      }).catch((err) => console.warn('No se pudo marcar disponibilidad tras el servicio:', err));
    }
    Toast.show({
      type: 'success',
      text1: 'Ya estás disponible',
      text2: 'La central puede asignarte otro servicio. Toca aquí si prefieres descansar.',
      visibilityTime: 7000,
      onPress: () => { Toast.hide(); void pauseAvailability(); },
    });
  };

  // Cobro confirmado: tras una breve pausa para ver el resultado, el técnico vuelve a estar disponible.
  useEffect(() => {
    if (!user || !currentJob || currentJob.status !== 'COMPLETED' || currentJob.paymentStatus !== 'CONFIRMED') return;
    const jobId = currentJob.id;
    const timer = setTimeout(() => { void releaseAfterJob(jobId); }, 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, currentJob?.id, currentJob?.status, currentJob?.paymentStatus]);

  // El seguimiento en segundo plano debe reportar BUSY/AVAILABLE según el servicio actual.
  useEffect(() => {
    if (!user || !isActive || Platform.OS === 'web' || !bgConsent.hasConsent) return;
    void setBackgroundTrackingContext({
      providerId: user.uid,
      providerName: providerName || 'Técnico',
      providerPhone: profile?.phone || '',
      specialties: specialty ? [specialty] : ['General'],
      activeRequestId: currentJob?.id || null,
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, isActive, currentJob?.id, bgConsent.hasConsent]);

  // ── Toggle online/offline ───────────────
  const toggleSwitch = async () => {
    if (!user) return;
    if (!isVerified) {
      Alert.alert('Validación pendiente', 'La central debe revisar y aprobar tu perfil antes de habilitarte para recibir servicios.');
      return;
    }
    if (!isActive && !specialty.trim()) {
      Alert.alert('Faltan datos', 'Ingresa tu especialidad antes de conectarte.');
      return;
    }

    // Animación al presionar
    Animated.sequence([
      Animated.timing(toggleScale, { toValue: 0.92, duration: 100, useNativeDriver: true }),
      Animated.timing(toggleScale, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    const newState = !isActive;
    setIsActive(newState);

    try {
      if (newState) {
        const connected = await goOnline(true);
        if (!connected) setIsActive(false);
      } else {
        await stopAllTracking(user.uid);
        void AsyncStorage.setItem(availabilityKey(user.uid), 'false').catch(() => {});
        Toast.show({ type: 'info', text1: 'Desconectado', text2: 'Ya no recibirás solicitudes.' });
      }
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      setIsActive(!newState);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          try {
            await stopAllTracking(user?.uid);
            await signOutWithNotifications();
          } catch {
            Alert.alert('No se pudo cerrar sesión', 'Vuelve a intentar.');
            return;
          }
          resetToLogin(router);
        },
      },
    ]);
  };

  // ── Loading ─────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <HomeSkeleton />
        <TouchableOpacity onPress={() => router.push('/profile')} style={{ padding: 16 }}><Text style={{ color: colors.primary }}>Abrir mi perfil</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      {profileError || requestError ? (
        <View style={{ padding: 12, paddingTop: 40, backgroundColor: colors.card }}>
          <Text style={{ color: colors.text }}>{profileError || requestError}</Text>
          <TouchableOpacity onPress={() => { retry(); setRequestAttempt((value) => value + 1); }} style={{ paddingVertical: 10 }}>
            <Text style={{ color: colors.primary }}>Volver a intentar</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <ProviderDashboard
        {...{
          currentJob,
          incomingRequest,
          location,
          providerName,
          specialty,
          totalRating,
          jobsCompleted,
          isVerified,
          isActive,
          inputPin,
          setInputPin,
          validateArrivalPin,
          validatePin: validateArrivalPin,
          startJob,
          verifyingPin,
          finishJob,
          uploading,
          takeInitialPhoto,
          uploadingInitial,
          cancelJobAsProvider,
          cancelling,
          acceptJob,
          accepting,
          rejectJob,
          toggleSwitch,
          setSpecialty,
          serviceRadius,
          setServiceRadius,
          handleLogout,
          confirmPayment: handleConfirmPayment,
          confirmingPayment,
          dismissJob: handleDismissJob,
          lockoutSeconds,
        }}
        isOnline={isOnline}
        offlinePhotosCount={offlinePhotosCount}
        onError={(message: string) => Alert.alert('Aviso', message)}
      />
      <TechnicianRejectModal
        visible={rejectionModalVisible}
        onClose={() => setRejectionModalVisible(false)}
        onConfirm={handleConfirmRejection}
        loading={submittingRejection}
      />
    </View>
  );
}
const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
