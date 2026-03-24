import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as geofire from 'geofire-common';
import { getDistance } from 'geolib';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import Toast from 'react-native-toast-message';

import { GeoPoint, addDoc, collection, doc, getDocs, increment, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../../src/config/firebase';
import { useTheme } from '../../src/context/ThemeContext';

const FILTERS = [
  { id: '5km', label: '📍 Cerca (5km)' },
  { id: 'all', label: '🗺️ Todo Lima/Callao' },
];

export default function MapScreen() {
  const { category } = useLocalSearchParams();
  const router = useRouter();
  const user = auth.currentUser;
  const { theme, colors } = useTheme();

  const [location, setLocation] = useState<any>(null);
  const [filteredProviders, setFilteredProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [requestLoading, setRequestLoading] = useState(false);

  const [activeFilter, setActiveFilter] = useState('5km');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

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
      where('status', 'in', ['PENDING', 'ACCEPTED', 'COMPLETED'])
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
        docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        const newData = docs[0];

        setActiveRequest((prev: any) => {
          if (prev && prev.status === 'PENDING' && newData.status === 'ACCEPTED') {
            Vibration.vibrate(1000);
            Toast.show({ type: 'success', text1: '¡TÉCNICO EN CAMINO! 🚀', text2: `${newData.providerName} ha aceptado.`, visibilityTime: 5000 });
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
        if (activeFilter === 'all') {
          const q = query(collection(db, 'users'), where('role', '==', 'PROVIDER'), where('is_active', '==', true));
          const snapshot = await getDocs(q);
          const todos: any[] = [];

          snapshot.forEach(doc => {
            const data = doc.data();
            if (category && data.specialty && !data.specialty.toLowerCase().includes(category.toString().toLowerCase())) return;

            let distancia = 0;
            if (data.current_location) {
              distancia = getDistance(
                { latitude: location.latitude, longitude: location.longitude },
                { latitude: data.current_location.latitude, longitude: data.current_location.longitude }
              );
            }

            todos.push({
              id: doc.id,
              ...data,
              distancia,
              rating: data.review_count > 0 ? (data.total_rating / data.review_count).toFixed(1) : "Nuevo",
              price_range: data.price_range || "S/ 50",
              jobs: data.jobs_completed || 0
            });
          });
          setFilteredProviders(todos);

        } else if (activeFilter === '5km') {
          const center: [number, number] = [location.latitude, location.longitude];
          const radiusInM = 5000;
          const bounds = geofire.geohashQueryBounds(center, radiusInM);
          const promises = [];

          for (const b of bounds) {
            const q = query(
              collection(db, 'users'),
              where('role', '==', 'PROVIDER'),
              where('is_active', '==', true),
              where('geohash', '>=', b[0]),
              where('geohash', '<=', b[1])
            );
            promises.push(getDocs(q));
          }

          const snapshots = await Promise.all(promises);
          const cercanos: any[] = [];

          for (const snap of snapshots) {
            for (const document of snap.docs) {
              const data = document.data();
              if (category && data.specialty && !data.specialty.toLowerCase().includes(category.toString().toLowerCase())) continue;

              const distanceInMeters = getDistance(
                { latitude: location.latitude, longitude: location.longitude },
                { latitude: data.current_location.latitude, longitude: data.current_location.longitude }
              );

              if (distanceInMeters <= radiusInM) {
                cercanos.push({
                  id: document.id,
                  ...data,
                  distancia: distanceInMeters,
                  rating: data.review_count > 0 ? (data.total_rating / data.review_count).toFixed(1) : "Nuevo",
                  price_range: data.price_range || "S/ 50",
                  jobs: data.jobs_completed || 0
                });
              }
            }
          }
          setFilteredProviders(cercanos);
        }
      } catch (error) {
        console.error("Error buscando técnicos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProviders();
  }, [location, category, activeFilter]);


  const sendRequest = async () => {
    if (!acceptedTerms) { Alert.alert("Atención", "Debes aceptar los términos."); return; }
    if (!selectedProvider || !location) return;
    setRequestLoading(true);
    try {
      await addDoc(collection(db, 'service_requests'), {
        clientId: user?.uid, clientName: user?.email,
        providerId: selectedProvider.id, providerName: selectedProvider.full_name,
        status: 'PENDING', location: new GeoPoint(location.latitude, location.longitude),
        createdAt: serverTimestamp(), price_agreed: selectedProvider.price_range
      });
      Toast.show({ type: 'success', text1: '¡Enviado!', text2: 'Esperando respuesta...' });
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
                status: 'CANCELLED_BY_CLIENT', // Estado específico para saber quién canceló
                cancelledAt: serverTimestamp()
              });
              Toast.show({ type: 'info', text1: 'Cancelado', text2: 'Solicitud cancelada correctamente.' });
              setActiveRequest(null);
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

  // 6. LÓGICA DE EVALUACIÓN
  const openRatingModal = () => {
    setRating(5);
    setRatingModalVisible(true);
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

  // 7. RENDERIZADO
  if (!location && loading) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;

  if (activeRequest) {
    return (
      <View style={[styles.waitingContainer, { backgroundColor: colors.background }]}>

        {/* ESTADO: BUSCANDO */}
        {activeRequest.status === 'PENDING' && (
          <View style={[styles.waitingCard, { backgroundColor: colors.card }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.waitingTitle, { color: colors.text }]}>Buscando técnico...</Text>
            <Text style={[styles.waitingText, { color: colors.subtext }]}>Tu solicitud está sonando en los dispositivos cercanos.</Text>

            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: colors.danger }]}
              onPress={cancelRequest}
              disabled={requestLoading}
            >
              <Text style={styles.cancelButtonText}>CANCELAR SOLICITUD</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ESTADO: ACEPTADO */}
        {activeRequest.status === 'ACCEPTED' && (
          <View style={[styles.activeJobCard, { backgroundColor: colors.card }]}>
            <View style={styles.activeHeader}>
              <Ionicons name="checkmark-circle" size={50} color={colors.success} />
              <Text style={[styles.activeTitle, { color: colors.success }]}>¡Técnico en camino!</Text>
            </View>
            <View style={[styles.technicianInfo, { backgroundColor: colors.input }]}>
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}><Ionicons name="person" size={40} color="#fff" /></View>
              <View>
                <Text style={[styles.techName, { color: colors.text }]}>{activeRequest.providerName}</Text>
                <Text style={[styles.techRole, { color: colors.subtext }]}>Técnico Especialista</Text>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity style={[styles.whatsappButton, { backgroundColor: colors.primary, flex: 1 }]} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: activeRequest.id } })}>
                <Ionicons name="chatbubbles" size={24} color="#fff" style={{ marginRight: 5 }} />
                <Text style={styles.whatsappText}>CHAT</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.whatsappButton, { backgroundColor: colors.danger, flex: 1 }]} onPress={cancelRequest}>
                <Ionicons name="close-circle" size={24} color="#fff" style={{ marginRight: 5 }} />
                <Text style={styles.whatsappText}>CANCELAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ESTADO: COMPLETADO */}
        {activeRequest.status === 'COMPLETED' && (
          <View style={[styles.completedCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.completedTitle, { color: colors.primary }]}>¡TRABAJO FINALIZADO!</Text>
            <Image source={{ uri: activeRequest.evidence_photo }} style={styles.evidenceImage} resizeMode="cover" />
            <TouchableOpacity style={[styles.finishButton, { backgroundColor: colors.primary }]} onPress={openRatingModal}>
              <Text style={styles.finishButtonText}>FINALIZAR Y EVALUAR</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* MODAL DE EVALUACIÓN */}
        <Modal visible={isRatingModalVisible} transparent={true} animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Califica el servicio</Text>
              <Text style={[styles.modalSubtitle, { color: colors.subtext }]}>¿Qué tal fue el trabajo de {activeRequest?.providerName}?</Text>

              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setRating(star)}>
                    <Ionicons
                      name={star <= rating ? "star" : "star-outline"}
                      size={50}
                      color="#f1c40f"
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.submitRatingButton, { backgroundColor: colors.primary }]}
                onPress={submitRating}
                disabled={ratingLoading}
              >
                {ratingLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitRatingText}>ENVIAR EVALUACIÓN</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </View>
    );
  }

  // VISTA PRINCIPAL (EL MAPA)
  return (
    <View style={styles.container}>
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[styles.filterChip, { backgroundColor: activeFilter === filter.id ? colors.primary : colors.card }]}
              onPress={() => {
                setActiveFilter(filter.id);
                setSelectedProvider(null);
              }}
            >
              <Text style={[styles.filterText, { color: activeFilter === filter.id ? '#fff' : colors.text }]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {location && (
        <MapView style={styles.map} region={location} showsUserLocation={true} showsMyLocationButton={true} onPress={() => setSelectedProvider(null)}>
          <UrlTile
            urlTemplate={theme === 'dark'
              ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
              : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            }
            maximumZ={19} flipY={false}
          />
          {filteredProviders.map((prov) => (
            <Marker key={prov.id} coordinate={{ latitude: prov.current_location.latitude, longitude: prov.current_location.longitude }} onPress={(e) => { e.stopPropagation(); setSelectedProvider(prov); setAcceptedTerms(false); setIsFavorite(false); }}>
              <View style={styles.markerContainer}>
                <View style={[styles.markerBubble, selectedProvider?.id === prov.id ? { backgroundColor: colors.primary } : { backgroundColor: '#ff4444' }]}>
                  <Ionicons name="construct" size={20} color="#fff" />
                </View>
                <View style={[styles.markerArrow, selectedProvider?.id === prov.id ? { backgroundColor: colors.primary } : { backgroundColor: '#ff4444' }]} />
              </View>
            </Marker>
          ))}
        </MapView>
      )}

      {selectedProvider && (
        <View style={[styles.bottomPanel, { backgroundColor: colors.card }]}>
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
            <View style={styles.statItem}><Ionicons name="briefcase" size={16} color={colors.primary} /><Text style={[styles.statText, { color: colors.text }]}>{selectedProvider.jobs} completados</Text></View>
            <View style={styles.statItem}><Ionicons name="wallet" size={16} color={colors.success} /><Text style={[styles.statText, { color: colors.text }]}>{selectedProvider.price_range}</Text></View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.termsContainer} onPress={() => setAcceptedTerms(!acceptedTerms)}>
            <Ionicons name={acceptedTerms ? "checkbox" : "square-outline"} size={24} color={acceptedTerms ? colors.primary : colors.subtext} />
            <Text style={[styles.termsText, { color: colors.subtext }]}>
              Acepto que el técnico ingrese y los <Text style={{ fontWeight: 'bold', color: colors.primary }}>Términos</Text>.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.requestButton, { backgroundColor: acceptedTerms ? colors.primary : colors.border }]}
            onPress={sendRequest}
            disabled={requestLoading || !acceptedTerms}
          >
            {requestLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.requestButtonText}>SOLICITAR SERVICIO</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { width: '100%', height: '100%' },

  filtersContainer: { position: 'absolute', top: 50, left: 0, right: 0, height: 50, zIndex: 10, paddingHorizontal: 10 },
  filterChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 10, elevation: 3, height: 35, justifyContent: 'center' },
  filterText: { fontWeight: 'bold' },

  bottomPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, borderTopLeftRadius: 25, borderTopRightRadius: 25, elevation: 20 },
  providerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  providerIcon: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  panelTitle: { fontSize: 18, fontWeight: 'bold' },
  specialtyText: { fontSize: 14, fontWeight: '500' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15, padding: 10, borderRadius: 10 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { fontWeight: 'bold' },

  divider: { height: 1, marginBottom: 15 },
  termsContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  termsText: { flex: 1, marginLeft: 10, fontSize: 12 },

  requestButton: { padding: 15, borderRadius: 12, alignItems: 'center' },
  requestButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },

  markerContainer: { alignItems: 'center' },
  markerBubble: { padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#fff', elevation: 5 },
  markerArrow: { width: 10, height: 10, transform: [{ rotate: '45deg' }], marginTop: -6, borderBottomRightRadius: 2 },

  waitingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  waitingCard: { padding: 30, borderRadius: 20, alignItems: 'center', elevation: 5, width: '100%' },
  waitingTitle: { fontSize: 22, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
  waitingText: { fontSize: 16, textAlign: 'center' },

  activeJobCard: { width: '100%', borderRadius: 20, padding: 20, elevation: 5 },
  activeHeader: { alignItems: 'center', marginBottom: 20 },
  activeTitle: { fontSize: 22, fontWeight: 'bold', marginTop: 10 },
  technicianInfo: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12 },
  avatarPlaceholder: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  techName: { fontSize: 18, fontWeight: 'bold' },
  techRole: { fontSize: 14 },
  whatsappButton: { flexDirection: 'row', padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  whatsappText: { color: '#fff', fontWeight: 'bold' },

  completedCard: { padding: 25, borderRadius: 20, alignItems: 'center', elevation: 5, width: '100%' },
  completedTitle: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  evidenceImage: { width: '100%', height: 200, borderRadius: 10, marginBottom: 20, backgroundColor: '#eee' },
  finishButton: { padding: 15, borderRadius: 10, width: '100%', alignItems: 'center' },
  finishButtonText: { color: '#fff', fontWeight: 'bold' },

  // ESTILOS NUEVOS
  cancelButton: { padding: 15, borderRadius: 12, width: '100%', alignItems: 'center', marginTop: 20 },
  cancelButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14, letterSpacing: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', padding: 25, borderRadius: 20, alignItems: 'center', elevation: 10 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  modalSubtitle: { fontSize: 16, textAlign: 'center', marginBottom: 20 },
  starsContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 30, gap: 10 },
  submitRatingButton: { padding: 15, borderRadius: 12, width: '100%', alignItems: 'center' },
  submitRatingText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});