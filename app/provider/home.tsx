import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import Toast from 'react-native-toast-message';

import * as Haptics from 'expo-haptics';
import { onAuthStateChanged } from 'firebase/auth';
import {
  GeoPoint,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import * as geofire from 'geofire-common';
import { getDistance } from 'geolib';
import { auth, db } from '../../src/config/firebase';
import { useTheme } from '../../src/context/ThemeContext';

import { registerForPushNotificationsAsync, sendPushNotification } from '../../utils/pushNotifications';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function getGreeting(): { text: string; emoji: string } {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Buenos días', emoji: '☀️' };
  if (h < 18) return { text: 'Buenas tardes', emoji: '🌤️' };
  return { text: 'Buenas noches', emoji: '🌙' };
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// ─────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────
export default function ProviderHome() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';

  const [user, setUser] = useState(auth.currentUser);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [specialty, setSpecialty] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState<any>(null);
  const [providerName, setProviderName] = useState('');

  // Gamification
  const [totalRating, setTotalRating] = useState('0.0');
  const [reviewCount, setReviewCount] = useState(0);
  const [jobsCompleted, setJobsCompleted] = useState(0);
  const [serviceRadius, setServiceRadius] = useState(10);

  const [incomingRequest, setIncomingRequest] = useState<any>(null);
  const [currentJob, setCurrentJob] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [accepting, setAccepting] = useState(false);

  // Animación del toggle
  const [toggleScale] = useState(new Animated.Value(1));

  const greeting = useMemo(() => getGreeting(), []);

  // ── Push notifications ──────────────────
  const [pushToken, setPushToken] = useState<string | null>(null);
  useEffect(() => {
    if (user) {
      registerForPushNotificationsAsync(user.uid).then(t => {
        if (t) setPushToken(t);
      });
    }
  }, [user]);

  // ── Diagnóstico de push (long press en el emoji) ──────
  const runPushDiagnostic = async () => {
    if (!pushToken) {
      Alert.alert('Sin token', 'No hay Expo Push Token registrado. Revisa los permisos de notificación.');
      return;
    }
    // Copiar token al portapapeles
    await Clipboard.setStringAsync(pushToken);

    // Hacer una llamada de prueba a la misma API que usa la app
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          to: pushToken,
          title: '✅ TEST - Notificación de prueba',
          body: 'Si ves esto con la app cerrada, ¡está funcionando!',
          sound: 'default',
          priority: 'high',
          channelId: 'default',
          ttl: 60,
        }),
      });
      const result = await res.json();
      const status = result?.data?.status || JSON.stringify(result);
      const details = result?.data?.details ? `\n\nDetalles: ${JSON.stringify(result.data.details)}` : '';
      Alert.alert(
        `Expo API: ${status}`,
        `Token (copiado al portapapeles):\n${pushToken.substring(0, 45)}...${details}\n\n▶ Cierra la app AHORA y espera la notificación de prueba.`
      );
    } catch (e: any) {
      Alert.alert('Error de red', e.message);
    }
  };

  // ── Cargar perfil ───────────────────────
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSpecialty(data.specialty || '');
          setPrice(data.price_range || '');
          setIsActive(data.is_active || false);
          setProviderName(data.name || data.displayName || user.email?.split('@')[0] || '');
          if (data.current_location) {
            setLocation({
              latitude: data.current_location.latitude,
              longitude: data.current_location.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            });
          }
          if (data.review_count > 0) {
            setTotalRating((data.total_rating / data.review_count).toFixed(1));
            setReviewCount(data.review_count);
          }
          setJobsCompleted(data.jobs_completed || 0);
          setServiceRadius(data.service_radius_km || 10);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [user]);

  // ── Escuchar solicitudes PENDING ────────
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'service_requests'),
      where('providerId', '==', user.uid),
      where('status', '==', 'PENDING')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        const reqData = docs[0];

        setIncomingRequest((prev: any) => {
          if (!prev || prev.id !== reqData.id) {
            Vibration.vibrate([0, 500, 200, 500, 200, 500]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Toast.show({
              type: 'success',
              text1: '¡NUEVA SOLICITUD! 🔔',
              text2: `${reqData.clientName || 'Un cliente'} te necesita.`,
              visibilityTime: 6000,
            });
          }
          return reqData;
        });
      } else {
        setIncomingRequest((prev: any) => {
          if (prev) {
            Alert.alert('Aviso', 'El cliente ha cancelado la solicitud o ya no está disponible.');
          }
          return null;
        });
      }
    });
    return () => unsub();
  }, [user]);

  // ── Escuchar job ACCEPTED ───────────────
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'service_requests'),
      where('providerId', '==', user.uid),
      where('status', '==', 'ACCEPTED')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setCurrentJob(docs[0]);
      } else {
        setCurrentJob(null);
      }
    });
    return () => unsub();
  }, [user]);

  // ── Aceptar trabajo ─────────────────────
  const acceptJob = async () => {
    if (!incomingRequest || accepting) return;
    setAccepting(true);
    try {
      await updateDoc(doc(db, 'service_requests', incomingRequest.id), { status: 'ACCEPTED' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: '¡Trabajo Aceptado!', text2: 'Iniciando navegación...' });

      const clientDoc = await getDoc(doc(db, 'users', incomingRequest.clientId));
      if (clientDoc.exists() && clientDoc.data().expoPushToken) {
        await sendPushNotification(
          clientDoc.data().expoPushToken,
          '¡TÉCNICO EN CAMINO! 🚀',
          `${providerName || 'El técnico'} ha aceptado tu solicitud.`
        );
      }
      setIncomingRequest(null);
    } catch {
      Alert.alert('Error', 'No se pudo aceptar');
    } finally {
      setAccepting(false);
    }
  };

  // ── Rechazar trabajo ────────────────────
  const rejectJob = async () => {
    if (!incomingRequest) return;
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
              await updateDoc(doc(db, 'service_requests', incomingRequest.id), {
                status: 'CANCELLED_BY_PROVIDER',
                cancelledAt: serverTimestamp(),
              });

              const clientDoc = await getDoc(doc(db, 'users', incomingRequest.clientId));
              if (clientDoc.exists() && clientDoc.data().expoPushToken) {
                await sendPushNotification(
                  clientDoc.data().expoPushToken,
                  'Solicitud Rechazada',
                  'El técnico no está disponible en este momento. Intenta con otro profesional.'
                );
              }
              setIncomingRequest(null);
              Toast.show({ type: 'info', text1: 'Solicitud rechazada' });
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
    if (!currentJob) return;
    Alert.alert(
      'Abortar Servicio',
      '¿Estás seguro de cancelar? El cliente será notificado.',
      [
        { text: 'No, seguir en camino', style: 'cancel' },
        {
          text: 'Sí, abortar',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await updateDoc(doc(db, 'service_requests', currentJob.id), {
                status: 'CANCELLED_BY_PROVIDER',
                cancelledAt: serverTimestamp(),
              });

              const clientDoc = await getDoc(doc(db, 'users', currentJob.clientId));
              if (clientDoc.exists() && clientDoc.data().expoPushToken) {
                await sendPushNotification(
                  clientDoc.data().expoPushToken,
                  'Servicio Abortado ⚠️',
                  'El técnico tuvo un inconveniente. Por favor, solicita a otro profesional.'
                );
              }
              Alert.alert('Servicio Abortado', 'Se ha notificado al cliente.');
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

  // ── Finalizar job ───────────────────────
  const finishJob = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permiso denegado', 'Necesitas la cámara.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.2,
      base64: true,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets?.length) {
      setUploading(true);
      try {
        const base64Img = `data:image/jpeg;base64,${result.assets[0].base64}`;
        await updateDoc(doc(db, 'service_requests', currentJob.id), {
          status: 'COMPLETED',
          evidence_photo: base64Img,
          finished_at: serverTimestamp(),
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        const clientDoc = await getDoc(doc(db, 'users', currentJob.clientId));
        if (clientDoc.exists() && clientDoc.data().expoPushToken) {
          await sendPushNotification(
            clientDoc.data().expoPushToken,
            '¡Trabajo Culminado! 🎉',
            'El técnico ha completado el trabajo. Entra a calificar.'
          );
        }
        Toast.show({ type: 'success', text1: '¡Misión Cumplida! 🎉', text2: 'Evidencia guardada.' });
        setCurrentJob(null);
      } catch {
        Alert.alert('Error', 'Problema guardando la evidencia.');
      } finally {
        setUploading(false);
      }
    }
  };

  // ── Toggle online/offline ───────────────
  const toggleSwitch = async () => {
    if (!user) return;
    if (!isActive && (!specialty || !price)) {
      Alert.alert('Faltan datos', 'Ingresa tu especialidad y tarifa antes de conectarte.');
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
          price_range: price,
          service_radius_km: serviceRadius,
          current_location: new GeoPoint(coords.latitude, coords.longitude),
          geohash: hash,
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({ type: 'success', text1: '¡Conectado!', text2: 'Ya eres visible para clientes cercanos.' });
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
          await auth.signOut();
          router.replace('/');
        },
      },
    ]);
  };

  // ── Loading ─────────────────────────────
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ── Mapa style ──────────────────────────
  const mapStyle = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

  // ═══════════════════════════════════════
  // MODO EN-RUTA (con job aceptado)
  // ═══════════════════════════════════════
  if (currentJob) {
    const jobDistance =
      location && currentJob.location
        ? getDistance(
          { latitude: location.latitude, longitude: location.longitude },
          { latitude: currentJob.location.latitude, longitude: currentJob.location.longitude }
        )
        : null;

    return (
      <View style={[styles.containerFull, { backgroundColor: colors.background }]}>
        {location && currentJob.location ? (
          <MapView
            style={styles.mapAbsolute}
            initialRegion={{
              latitude: (location.latitude + currentJob.location.latitude) / 2,
              longitude: (location.longitude + currentJob.location.longitude) / 2,
              latitudeDelta: Math.abs(location.latitude - currentJob.location.latitude) * 2 + 0.01,
              longitudeDelta: Math.abs(location.longitude - currentJob.location.longitude) * 2 + 0.01,
            }}
          >
            <UrlTile urlTemplate={mapStyle} maximumZ={19} flipY={false} />
            <Marker coordinate={location} title="Tu ubicación" description="Estás aquí" pinColor="blue" />
            <Marker
              coordinate={{ latitude: currentJob.location.latitude, longitude: currentJob.location.longitude }}
              title={currentJob.clientName || 'Cliente'}
              description="Destino del servicio"
              pinColor="red"
            />
          </MapView>
        ) : (
          <View style={[styles.mapAbsolute, styles.center, { backgroundColor: colors.background }]}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        )}

        {/* PANEL FLOTANTE EN-RUTA */}
        <View style={[styles.floatingActionCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          <View style={styles.routeHeaderRow}>
            <View style={styles.routeHeaderLeft}>
              <Text style={[styles.routeLabel, { color: colors.primary }]}>📌 EN RUTA</Text>
              <Text style={[styles.routeClientName, { color: colors.text }]} numberOfLines={1}>
                {currentJob.clientName || 'Cliente'}
              </Text>
              {currentJob.serviceType && (
                <Text style={[styles.routeServiceType, { color: colors.subtext }]}>
                  {currentJob.serviceType}
                </Text>
              )}
            </View>
            {jobDistance !== null && (
              <View style={[styles.distanceBadge, { backgroundColor: isDark ? '#1a3a2a' : '#E8F5E9' }]}>
                <Ionicons name="navigate-outline" size={14} color={colors.success} />
                <Text style={[styles.distanceBadgeText, { color: colors.success }]}>
                  {formatDistance(jobDistance)}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.routeActionsContainer}>
            <TouchableOpacity
              style={[styles.circleBtn, { backgroundColor: '#111' }]}
              onPress={() => {
                const lat = currentJob.location.latitude;
                const lng = currentJob.location.longitude;
                const url = Platform.OS === 'ios'
                  ? `maps://app?daddr=${lat},${lng}`
                  : `google.navigation:q=${lat},${lng}`;
                Linking.openURL(url).catch(() =>
                  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`)
                );
              }}
              accessibilityLabel="Abrir GPS"
            >
              <Ionicons name="navigate" size={22} color="#fff" />
              <Text style={styles.circleBtnLabel}>GPS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.circleBtn, { backgroundColor: colors.success }]}
              onPress={() => router.push({ pathname: '/chat/[id]', params: { id: currentJob.id } })}
              accessibilityLabel="Abrir chat"
            >
              <Ionicons name="chatbubble-ellipses" size={22} color="#fff" />
              <Text style={styles.circleBtnLabel}>Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.circleBtn, { backgroundColor: colors.danger }]}
              onPress={cancelJobAsProvider}
              disabled={cancelling}
              accessibilityLabel="Cancelar servicio"
            >
              {cancelling ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="close-circle" size={22} color="#fff" />
              )}
              <Text style={styles.circleBtnLabel}>Cancelar</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.finishBtn, { backgroundColor: colors.primary }, uploading && styles.disabledButton]}
            onPress={finishJob}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="camera" size={22} color="#fff" style={{ marginRight: 10 }} />
                <Text style={styles.finishBtnText}>CAPTURAR EVIDENCIA Y COMPLETAR</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ═══════════════════════════════════════
  // DASHBOARD PRINCIPAL
  // ═══════════════════════════════════════
  const radarDistance =
    incomingRequest && location && incomingRequest.location
      ? getDistance(
        { latitude: location.latitude, longitude: location.longitude },
        { latitude: incomingRequest.location.latitude, longitude: incomingRequest.location.longitude }
      )
      : null;

  return (
    <View style={[styles.containerFull, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.containerDashboard} showsVerticalScrollIndicator={false}>
        {/* ═══ HEADER CON SALUDO ═══ */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
          <TouchableOpacity onLongPress={runPushDiagnostic} delayLongPress={800} activeOpacity={1}>
            <Text style={[styles.greetingEmoji]}>{greeting.emoji}</Text>
          </TouchableOpacity>
            <Text style={[styles.greetingTitle, { color: colors.text }]}>
              {greeting.text},{' '}
              <Text style={{ color: colors.primary }}>{providerName || 'Técnico'}</Text>
            </Text>
            <Text style={[styles.subtitleDash, { color: colors.subtext }]}>
              {isActive ? 'Estás visible para clientes' : 'Conéctate para recibir solicitudes'}
            </Text>
          </View>
        </View>

        {/* ═══ STATS PILLS ═══ */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
            <Ionicons name="star" size={22} color="#f1c40f" />
            <Text style={[styles.statValue, { color: colors.text }]}>{totalRating}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>
              {reviewCount > 0 ? `${reviewCount} reseñas` : 'Sin reseñas'}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
            <Ionicons name="briefcase" size={22} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.text }]}>{jobsCompleted}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>Trabajos</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
            <Ionicons name="trending-up" size={22} color={colors.success} />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {jobsCompleted > 0 ? 'Activo' : 'Nuevo'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>Nivel</Text>
          </View>
        </View>

        {/* ═══ TOGGLE ONLINE / OFFLINE ═══ */}
        <Animated.View style={[styles.statusContainer, { transform: [{ scale: toggleScale }] }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.bigStatusButton,
              isActive
                ? { backgroundColor: colors.success, borderColor: isDark ? '#1e7e34' : '#1e7e34' }
                : { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow },
            ]}
            onPress={toggleSwitch}
            accessibilityLabel={isActive ? 'Desconectarse' : 'Conectarse'}
          >
            <View style={[styles.pulseRing, isActive && styles.pulseRingActive]}>
              <Ionicons
                name={isActive ? 'radio-outline' : 'power'}
                size={45}
                color={isActive ? '#fff' : colors.subtext}
              />
            </View>
            <Text style={[styles.statusMainText, { color: isActive ? '#fff' : colors.text }]}>
              {isActive ? 'ONLINE' : 'OFFLINE'}
            </Text>
            <Text style={[styles.statusSubText, { color: isActive ? 'rgba(255,255,255,0.8)' : colors.subtext }]}>
              {isActive ? 'Buscando clientes cerca...' : 'Toca para conectarte'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ═══ FORMULARIO ═══ */}
        <View style={[styles.sectionForm, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          <View style={styles.formHeader}>
            <Text style={[styles.formTitle, { color: colors.text }]}>Tu Perfil de Servicio</Text>
            {isActive && (
              <View style={[styles.lockedBadge, { backgroundColor: isDark ? '#2a2a2a' : '#FFF3CD' }]}>
                <Ionicons name="lock-closed" size={12} color={isDark ? '#f1c40f' : '#856404'} />
                <Text style={[styles.lockedBadgeText, { color: isDark ? '#f1c40f' : '#856404' }]}>
                  Bloqueado
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.labelForm, { color: colors.subtext }]}>Especialidad</Text>
          <TextInput
            style={[
              styles.inputForm,
              {
                backgroundColor: isActive ? (isDark ? '#1a1a1a' : '#f0f0f0') : colors.input,
                color: isActive ? colors.subtext : colors.text,
                borderColor: colors.border,
              },
            ]}
            value={specialty}
            onChangeText={setSpecialty}
            editable={!isActive}
            placeholder="ej. Electricista, Gasfitero, Pintor..."
            placeholderTextColor={colors.subtext}
          />

          <Text style={[styles.labelForm, { color: colors.subtext, marginTop: 12 }]}>Tarifa Referencial</Text>
          <TextInput
            style={[
              styles.inputForm,
              {
                backgroundColor: isActive ? (isDark ? '#1a1a1a' : '#f0f0f0') : colors.input,
                color: isActive ? colors.subtext : colors.text,
                borderColor: colors.border,
              },
            ]}
            value={price}
            onChangeText={setPrice}
            editable={!isActive}
            placeholder="ej. S/ 30 - S/ 80 por visita"
            placeholderTextColor={colors.subtext}
          />
        </View>

        {/* ═══ ÁREA DE SERVICIO ═══ */}
        <View style={[styles.sectionForm, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          <View style={styles.formHeader}>
            <Text style={[styles.formTitle, { color: colors.text }]}>Área de Servicio</Text>
            {isActive && (
              <View style={[styles.lockedBadge, { backgroundColor: isDark ? '#2a2a2a' : '#FFF3CD' }]}>
                <Ionicons name="lock-closed" size={12} color={isDark ? '#f1c40f' : '#856404'} />
                <Text style={[styles.lockedBadgeText, { color: isDark ? '#f1c40f' : '#856404' }]}>Bloqueado</Text>
              </View>
            )}
          </View>
          <Text style={[styles.labelForm, { color: colors.subtext }]}>Radio máximo de cobertura</Text>
          <View style={styles.radiusChipsRow}>
            {[5, 10, 15, 20, 30].map((km) => (
              <TouchableOpacity
                key={km}
                disabled={isActive}
                onPress={() => setServiceRadius(km)}
                style={[
                  styles.radiusChip,
                  {
                    backgroundColor: serviceRadius === km
                      ? colors.primary
                      : (isDark ? '#2a2a2a' : '#f0f0f0'),
                    opacity: isActive ? 0.5 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.radiusChipText,
                    { color: serviceRadius === km ? '#fff' : colors.text },
                  ]}
                >
                  {km} km
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={[styles.radiusInfo, { backgroundColor: isDark ? '#0d1418' : '#F0F7FF' }]}>
            <Ionicons name="map-outline" size={16} color={colors.primary} />
            <Text style={[styles.radiusInfoText, { color: colors.subtext }]}>
              Recibirás solicitudes de clientes dentro de {serviceRadius} km de tu ubicación.
            </Text>
          </View>
        </View>

        {/* ═══ MENÚ DE NAVEGACIÓN ═══ */}
        <View style={[styles.dashNavLinks, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          <TouchableOpacity
            onPress={() => router.push('/provider/history')}
            style={[styles.dashLink, { borderBottomColor: colors.border }]}
          >
            <View style={[styles.dashLinkIcon, { backgroundColor: isDark ? '#1a2e1a' : '#E8F5E9' }]}>
              <Ionicons name="time-outline" size={20} color={colors.success} />
            </View>
            <Text style={[styles.dashLinkText, { color: colors.text }]}>Mi Historial</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/profile')}
            style={[styles.dashLink, { borderBottomColor: colors.border }]}
          >
            <View style={[styles.dashLinkIcon, { backgroundColor: isDark ? '#1a1a2e' : '#E3F2FD' }]}>
              <Ionicons name="person-outline" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.dashLinkText, { color: colors.text }]}>Editar Mi Perfil</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.dashLink, { borderBottomWidth: 0 }]} onPress={handleLogout}>
            <View style={[styles.dashLinkIcon, { backgroundColor: isDark ? '#2e1a1a' : '#FFEBEE' }]}>
              <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            </View>
            <Text style={[styles.dashLinkText, { color: colors.danger }]}>Cerrar Sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ═══════════ RADAR BOTTOM SHEET ═══════════ */}
      {incomingRequest && (
        <View style={styles.radarOverlay}>
          <View style={[styles.radarCard, { backgroundColor: isDark ? '#1F2C34' : '#fff' }]}>
            <View style={[styles.radarIconBox, { backgroundColor: colors.success }]}>
              <Ionicons name="notifications" size={36} color="#fff" />
            </View>

            <Text style={[styles.radarTitle, { color: colors.text }]}>¡NUEVA SOLICITUD!</Text>

            <View style={[styles.radarDetails, { backgroundColor: isDark ? '#0d1418' : '#F8F9FA' }]}>
              <View style={styles.radarDetailRow}>
                <Text style={[styles.radarDetailLabel, { color: colors.subtext }]}>Cliente</Text>
                <Text style={[styles.radarDetailValue, { color: colors.text }]}>
                  {incomingRequest.clientName || 'Anónimo'}
                </Text>
              </View>

              {incomingRequest.serviceType && (
                <View style={styles.radarDetailRow}>
                  <Text style={[styles.radarDetailLabel, { color: colors.subtext }]}>Servicio</Text>
                  <Text style={[styles.radarDetailValue, { color: colors.text }]}>
                    {incomingRequest.serviceType}
                  </Text>
                </View>
              )}

              <View style={styles.radarDetailRow}>
                <Text style={[styles.radarDetailLabel, { color: colors.subtext }]}>Precio acordado</Text>
                <Text style={[styles.radarDetailValue, { color: colors.primary, fontWeight: '800' }]}>
                  {incomingRequest.price_agreed || 'A convenir'}
                </Text>
              </View>

              {radarDistance !== null && (
                <View style={[styles.radarDistancePill, { backgroundColor: isDark ? '#1a2e2e' : '#E3F2FD' }]}>
                  <Ionicons name="location" size={16} color={colors.primary} />
                  <Text style={[styles.radarDistanceText, { color: colors.primary }]}>
                    A {formatDistance(radarDistance)} aprox.
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.radarButtonsRow}>
              <TouchableOpacity
                style={[styles.radarRejectBtn, { borderColor: colors.danger }, accepting && { opacity: 0.5 }]}
                onPress={rejectJob}
                disabled={accepting}
              >
                <Ionicons name="close" size={22} color={colors.danger} />
                <Text style={[styles.radarRejectText, { color: colors.danger }]}>RECHAZAR</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.radarAcceptBtn, { backgroundColor: colors.success }, accepting && { opacity: 0.7 }]}
                onPress={acceptJob}
                disabled={accepting}
              >
                {accepting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="checkmark-circle" size={22} color="#fff" />
                )}
                <Text style={styles.radarAcceptText}>{accepting ? 'ACEPTANDO...' : 'ACEPTAR'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// ESTILOS
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  containerFull: { flex: 1 },
  containerDashboard: { flexGrow: 1, padding: 20, paddingBottom: 50, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ── Header ──────────────────────────
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 },
  greetingEmoji: { fontSize: 28, marginBottom: 4 },
  greetingTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subtitleDash: { fontSize: 14, marginTop: 4 },

  // ── Stats ───────────────────────────
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 30 },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  statValue: { fontSize: 20, fontWeight: '800', marginTop: 6 },
  statLabel: { fontSize: 11, marginTop: 2 },

  // ── Toggle ──────────────────────────
  statusContainer: { alignItems: 'center', marginBottom: 30 },
  bigStatusButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    elevation: 12,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  pulseRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  pulseRingActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  statusMainText: { fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  statusSubText: { fontSize: 12, marginTop: 4, fontWeight: '500' },

  // ── Form ────────────────────────────
  sectionForm: { padding: 20, borderRadius: 20, elevation: 2, marginBottom: 20, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  formTitle: { fontSize: 16, fontWeight: '700' },
  lockedBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, gap: 4 },
  lockedBadgeText: { fontSize: 11, fontWeight: '600' },
  labelForm: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  inputForm: {
    padding: 14,
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 1,
  },

  // ── Nav Links ───────────────────────
  dashNavLinks: { borderRadius: 20, elevation: 2, paddingHorizontal: 4, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4 },
  dashLink: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 12, borderBottomWidth: 1 },
  dashLinkIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  dashLinkText: { flex: 1, fontSize: 15, fontWeight: '600' },

  // ── En-ruta ─────────────────────────
  mapAbsolute: { ...StyleSheet.absoluteFillObject },
  floatingActionCard: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    borderRadius: 24,
    padding: 20,
    elevation: 20,
    shadowOffset: { width: 0, height: -5 },
    shadowRadius: 15,
    shadowOpacity: 0.15,
  },
  routeHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  routeHeaderLeft: { flex: 1 },
  routeLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  routeClientName: { fontSize: 22, fontWeight: '800' },
  routeServiceType: { fontSize: 13, marginTop: 2 },
  distanceBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  distanceBadgeText: { fontSize: 13, fontWeight: '700' },
  routeActionsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  circleBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  circleBtnLabel: { color: '#fff', fontSize: 10, fontWeight: '700', marginTop: 3 },
  finishBtn: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  finishBtnText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  disabledButton: { opacity: 0.5 },

  // ── Radar ───────────────────────────
  radarOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end', zIndex: 100 },
  radarCard: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    alignItems: 'center',
    elevation: 30,
  },
  radarIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -60,
    marginBottom: 16,
    borderWidth: 4,
    borderColor: '#fff',
    elevation: 8,
  },
  radarTitle: { fontSize: 22, fontWeight: '900', letterSpacing: 1, marginBottom: 16 },
  radarDetails: { width: '100%', borderRadius: 16, padding: 16, marginBottom: 20 },
  radarDetailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  radarDetailLabel: { fontSize: 13, fontWeight: '500' },
  radarDetailValue: { fontSize: 16, fontWeight: '700' },
  radarDistancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 8,
    gap: 6,
  },
  radarDistanceText: { fontWeight: '700', fontSize: 14 },
  radarButtonsRow: { flexDirection: 'row', width: '100%', gap: 12 },
  radarRejectBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    gap: 6,
  },
  radarRejectText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  radarAcceptBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    gap: 8,
  },
  radarAcceptText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },

  // ── Service Area Chips ──────────────
  radiusChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 16 },
  radiusChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  radiusChipText: { fontSize: 14, fontWeight: '600' },
  radiusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  radiusInfoText: { flex: 1, fontSize: 13, lineHeight: 18 },
});