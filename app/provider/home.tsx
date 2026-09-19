import { signOutWithNotifications } from '../../utils/pushNotifications';
import { notifyCentral } from '../../src/services/centralNotifications';
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
  updateDoc, runTransaction,
  where,
} from 'firebase/firestore';
import * as geofire from 'geofire-common';
import { ProviderDashboard } from '../../src/components/ProviderDashboard';
import { auth, db } from '../../src/config/firebase';
import { useTheme } from '../../src/context/ThemeContext';
import { useSession } from '../../src/context/SessionContext';
import { transitionServiceStatus } from '../../src/domain/serviceRequestTransition';
import { uploadServiceImage } from '../../src/services/mediaStorage';
import { queueDemoPushNotification as sendDemoPushNotification } from '../../src/services/demoPushService';
import { confirmProviderPayment } from '../../src/services/payment';


// ─────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────
export default function ProviderHome() {
  const router = useRouter();
  const { colors } = useTheme();

  const { user, profile, loading, error: profileError, retry } = useSession();
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
  const [pinAttempts, setPinAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const isAcceptingRef = useRef(false);

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
      if (activeJob && activeJob.status === 'COMPLETED' && activeJob.id === dismissedCompletedId) {
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
          'Técnico en camino 🚀',
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

  // ── Rechazar trabajo ────────────────────
  const rejectJob = async () => {
    if (!incomingRequest || !user) return;
    Alert.alert(
      'Rechazar solicitud',
      '¿Estás seguro de rechazar esta solicitud?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, rechazar',
          style: 'destructive',
          onPress: async () => {
            try {
              await transitionServiceStatus(
                db,
                incomingRequest.id,
                'REQUIRES_REASSIGNMENT',
                { uid: user.uid, role: 'PROVIDER' },
                {
                  fromStatus: 'PENDING',
                  notes: 'Técnico rechazó la asignación',
                  extraFields: {
                    rejectedProviderIds: arrayUnion(user.uid),
                    rejectionReason: 'TECHNICIAN_UNAVAILABLE',
                    rejectedAt: serverTimestamp(),
                  },
                }
              );

              setIncomingRequest(null);
              void notifyCentral(incomingRequest.id, 'Servicio requiere reasignación', 'Un trabajador devolvió su asignación. Revisa la bandeja.', 'REQUIRES_REASSIGNMENT');
              Toast.show({ type: 'info', text1: 'Solicitud devuelta a la central' });
            } catch {
              Alert.alert('Error', 'No se pudo rechazar');
            }
          },
        },
      ]
    );
  };

  // ── Cancelar job en ruta ────────────────
  const cancelJobAsProvider = async () => {
    if (!currentJob || !user) return;
    Alert.alert(
      'Solicitar reasignación',
      'La central buscará otro trabajador y el cliente será notificado.',
      [
        { text: 'No, seguir en camino', style: 'cancel' },
        {
          text: 'Sí, abortar',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              const clientTokens = currentJob.notificationTokens?.client;
              await transitionServiceStatus(
                db,
                currentJob.id,
                'REQUIRES_REASSIGNMENT',
                { uid: user.uid, role: 'PROVIDER' },
                {
                  fromStatus: currentJob.status,
                  notes: 'Técnico abortó la atención en camino',
                  extraFields: {
                    serviceStarted: false,
                    rejectedProviderIds: arrayUnion(user.uid),
                    rejectionReason: 'TECHNICIAN_UNAVAILABLE',
                    rejectedAt: serverTimestamp(),
                  },
                }
              );

              if (clientTokens && clientTokens.length > 0) {
                sendDemoPushNotification(
                  clientTokens,
                  'Solicitud Rechazada 😔',
                  'El técnico no está disponible. Por favor contacta a la central.',
                  {
                    requestId: currentJob.id,
                    screen: 'client_home',
                    type: 'CANCELLED_BY_PROVIDER',
                  },
                  {
                    requestId: currentJob.id,
                    eventType: 'CANCELLED_BY_PROVIDER',
                  }
                ).catch(() => {});
              }

              void notifyCentral(currentJob.id, 'Servicio requiere reasignación', 'El trabajador no puede continuar. Revisa la bandeja.', 'REQUIRES_REASSIGNMENT');
              Alert.alert('Solicitud devuelta', 'La central podrá reasignar el servicio.');
              setCurrentJob(null);
            } catch {
              Alert.alert('Error', 'No se pudo cancelar el servicio.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  // ── Validar PIN de Inicio Presencial (HU-18: Límite de 3 intentos y bloqueo) ──
  const validatePin = async () => {
    Keyboard.dismiss();
    if (!currentJob || !user) return;
    if (lockoutSeconds > 0) {
      Alert.alert(
        'Ingreso Temporalmente Bloqueado 🔒',
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
          'Límite de Intentos Superado 🔒',
          'Has ingresado un PIN incorrecto 3 veces consecutivas. Por seguridad se bloqueó el ingreso por 60 segundos y se alertó a la central.'
        );
      } else {
        const remaining = 3 - nextAttempts;
        Alert.alert(
          'PIN Incorrecto ❌',
          `El código no coincide. Te quedan ${remaining} ${remaining === 1 ? 'intento' : 'intentos'} antes del bloqueo temporal.`
        );
      }
      return;
    }
    setVerifyingPin(true);
    try {
      await transitionServiceStatus(
        db,
        currentJob.id,
        'IN_PROGRESS',
        { uid: user.uid, role: 'PROVIDER' },
        {
          fromStatus: 'ACCEPTED',
          notes: 'Inicio presencial verificado mediante validación de PIN',
          extraFields: {
            serviceStarted: true,
            pinValidatedAt: serverTimestamp(),
            startedAt: serverTimestamp(),
          },
        }
      );
      setPinAttempts(0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: '¡PIN VALIDADO! 🚀', text2: 'Inicio presencial verificado.' });

      // Notificar al cliente
      const clientTokens = currentJob.notificationTokens?.client;
      if (clientTokens && clientTokens.length > 0) {
        const providerName = user?.displayName || 'El técnico';
        sendDemoPushNotification(
          clientTokens,
          'Servicio iniciado 🛠️',
          `${providerName} validó el PIN e inició el trabajo.`,
          {
            requestId: currentJob.id,
            screen: 'client_home',
            type: 'IN_PROGRESS',
          },
          {
            requestId: currentJob.id,
            eventType: 'IN_PROGRESS',
          }
        ).catch(() => {});
      }

      setInputPin('');
    } catch (err) {
      console.error('Error validando PIN:', err);
      Alert.alert('Error', 'No se pudo iniciar el servicio.');
    } finally {
      setVerifyingPin(false);
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
          text1: 'Foto inicial guardada 📸',
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
          'Trabajo culminado 🎉',
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
    if (currentJob?.id) {
      setDismissedCompletedId(currentJob.id);
      setCurrentJob(null);
    }
  };

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
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permiso Requerido', 'Debes otorgar permisos de ubicación para recibir servicios en tu zona.');
          setIsActive(false);
          return;
        }

        try {
          const providerStatus = await Location.getProviderStatusAsync();
          if (!providerStatus.locationServicesEnabled) {
            if (Platform.OS === 'android') {
              try {
                await Location.enableNetworkProviderAsync();
              } catch {
                Alert.alert('GPS Desactivado', 'Debes activar los servicios de ubicación (GPS) para recibir solicitudes.');
                setIsActive(false);
                return;
              }
            } else {
              Alert.alert('GPS Desactivado', 'Por favor activa el GPS en los ajustes de tu dispositivo para poder conectarte.');
              setIsActive(false);
              return;
            }
          }
        } catch (provErr) {
          console.warn('No se pudo verificar el estado del proveedor de ubicación:', provErr);
        }

        const locationData = await Location.getCurrentPositionAsync({});
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

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({ type: 'success', text1: '¡Disponible!', text2: 'La central ya puede asignarte servicios cercanos.' });
      } else {
        await updateDoc(doc(db, 'users', user.uid), { is_active: false });
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
          try { await signOutWithNotifications(); } catch { Alert.alert('No se pudo cerrar sesión', 'Vuelve a intentar.'); return; }
          router.replace('/auth/login');
        },
      },
    ]);
  };

  // ── Loading ─────────────────────────────
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <TouchableOpacity onPress={() => router.push('/profile')} style={{ padding: 16 }}><Text style={{ color: colors.primary }}>Abrir mi perfil</Text></TouchableOpacity>
      </View>
    );
  }

  return <View style={{ flex: 1 }}>{profileError || requestError ? <View style={{ padding: 12, paddingTop: 40, backgroundColor: colors.card }}><Text style={{ color: colors.text }}>{profileError || requestError}</Text><TouchableOpacity onPress={() => { retry(); setRequestAttempt((value) => value + 1); }} style={{ paddingVertical: 10 }}><Text style={{ color: colors.primary }}>Volver a intentar</Text></TouchableOpacity></View> : null}<ProviderDashboard {...{ currentJob, incomingRequest, location, providerName, specialty, totalRating, jobsCompleted, isVerified, isActive, inputPin, setInputPin, validatePin, verifyingPin, finishJob, uploading, takeInitialPhoto, uploadingInitial, cancelJobAsProvider, cancelling, acceptJob, accepting, rejectJob, toggleSwitch, setSpecialty, serviceRadius, setServiceRadius, handleLogout, confirmPayment: handleConfirmPayment, confirmingPayment, dismissJob: handleDismissJob, lockoutSeconds }} onError={(message: string) => Alert.alert('Aviso', message)} /></View>;
}
const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
