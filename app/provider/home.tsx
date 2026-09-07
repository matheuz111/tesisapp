import CustomAlert, { useCustomAlert } from '../../components/CustomAlert';
import { signOutWithNotifications } from '../../utils/pushNotifications';
import { notifyCentral } from '../../src/services/centralNotifications';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
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
import { uploadServiceImage } from '../../src/services/mediaStorage';
import { queueDemoPushNotification as sendDemoPushNotification } from '../../src/services/demoPushService';
import { confirmProviderPayment } from '../../src/services/payment';


// ─────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────
export default function ProviderHome() {
  const router = useRouter();
  const { colors } = useTheme();
  const { alertProps, showAlert } = useCustomAlert();

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
  const [cancelling, setCancelling] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [inputPin, setInputPin] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [dismissedCompletedId, setDismissedCompletedId] = useState<string | null>(null);
  const isAcceptingRef = useRef(false);

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
    if (!incomingRequest || accepting) return;
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
      showAlert({ title: 'Error', message: 'No se pudo aceptar el trabajo.', type: 'error' });
    } finally {
      setAccepting(false);
    }
  };

  // ── Rechazar trabajo ────────────────────
  const rejectJob = async () => {
    if (!incomingRequest || !user) return;
    showAlert({
      title: 'Rechazar solicitud',
      message: '¿Estás seguro de rechazar esta solicitud?',
      type: 'confirm',
      buttons: [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, rechazar',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'service_requests', incomingRequest.id), {
                status: 'REQUIRES_REASSIGNMENT',
                rejectedProviderIds: arrayUnion(user.uid),
                rejectionReason: 'TECHNICIAN_UNAVAILABLE',
                rejectedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });

              setIncomingRequest(null);
              void notifyCentral(incomingRequest.id, 'Servicio requiere reasignación', 'Un trabajador devolvió su asignación. Revisa la bandeja.', 'REQUIRES_REASSIGNMENT');
              Toast.show({ type: 'info', text1: 'Solicitud devuelta a la central' });
            } catch {
              showAlert({ title: 'Error', message: 'No se pudo rechazar la solicitud.', type: 'error' });
            }
          },
        },
      ],
    });
  };

  // ── Cancelar job en ruta ────────────────
  const cancelJobAsProvider = async () => {
    if (!currentJob || !user) return;
    showAlert({
      title: 'Solicitar reasignación',
      message: 'La central buscará otro trabajador y el cliente será notificado.',
      type: 'confirm',
      buttons: [
        { text: 'No, seguir en camino', style: 'cancel' },
        {
          text: 'Sí, abortar',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              const clientTokens = currentJob.notificationTokens?.client;
              await updateDoc(doc(db, 'service_requests', currentJob.id), {
                status: 'REQUIRES_REASSIGNMENT',
                serviceStarted: false,
                rejectedProviderIds: arrayUnion(user.uid),
                rejectionReason: 'TECHNICIAN_UNAVAILABLE',
                rejectedAt: serverTimestamp(), updatedAt: serverTimestamp(),
              });

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
              showAlert({ title: 'Solicitud devuelta', message: 'La central podrá reasignar el servicio.', type: 'info' });
              setCurrentJob(null);
            } catch {
              showAlert({ title: 'Error', message: 'No se pudo cancelar el servicio.', type: 'error' });
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    });
  };

  // ── Validar PIN de Inicio Presencial ──
  const validatePin = async () => {
    Keyboard.dismiss();
    if (!currentJob) return;
    const cleanPin = inputPin.trim();
    if (!cleanPin) {
      showAlert({ title: 'PIN Requerido', message: 'Ingresa el código de 4 dígitos que aparece en la pantalla del cliente.', type: 'warning' });
      return;
    }
    if (cleanPin !== currentJob.securityPin) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert({
        title: 'PIN Incorrecto ❌',
        message: 'El código ingresado no coincide con el del cliente. Por favor solicítale que revise su pantalla e inténtalo de nuevo.',
        type: 'error',
      });
      return;
    }
    setVerifyingPin(true);
    try {
      await updateDoc(doc(db, 'service_requests', currentJob.id), {
        serviceStarted: true,
        status: 'IN_PROGRESS',
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
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
      showAlert({ title: 'Error', message: 'No se pudo iniciar el servicio.', type: 'error' });
    } finally {
      setVerifyingPin(false);
    }
  };

  // ── Finalizar job ───────────────────────
  const finishJob = async () => {
    if (!currentJob || !user || uploading || currentJob.status !== 'IN_PROGRESS') return;
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      showAlert({ title: 'Permiso denegado', message: 'Necesitas conceder permiso a la cámara para tomar la foto de evidencia.', type: 'warning' });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.15,
      base64: true,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      if (!asset.base64) {
        showAlert({ title: 'Error', message: 'No se pudo procesar la imagen capturada.', type: 'error' });
        return;
      }

      setUploading(true);
      try {
        const evidencePhoto = await uploadServiceImage(currentJob.id, user.uid, asset.base64, 'completion');

        await updateDoc(doc(db, 'service_requests', currentJob.id), {
          status: 'COMPLETED',
          ...(evidencePhoto ? { evidence_photo: evidencePhoto } : {}),
          finished_at: serverTimestamp(),
        });
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
        showAlert({ title: 'No se finalizó el servicio', message: err.message || 'No se pudo guardar la evidencia. Intenta nuevamente.', type: 'error' });
      } finally {
        setUploading(false);
      }
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
      showAlert({ title: 'Error', message: error?.message || 'No se pudo confirmar el pago.', type: 'error' });
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
      showAlert({ title: 'Validación pendiente', message: 'La central debe revisar y aprobar tu perfil antes de habilitarte para recibir servicios.', type: 'warning' });
      return;
    }
    if (!isActive && !specialty.trim()) {
      showAlert({ title: 'Faltan datos', message: 'Ingresa tu especialidad antes de conectarte.', type: 'warning' });
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
          setIsActive(false);
          return;
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
    showAlert({
      title: 'Cerrar Sesión',
      message: '¿Estás seguro de que quieres cerrar sesión?',
      type: 'confirm',
      buttons: [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            try { await signOutWithNotifications(); } catch {
              showAlert({ title: 'No se pudo cerrar sesión', message: 'Vuelve a intentar.', type: 'error' });
              return;
            }
            router.replace('/auth/login');
          },
        },
      ],
    });
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

  return (
    <View style={{ flex: 1 }}>
      {profileError || requestError ? (
        <View style={{ padding: 12, paddingTop: 40, backgroundColor: colors.card }}>
          <Text style={{ color: colors.text }}>{profileError || requestError}</Text>
          <TouchableOpacity onPress={() => { retry(); setRequestAttempt((value) => value + 1); }} style={{ paddingVertical: 10 }}>
            <Text style={{ color: colors.primary }}>Volver a intentar</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <ProviderDashboard
        {...{ currentJob, incomingRequest, location, providerName, specialty, totalRating, jobsCompleted, isVerified, isActive, inputPin, setInputPin, validatePin, verifyingPin, finishJob, uploading, cancelJobAsProvider, cancelling, acceptJob, accepting, rejectJob, toggleSwitch, setSpecialty, serviceRadius, setServiceRadius, handleLogout, confirmPayment: handleConfirmPayment, confirmingPayment, dismissJob: handleDismissJob }}
        onError={(message: string) => showAlert({ title: 'Aviso', message, type: 'warning' })}
      />
      <CustomAlert {...alertProps} />
    </View>
  );
}
const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
