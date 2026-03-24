import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { getDistance } from 'geolib';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import Toast from 'react-native-toast-message';

import { onAuthStateChanged } from 'firebase/auth';
import { GeoPoint, addDoc, collection, doc, getDocs, increment, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../../src/config/firebase';
import { useTheme } from '../../src/context/ThemeContext';
import { registerForPushNotificationsAsync, sendPushNotification } from '../../utils/pushNotifications';

const SERVICES = [
  { id: 'Gasfitero', name: 'Gasfitería', icon: 'water', colorKey: 'blue' },
  { id: 'Electricista', name: 'Electricidad', icon: 'flash', colorKey: 'yellow' },
  { id: 'Limpieza', name: 'Limpieza', icon: 'sparkles', colorKey: 'purple' },
  { id: 'Albañil', name: 'Albañilería', icon: 'construct', colorKey: 'orange' },
  { id: 'Pintor', name: 'Pintura', icon: 'color-palette', colorKey: 'red' },
  { id: 'Tecnico', name: 'Técnico PC', icon: 'desktop', colorKey: 'green' },
];

export default function ClientMapHome() {
  const router = useRouter();
  const [user, setUser] = useState(auth.currentUser);
  const { theme, colors } = useTheme();

  // Suscripción reactiva al estado de autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

  // Registrar push token del cliente
  useEffect(() => {
    if (user) registerForPushNotificationsAsync(user.uid);
  }, [user]);

  // STADOS DEL MAPA / FILTROS
  const [location, setLocation] = useState<any>(null);
  const [filteredProviders, setFilteredProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [searchRadius, setSearchRadius] = useState<number>(5000); // 5km or 50km



  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);


  const [activeRequest, setActiveRequest] = useState<any>(null);

  // EVALUACIÓN (MODAL)
  const [isRatingModalVisible, setRatingModalVisible] = useState(false);
  const [rating, setRating] = useState(5);
  const [ratingLoading, setRatingLoading] = useState(false);


  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permiso denegado', 'Necesitamos tu ubicación.'); setLoading(false); return; }
      let locationData = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      });
    })();
  }, []);


  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'service_requests'),
      where('clientId', '==', user.uid),
      where('status', 'in', ['PENDING', 'ACCEPTED', 'COMPLETED', 'CANCELLED_BY_PROVIDER'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
        // Ordenar del más nuevo al más antiguo
        docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        const newData = docs[0];

        setActiveRequest((prev: any) => {
          // Si el proveedor cancela:
          if (newData.status === 'CANCELLED_BY_PROVIDER') {
            if (prev && prev.id === newData.id && prev.status !== 'CANCELLED_BY_PROVIDER') {
              Toast.show({ type: 'error', text1: 'Servicio Abortado', text2: 'El proveedor canceló la visita.', visibilityTime: 5000 });
              Vibration.vibrate(1000);
            }
            return null; // Reiniciar a modo descubrimiento inmediatamente
          }

          // Transición de Pendiente a Aceptado
          if (prev && prev.status === 'PENDING' && newData.status === 'ACCEPTED') {
            Vibration.vibrate([0, 500, 200, 500]);
            Toast.show({ type: 'success', text1: '¡TÉCNICO EN CAMINO! 🚀', text2: `${newData.providerName} ha aceptado.`, visibilityTime: 5000 });
          }

          // Transición al finalizar (Autodisparador del Modal)
          if (newData.status === 'COMPLETED' && (!prev || prev.status !== 'COMPLETED')) {
            Vibration.vibrate(1000);
            setRating(5);
            setRatingModalVisible(true);
          }

          return newData;
        });
      } else {
        setActiveRequest(null);
      }
    });
    return () => unsubscribe();
  }, [user]);


  useEffect(() => {
    if (!location) return;

    const fetchProviders = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'PROVIDER'), where('is_active', '==', true));
        const snapshot = await getDocs(q);
        const todos: any[] = [];

        snapshot.forEach(doc => {
          const data = doc.data();
          // Aplicar Filtro Horizontal (Chips)
          if (activeFilter && data.specialty && !data.specialty.toLowerCase().includes(activeFilter.toLowerCase())) return;

          let distancia = 0;
          if (data.current_location) {
            distancia = getDistance(
              { latitude: location.latitude, longitude: location.longitude },
              { latitude: data.current_location.latitude, longitude: data.current_location.longitude }
            );
          }

          // Filtrar por distancia seleccionada por el usuario
          if (distancia <= searchRadius) {
            todos.push({
              id: doc.id,
              ...data,
              distancia,
              rating: data.review_count > 0 ? (data.total_rating / data.review_count).toFixed(1) : "Nuevo",
              price_range: data.price_range || "S/ 50",
              jobs: data.jobs_completed || 0
            });
          }
        });
        setFilteredProviders(todos);

      } catch (error) {
        console.error("Error buscando técnicos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProviders();
  }, [location, activeFilter, searchRadius]);


  const sendRequest = async () => {
    if (requestLoading) return;
    setRequestLoading(true);
    try {
      if (!location) {
        Alert.alert('Error', 'Necesitamos tu ubicación.');
        return;
      }
      
      await addDoc(collection(db, 'service_requests'), {
        clientId: user?.uid,
        clientName: user?.displayName || 'Cliente',
        providerId: selectedProvider.id,
        providerName: selectedProvider.full_name || 'Técnico',
        serviceType: selectedProvider.specialty || 'General',
        status: 'PENDING',
        location: {
           latitude: location.latitude,
           longitude: location.longitude
        },
        createdAt: serverTimestamp(),
      });

      Toast.show({ type: 'success', text1: '¡Buscando Técnico! 📡', text2: 'Avisando dispositivos cercanos...' });
      setSelectedProvider(null);
    } catch (error) { Alert.alert('Error', 'No se pudo enviar'); } finally { setRequestLoading(false); }
  };

  const cancelRequest = async () => {
    Alert.alert(
      "Cancelar Servicio",
      "¿Estás seguro de que deseas cancelar esta solicitud?",
      [
        { text: "No, mantener", style: "cancel" },
        {
          text: "Sí, cancelar",
          style: "destructive",
          onPress: async () => {
            setRequestLoading(true);
            try {
              await updateDoc(doc(db, 'service_requests', activeRequest.id), {
                status: 'CANCELLED_BY_CLIENT',
                cancelledAt: serverTimestamp()
              });
              Toast.show({ type: 'info', text1: 'Cancelado', text2: 'Solicitud cancelada correctamente.' });
              setActiveRequest(null); // Liberar máquina de estados manual
            } catch (error) {
              console.error(error);
              Alert.alert("Error", "Hubo un problema al cancelar.");
            } finally {
              setRequestLoading(false);
            }
          }
        }
      ]
    );
  };

  const submitRating = async () => {
    if (!activeRequest) return;
    setRatingLoading(true);
    try {
      await updateDoc(doc(db, 'service_requests', activeRequest.id), {
        status: 'ARCHIVED',
        rating_given: rating
      });

      const providerRef = doc(db, 'users', activeRequest.providerId);
      await updateDoc(providerRef, {
        total_rating: increment(rating),
        review_count: increment(1),
        jobs_completed: increment(1)
      });

      Toast.show({ type: 'success', text1: '¡Gracias!', text2: 'Evaluación enviada con éxito.' });
      setRatingModalVisible(false);
      setActiveRequest(null);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudo enviar la evaluación.");
    } finally {
      setRatingLoading(false);
    }
  };

  const mapStyle = theme === 'dark'
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  return (
    <View style={styles.container}>
      {/* 1. MAPA DE FONDO (SIEMPRE PRESENTE) */}
      {location ? (
        <MapView
          style={styles.map}
          region={location}
          showsUserLocation={true}
          showsMyLocationButton={false}
          onPress={() => setSelectedProvider(null)}
        >
          <UrlTile urlTemplate={mapStyle} maximumZ={19} flipY={false} />
          {filteredProviders.map((prov) => (
            <Marker
              key={prov.id}
              coordinate={{ latitude: prov.current_location.latitude, longitude: prov.current_location.longitude }}
              onPress={(e) => {
                e.stopPropagation();
                if (activeRequest) {
                  Toast.show({ type: 'info', text1: 'Solicitud en curso', text2: 'Cancela la actual si deseas contactar a otro técnico.' });
                  return;
                }
                setSelectedProvider(prov);
                setAcceptedTerms(false);
                setIsFavorite(false);
              }}
            >
              <View style={styles.markerContainer}>
                <View style={[styles.markerBubble, selectedProvider?.id === prov.id ? { backgroundColor: colors.primary } : { backgroundColor: '#ff4444' }]}>
                  <Ionicons name="construct" size={20} color="#fff" />
                </View>
                <View style={[styles.markerArrow, selectedProvider?.id === prov.id ? { backgroundColor: colors.primary } : { backgroundColor: '#ff4444' }]} />
              </View>
            </Marker>
          ))}
        </MapView>
      ) : (
        <View style={[styles.center, { backgroundColor: colors.background, flex: 1 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 15, color: colors.text, fontWeight: 'bold' }}>Buscando tu ubicación...</Text>
        </View>
      )}

      {/* 2. BARRA DE NAVEGACIÓN PRINCIPAL (SIEMPRE VISIBLE) */}
      <View style={styles.mainNav}>
        <View style={[styles.navPill, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          <TouchableOpacity onPress={() => router.push('/profile')} style={styles.navIcon}>
            <Ionicons name="person" size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: colors.text }]}>Service Marketplace</Text>
          <TouchableOpacity onPress={() => router.push('/client/history')} style={styles.navIcon}>
            <Ionicons name="time" size={20} color={colors.icon || colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. CHIPS DE FILTRO HORIZONTAL SUPERIOR (Solo si no hay solicitudes activas) */}
      {!activeRequest && (
        <View style={styles.headerFilters}>
          {/* RADIUS TOGGLE */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 10, gap: 10 }}>
            <TouchableOpacity
              style={[styles.chip, { elevation: 2, marginRight: 0 }, searchRadius === 5000 ? { backgroundColor: colors.success } : { backgroundColor: colors.card }]}
              onPress={() => { setSearchRadius(5000); setSelectedProvider(null); }}
            >
              <Text style={[{ fontSize: 13, fontWeight: 'bold' }, searchRadius === 5000 ? { color: '#fff' } : { color: colors.text }]}>📍 Cerca (5km)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, { elevation: 2, marginRight: 0 }, searchRadius === 50000 ? { backgroundColor: colors.success } : { backgroundColor: colors.card }]}
              onPress={() => { setSearchRadius(50000); setSelectedProvider(null); }}
            >
              <Text style={[{ fontSize: 13, fontWeight: 'bold' }, searchRadius === 50000 ? { color: '#fff' } : { color: colors.text }]}>🌆 Todo Lima</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            <TouchableOpacity
              style={[styles.chip, activeFilter === null ? { backgroundColor: colors.primary } : { backgroundColor: colors.input }]}
              onPress={() => { setActiveFilter(null); setSelectedProvider(null); }}
            >
              <Text style={[styles.chipText, { color: activeFilter === null ? '#fff' : colors.text }]}>Todos</Text>
            </TouchableOpacity>
            {SERVICES.map((srv) => (
              <TouchableOpacity
                key={srv.id}
                style={[styles.chip, activeFilter === srv.id ? { backgroundColor: colors.primary } : { backgroundColor: colors.input }]}
                onPress={() => { setActiveFilter(srv.id); setSelectedProvider(null); }}
              >
                <Ionicons name={srv.icon as any} size={14} color={activeFilter === srv.id ? '#fff' : colors.text} style={{ marginRight: 5 }} />
                <Text style={[styles.chipText, { color: activeFilter === srv.id ? '#fff' : colors.text }]}>{srv.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 4. CAPAS DINÁMICAS INFERIORES (STATE MACHINE) */}

      {/* ESTADO A: DESCUBRIMIENTO (Panel de Perfil Técnico Desplegado) */}
      {!activeRequest && selectedProvider && (
        <View style={[styles.bottomSheet, { backgroundColor: colors.card }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.providerHeader}>
            <View style={[styles.providerIcon, { backgroundColor: colors.input }]}><Ionicons name="person" size={24} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.panelTitle, { color: colors.text }]}>{selectedProvider.full_name}</Text>
              <Text style={[styles.specialtyText, { color: colors.subtext }]}>{selectedProvider.specialty} • a {(selectedProvider.distancia / 1000).toFixed(1)} km</Text>
            </View>
            <TouchableOpacity onPress={() => setIsFavorite(!isFavorite)}>
              <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={28} color={isFavorite ? colors.danger : colors.subtext} />
            </TouchableOpacity>
          </View>

          <View style={[styles.statsRow, { backgroundColor: colors.input }]}>
            <View style={styles.statItem}><Ionicons name="star" size={16} color="#f1c40f" /><Text style={[styles.statText, { color: colors.text }]}>{selectedProvider.rating}</Text></View>
            <View style={styles.statItem}><Ionicons name="briefcase" size={16} color={colors.primary} /><Text style={[styles.statText, { color: colors.text }]}>{selectedProvider.jobs} reqs</Text></View>
            <View style={styles.statItem}><Ionicons name="cash" size={16} color={colors.success} /><Text style={[styles.statText, { color: colors.text }]}>{selectedProvider.price_range}</Text></View>
          </View>

          <TouchableOpacity style={styles.termsContainer} onPress={() => setAcceptedTerms(!acceptedTerms)}>
            <Ionicons name={acceptedTerms ? "checkbox" : "square-outline"} size={24} color={acceptedTerms ? colors.primary : colors.subtext} />
            <Text style={[styles.termsText, { color: colors.subtext }]}>
              Acepto que el técnico acuda a mi dirección y los <Text style={{ fontWeight: 'bold', color: colors.primary }}>Términos</Text>.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: acceptedTerms ? colors.primary : colors.border }]}
            onPress={sendRequest}
            disabled={requestLoading || !acceptedTerms}
          >
            {requestLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>SOLICITAR TÉCNICO AHORA</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* ESTADO B: ESPERANDO CONFIRMACIÓN DEL TÉCNICO (MINI-BANNER PERSISTENTE) */}
      {activeRequest?.status === 'PENDING' && (
        <View style={[styles.pendingBanner, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 15 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.pendingTitle, { color: colors.text }]}>Esperando a {activeRequest.providerName}...</Text>
            <Text style={[styles.pendingSubtitle, { color: colors.subtext }]}>Puedes navegar por el mapa libremente.</Text>
          </View>
          <TouchableOpacity style={[styles.cancelMiniBtn, { backgroundColor: colors.danger }]} onPress={cancelRequest} disabled={requestLoading}>
            <Text style={styles.cancelMiniBtnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ESTADO C: TÉCNICO ACEPTA Y VA EN CAMINO */}
      {activeRequest?.status === 'ACCEPTED' && (
        <View style={[styles.bottomSheet, { backgroundColor: colors.card, paddingBottom: 40 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <Ionicons name="checkmark-circle" size={40} color={colors.success} />
            <View style={{ marginLeft: 15 }}>
              <Text style={[styles.activeTitle, { color: colors.text }]}>¡Tu Técnico ya viene!</Text>
              <Text style={[styles.activeSubtitle, { color: colors.subtext }]}>{activeRequest.providerName} ha aceptado</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 60 }]}
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: activeRequest.id } })}
          >
            <Ionicons name="chatbubble-ellipses" size={24} color="#fff" style={{ marginRight: 10 }} />
            <Text style={styles.actionBtnText}>ABRIR CHAT PRIVADO</Text>
          </TouchableOpacity>

          <TouchableOpacity style={{ alignSelf: 'center', marginTop: 20, opacity: requestLoading ? 0.5 : 1 }} onPress={cancelRequest} disabled={requestLoading}>
            <Text style={{ color: colors.danger, fontWeight: 'bold' }}>Abortar Servicio</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ESTADO D: FINALIZADO -> MODAL CALIFICACIÓN SUPERPUESTO AL MAPA */}
      <Modal visible={isRatingModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.primary }]}>¡Trabajo Culminado!</Text>
            <Text style={[styles.modalSubtitle, { color: colors.text }]}>¿Cómo calificarías a {activeRequest?.providerName}?</Text>

            {activeRequest?.evidence_photo && (
              <Image source={{ uri: activeRequest.evidence_photo }} style={styles.evidenceImage} resizeMode="cover" />
            )}

            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)}>
                  <Ionicons name={star <= rating ? "star" : "star-outline"} size={45} color="#f1c40f" />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary, width: '100%' }]} onPress={submitRating} disabled={ratingLoading}>
              {ratingLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>ENVIAR Y VOLVER AL MAPA</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1, width: '100%' },

  mainNav: { position: 'absolute', top: 55, left: 20, right: 20, zIndex: 30 },
  navPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 30, paddingHorizontal: 10, paddingVertical: 10, elevation: 8, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 },
  navIcon: { width: 45, height: 45, borderRadius: 25, backgroundColor: 'rgba(0,123,255,0.08)', justifyContent: 'center', alignItems: 'center' },
  navTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

  headerFilters: { position: 'absolute', top: 135, left: 0, right: 0, zIndex: 10 },
  chipsScroll: { alignItems: 'center', paddingHorizontal: 20 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 25, marginRight: 12, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  chipText: { fontSize: 13, fontWeight: 'bold' },

  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 25, borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 10 },
  sheetHandle: { width: 40, height: 5, backgroundColor: '#ddd', borderRadius: 5, alignSelf: 'center', marginBottom: 20, marginTop: -10 },

  providerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  providerIcon: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  panelTitle: { fontSize: 20, fontWeight: 'bold' },
  specialtyText: { fontSize: 14, fontWeight: '500' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20, padding: 15, borderRadius: 15 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { fontWeight: 'bold', fontSize: 14 },

  termsContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  termsText: { flex: 1, marginLeft: 10, fontSize: 12 },

  actionBtn: { padding: 18, borderRadius: 15, alignItems: 'center', elevation: 2 },
  actionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15, letterSpacing: 1 },
  actionBtnOutline: { padding: 18, borderRadius: 15, alignItems: 'center', borderWidth: 1.5 },
  actionBtnTextOutline: { fontWeight: 'bold', fontSize: 15, letterSpacing: 1 },

  waitingTitle: { fontSize: 22, fontWeight: 'bold', marginTop: 15, textAlign: 'center' },
  waitingSubtitle: { fontSize: 14, textAlign: 'center', marginTop: 5 },

  pendingBanner: { position: 'absolute', top: 135, left: 20, right: 20, zIndex: 20, flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 20, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 12 },
  pendingTitle: { fontSize: 14, fontWeight: 'bold' },
  pendingSubtitle: { fontSize: 12, marginTop: 4 },
  cancelMiniBtn: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 10, elevation: 3 },
  cancelMiniBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  activeTitle: { fontSize: 22, fontWeight: 'bold' },
  activeSubtitle: { fontSize: 14, marginTop: 2 },

  markerContainer: { alignItems: 'center' },
  markerBubble: { padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#fff', elevation: 5 },
  markerArrow: { width: 10, height: 10, transform: [{ rotate: '45deg' }], marginTop: -6, borderBottomRightRadius: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', padding: 25, borderRadius: 25, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 15, elevation: 15 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
  modalSubtitle: { fontSize: 16, textAlign: 'center', marginBottom: 20 },
  evidenceImage: { width: '100%', height: 180, borderRadius: 15, marginBottom: 20, borderWidth: 1, borderColor: '#eee' },
  starsContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 30, gap: 15 }
});