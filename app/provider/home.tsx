import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, Vibration, View } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import Toast from 'react-native-toast-message';

import * as Haptics from 'expo-haptics';
import { GeoPoint, collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import * as geofire from 'geofire-common';
import { getDistance } from 'geolib';
import { auth, db } from '../../src/config/firebase';
import { useTheme } from '../../src/context/ThemeContext';

import { registerForPushNotificationsAsync, sendPushNotification } from '../../utils/pushNotifications';

export default function ProviderHome() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const user = auth.currentUser;

  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [specialty, setSpecialty] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState<any>(null);

  // Gamification Metrics
  const [totalRating, setTotalRating] = useState('0.0');
  const [jobsCompleted, setJobsCompleted] = useState(0);

  const [incomingRequest, setIncomingRequest] = useState<any>(null);
  const [currentJob, setCurrentJob] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [cancelling, setCancelling] = useState(false);


  useEffect(() => {
    if (user) {
      registerForPushNotificationsAsync(user.uid);
    }
  }, [user]);


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
          }
          setJobsCompleted(data.jobs_completed || 0);
        }
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    loadProfile();
  }, []);


  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'service_requests'), where('providerId', '==', user.uid), where('status', '==', 'PENDING'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
        docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        const reqData = docs[0];

        setIncomingRequest((prev: any) => {
          if (!prev || prev.id !== reqData.id) {
            Vibration.vibrate([0, 500, 200, 500, 200, 500]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Toast.show({ type: 'success', text1: '¡NUEVA SOLICITUD EN RADAR! 🔔', text2: `Cliente ${reqData.clientName || 'Nuevo'} te necesita.`, visibilityTime: 6000 });
          }
          return reqData;
        });
      } else {
        setIncomingRequest((prev: any) => {
          if (prev) {
            Alert.alert("Aviso", "El cliente ha cancelado la solicitud o ya no está disponible.");
          }
          return null;
        });
      }
    });
    return () => unsubscribe();
  }, [user]);


  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'service_requests'), where('providerId', '==', user.uid), where('status', '==', 'ACCEPTED'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
        docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setCurrentJob(docs[0]);
      } else {
        setCurrentJob(null);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const acceptJob = async () => {
    if (!incomingRequest) return;
    try {
      await updateDoc(doc(db, 'service_requests', incomingRequest.id), { status: 'ACCEPTED' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: '¡Trabajo Aceptado!', text2: 'Iniciando modo GPS en ruta...' });

      // 🚨 NOTIFICACIÓN PUSH AL CLIENTE
      const clientDoc = await getDoc(doc(db, 'users', incomingRequest.clientId));
      if (clientDoc.exists() && clientDoc.data().expoPushToken) {
        await sendPushNotification(
          clientDoc.data().expoPushToken,
          "¡TÉCNICO EN CAMINO! 🚀",
          `${user?.email?.split('@')[0] || 'El técnico'} ha aceptado tu solicitud. Ingresa a la app para ver su progreso en el mapa.`
        );
      }

      setIncomingRequest(null);
    } catch (error) { Alert.alert('Error', 'No se pudo aceptar'); }
  };

  const cancelJobAsProvider = async () => {
    if (!currentJob) return;
    Alert.alert(
      "Abortar Servicio",
      "¿Estás seguro de cancelar? El cliente será notificado.",
      [
        { text: "No, seguir en camino", style: "cancel" },
        {
          text: "Sí, abortar",
          style: "destructive",
          onPress: async () => {
            setCancelling(true);
            try {
              await updateDoc(doc(db, 'service_requests', currentJob.id), {
                status: 'CANCELLED_BY_PROVIDER',
                cancelledAt: serverTimestamp()
              });

              // 🚨 NOTIFICACIÓN PUSH AL CLIENTE
              const clientDoc = await getDoc(doc(db, 'users', currentJob.clientId));
              if (clientDoc.exists() && clientDoc.data().expoPushToken) {
                await sendPushNotification(
                  clientDoc.data().expoPushToken,
                  "Servicio Abortado ⚠️",
                  "El técnico tuvo un inconveniente y canceló el servicio. Por favor, solicita a otro profesional."
                );
              }

              Alert.alert("Servicio Abortado", "Se ha notificado al cliente.");
              setCurrentJob(null);
            } catch (error) {
              Alert.alert('Error', 'No se pudo cancelar el servicio en la base de datos.');
            } finally {
              setCancelling(false);
            }
          }
        }
      ]
    );
  };

  const finishJob = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) { Alert.alert("Permiso denegado", "Necesitas la cámara."); return; }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.2,
      base64: true,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setUploading(true);
      try {
        const base64Img = `data:image/jpeg;base64,${result.assets[0].base64}`;
        await updateDoc(doc(db, 'service_requests', currentJob.id), {
          status: 'COMPLETED',
          evidence_photo: base64Img,
          finished_at: serverTimestamp()
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // 🚨 NOTIFICACIÓN PUSH AL CLIENTE
        const clientDoc = await getDoc(doc(db, 'users', currentJob.clientId));
        if (clientDoc.exists() && clientDoc.data().expoPushToken) {
          await sendPushNotification(
            clientDoc.data().expoPushToken,
            "¡Trabajo Culminado! 🎉",
            "El técnico ha marcado el trabajo como completado. Entra a la app para calificar su servicio."
          );
        }

        Toast.show({ type: 'success', text1: '¡Misión Cumplida! 🎉', text2: 'Trabajo finalizado y evidencia guardada.' });
        setCurrentJob(null);
      } catch (error: any) {
        console.error(error);
        Alert.alert("Error al guardar", "Problema guardando la evidencia.");
      } finally {
        setUploading(false);
      }
    }
  };

  const toggleSwitch = async () => {
    if (!user) return;
    if (!isActive && (!specialty || !price)) {
      Alert.alert('Faltan datos', 'Ingresa especialidad y precio.');
      return;
    }

    const newState = !isActive;
    setIsActive(newState);

    try {
      if (newState) {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setIsActive(false);
          return;
        }

        let locationData = await Location.getCurrentPositionAsync({});
        const coords = locationData.coords;

        setLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005
        });

        const hash = geofire.geohashForLocation([coords.latitude, coords.longitude]);

        await updateDoc(doc(db, 'users', user.uid), {
          is_active: true,
          specialty: specialty,
          price_range: price,
          current_location: new GeoPoint(coords.latitude, coords.longitude),
          geohash: hash
        });

      } else {
        await updateDoc(doc(db, 'users', user.uid), { is_active: false });
      }
    } catch (error) {
      console.error("Error al cambiar estado:", error);
      setIsActive(!newState);
    }
  };
  const handleLogout = async () => { await auth.signOut(); router.replace('/'); };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007bff" /></View>;

  // ESTILO DE MAPA DINÁMICO
  const mapStyle = theme === 'dark'
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

  if (currentJob) {
    return (
      <View style={[styles.containerFull, { backgroundColor: colors.background }]}>
        {/* MODO EN RUTA (MAPA COMPLETO) */}
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
            <Marker coordinate={location} title="Tú" pinColor="blue" />
            <Marker coordinate={{ latitude: currentJob.location.latitude, longitude: currentJob.location.longitude }} title="Cliente" pinColor="red" />
          </MapView>
        ) : (
          <View style={[styles.mapAbsolute, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} size="large" /></View>
        )}

        {/* PANEL DE ACCIONES FLOTANTE */}
        <View style={[styles.floatingActionCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          <Text style={styles.routeTitle}>📌 CLIENTE EN ESPERA</Text>
          <Text style={[styles.routeClientName, { color: colors.text }]}>{currentJob.clientName}</Text>

          <View style={styles.routeActionsContainer}>
            <TouchableOpacity style={styles.circleBtnGPS} onPress={() => {
              const lat = currentJob.location.latitude;
              const lng = currentJob.location.longitude;
              Linking.openURL(`http://googleusercontent.com/maps.google.com/maps?daddr=${lat},${lng}`);
            }}>
              <Ionicons name="navigate" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.circleBtnChat, { backgroundColor: colors.success }]} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: currentJob.id } })}>
              <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.circleBtnAbort, { backgroundColor: colors.danger }]} onPress={cancelJobAsProvider} disabled={cancelling}>
              {cancelling ? <ActivityIndicator color="#fff" /> : <Ionicons name="close-circle" size={24} color="#fff" />}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.finishBtn, { backgroundColor: colors.primary }, uploading && styles.disabledButton]} onPress={finishJob} disabled={uploading}>
            {uploading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="camera" size={24} color="#fff" style={{ marginRight: 10 }} />
                <Text style={styles.finishBtnText}>CAPTURA EVIDENCIA Y COMPLETA</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // CÁLCULO DE DISTANCIA PARA RADAR
  const radarDistance = incomingRequest && location && incomingRequest.location
    ? getDistance(
      { latitude: location.latitude, longitude: location.longitude },
      { latitude: incomingRequest.location.latitude, longitude: incomingRequest.location.longitude }
    )
    : null;

  return (
    <View style={[styles.containerFull, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.containerDashboard}>

        <View style={styles.headerRowGamified}>
          <View>
            <Text style={[styles.greetingTitle, { color: colors.text }]}>Resumen Ideal</Text>
            <Text style={[styles.subtitleDash, { color: colors.subtext }]}>Listo para trabajar hoy</Text>
          </View>
          <View style={styles.gamifiedStats}>
            <View style={[styles.statPill, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
              <Ionicons name="star" size={16} color="#f1c40f" />
              <Text style={[styles.statTextbold, { color: colors.text }]}>{totalRating}</Text>
            </View>
            <View style={[styles.statPill, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
              <Ionicons name="briefcase" size={16} color={colors.primary} />
              <Text style={[styles.statTextbold, { color: colors.text }]}>{jobsCompleted}</Text>
            </View>
          </View>
        </View>

        {/* BOTÓN GIGANTE ONLINE / OFFLINE */}
        <View style={styles.statusContainer}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.bigStatusButton,
              isActive
                ? [styles.btnOnline, { backgroundColor: colors.success, borderColor: '#1e7e34' }]
                : [styles.btnOffline, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]
            ]}
            onPress={toggleSwitch}
          >
            <View style={[styles.pulseRing, isActive && styles.pulseRingActive]}>
              <Ionicons name={isActive ? "radio-outline" : "power"} size={45} color={isActive ? "#fff" : colors.subtext} />
            </View>
            <Text style={[styles.statusMainText, { color: isActive ? "#fff" : colors.subtext }]}>
              {isActive ? "ESTÁS ONLINE" : "DESCONECTADO"}
            </Text>
            <Text style={[styles.statusSubText, { color: isActive ? "rgba(255,255,255,0.8)" : colors.subtext }]}>
              {isActive ? "Buscando clientes cerca..." : "Toca para conectarte"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.sectionForm, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          <Text style={[styles.labelForm, { color: colors.text }]}>Tu Especialidad</Text>
          <TextInput
            style={[styles.inputForm, { backgroundColor: colors.input, color: colors.text }]}
            value={specialty}
            onChangeText={setSpecialty}
            editable={!isActive}
            placeholderTextColor={colors.subtext}
          />
          <Text style={[styles.labelForm, { color: colors.text }]}>Tarifa Referencial (Formato libre)</Text>
          <TextInput
            style={[styles.inputForm, { backgroundColor: colors.input, color: colors.text }]}
            value={price}
            onChangeText={setPrice}
            editable={!isActive}
            placeholderTextColor={colors.subtext}
          />
        </View>

        <View style={[styles.dashNavLinks, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          <TouchableOpacity onPress={() => router.push('/provider/history')} style={[styles.dashLink, { borderBottomColor: colors.border }]}>
            <Ionicons name="time-outline" size={24} color={colors.icon} />
            <Text style={[styles.dashLinkText, { color: colors.text }]}>Mi Historial y Trazabilidad</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/profile')} style={[styles.dashLink, { borderBottomColor: colors.border }]}>
            <Ionicons name="person-outline" size={24} color={colors.icon} />
            <Text style={[styles.dashLinkText, { color: colors.text }]}>Editar Mi Cuenta</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dashLink, { borderBottomWidth: 0 }]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color={colors.danger} />
            <Text style={[styles.dashLinkText, { color: colors.danger }]}>Cerrar Sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* EFECTO RADAR (BOTTOM SHEET ALTA INTERRUPCIÓN) */}
      {incomingRequest && (
        <View style={styles.radarOverlay}>
          <View style={styles.radarCard}>
            <View style={styles.radarIconBox}>
              <Ionicons name="notifications" size={40} color="#fff" />
            </View>
            <Text style={styles.radarTitle}>¡NUEVA SOLICITUD!</Text>

            <View style={styles.radarDetails}>
              <Text style={styles.radarClientLabel}>Cliente:</Text>
              <Text style={styles.radarClient}>{incomingRequest.clientName}</Text>
              <Text style={styles.radarClientLabel}>A pagar:</Text>
              <Text style={styles.radarClient}>{incomingRequest.price_agreed}</Text>

              {radarDistance && (
                <View style={styles.radarDistancePill}>
                  <Ionicons name="location" size={16} color="#007bff" />
                  <Text style={styles.radarDistanceText}>A {(radarDistance / 1000).toFixed(1)} km aprox.</Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.radarAcceptBtn} onPress={acceptJob}>
              <Ionicons name="checkmark-circle" size={28} color="#fff" style={{ marginRight: 10 }} />
              <Text style={styles.radarAcceptText}>¡ACEPTAR TRABAJO!</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  containerFull: { flex: 1, backgroundColor: '#f8f9fa' },
  containerDashboard: { flexGrow: 1, padding: 20, paddingBottom: 50, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },


  headerRowGamified: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  greetingTitle: { fontSize: 26, fontWeight: '900', color: '#1a1a1a', letterSpacing: -0.5 },
  subtitleDash: { fontSize: 15, color: '#666', marginTop: 2 },
  gamifiedStats: { flexDirection: 'row', gap: 10 },
  statPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
  statTextbold: { fontWeight: '700', marginLeft: 5, fontSize: 14, color: '#333' },


  statusContainer: { alignItems: 'center', marginBottom: 40 },
  bigStatusButton: { width: 220, height: 220, borderRadius: 110, justifyContent: 'center', alignItems: 'center', elevation: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15 },
  btnOffline: { backgroundColor: '#f8f9fa', borderWidth: 4, borderColor: '#e0e0e0' },
  btnOnline: { backgroundColor: '#28a745', borderWidth: 4, borderColor: '#1e7e34' },
  pulseRing: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  pulseRingActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  statusMainText: { fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  statusSubText: { fontSize: 13, marginTop: 5, fontWeight: '600' },


  sectionForm: { backgroundColor: '#fff', padding: 20, borderRadius: 20, elevation: 2, marginBottom: 30 },
  labelForm: { fontSize: 14, fontWeight: '700', color: '#444', marginBottom: 8, marginTop: 5 },
  inputForm: { backgroundColor: '#f1f3f5', padding: 15, borderRadius: 12, fontSize: 16, color: '#333' },

  dashNavLinks: { backgroundColor: '#fff', borderRadius: 20, elevation: 2, paddingHorizontal: 15 },
  dashLink: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#f1f1f1' },
  dashLinkText: { flex: 1, fontSize: 16, fontWeight: '600', marginLeft: 15, color: '#333' },


  mapAbsolute: { ...StyleSheet.absoluteFillObject },
  floatingActionCard: { position: 'absolute', bottom: 20, left: 20, right: 20, borderRadius: 25, padding: 25, elevation: 20, shadowOffset: { width: 0, height: -5 }, shadowRadius: 15, shadowOpacity: 0.2 },
  routeTitle: { fontSize: 13, fontWeight: '800', color: '#007bff', letterSpacing: 1, marginBottom: 5 },
  routeClientName: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  routeActionsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  circleBtnGPS: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  circleBtnChat: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  circleBtnAbort: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  finishBtn: { flexDirection: 'row', paddingVertical: 18, borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  finishBtnText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  disabledButton: { backgroundColor: '#aaa' },


  radarOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end', zIndex: 100 },
  radarCard: { borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 30, alignItems: 'center', elevation: 30 },
  radarIconBox: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', elevation: 10, marginTop: -70, marginBottom: 15, borderWidth: 4, borderColor: '#fff' },
  radarTitle: { fontSize: 24, fontWeight: '900', letterSpacing: 1, marginBottom: 20 },
  radarDetails: { width: '100%', borderRadius: 20, padding: 20, marginBottom: 25 },
  radarClientLabel: { fontSize: 14, fontWeight: '600' },
  radarClient: { fontSize: 22, fontWeight: 'bold', marginBottom: 15 },
  radarDistancePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignSelf: 'flex-start', marginTop: 10 },
  radarDistanceText: { fontWeight: 'bold', marginLeft: 5, fontSize: 15 },
  radarAcceptBtn: { flexDirection: 'row', width: '100%', paddingVertical: 20, borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  radarAcceptText: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
});