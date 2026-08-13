import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as geofire from 'geofire-common';
import { getDistance } from 'geolib';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
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
    // Generar código OTP de 4 dígitos de seguridad
    const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();
    try {
      await addDoc(collection(db, 'service_requests'), {
        clientId: user?.uid, clientName: user?.email,
        providerId: selectedProvider.id, providerName: selectedProvider.full_name,
        status: 'PENDING', location: new GeoPoint(location.latitude, location.longitude),
        createdAt: serverTimestamp(), price_agreed: selectedProvider.price_range,
        securityPin: generatedPin,
        serviceStarted: false,
        specialty: selectedProvider.specialty || category || 'Servicio Técnico'
      });
      Toast.show({ type: 'success', text1: '¡Enviado!', text2: 'Esperando respuesta del técnico...' });
      setSelectedProvider(null);
    } catch (error) { 
      console.error("Error al enviar solicitud en mapa:", error);
      Alert.alert('Error', 'No se pudo enviar la solicitud.'); 
    } finally { 
      setRequestLoading(false); 
    }
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

  const shareServiceDetails = () => {
    if (!activeRequest) return;
    const msg = `🚨 *MONITOREO DE SERVICIO - TESISAPP LIMA*\n\nHola, estoy recibiendo un servicio en mi domicilio:\n👨‍🔧 *Técnico:* ${activeRequest.providerName}\n🛠️ *Especialidad:* ${activeRequest.specialty || 'Técnico'}\n🔐 *PIN de Seguridad:* ${activeRequest.securityPin || '----'}\n📍 *Estado:* ${activeRequest.serviceStarted ? '🟢 Trabajo en Ejecución' : '🟡 Técnico en Camino'}\n\n_Por seguridad comparto estos datos monitoreados en tiempo real._`;
    const url = `whatsapp://send?text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Aviso', 'No se pudo abrir WhatsApp. Asegúrate de tener la app instalada.');
    });
  };

  const callEmergency = () => {
    Alert.alert(
      'Central de Emergencias PNP 105',
      '¿Deseas realizar una llamada directa al 105?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Llamar 105', style: 'destructive', onPress: () => Linking.openURL('tel:105') }
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
      // 1. Actualizar el estado de la solicitud
      await updateDoc(doc(db, 'service_requests', activeRequest.id), {
        status: 'ARCHIVED',
        rating: rating,
        reviewedAt: serverTimestamp()
      });

      // 2. Actualizar las estadísticas del técnico
      if (activeRequest.providerId) {
        await updateDoc(doc(db, 'users', activeRequest.providerId), {
          total_rating: increment(rating),
          review_count: increment(1),
          jobs_completed: increment(1)
        });
      }

      Toast.show({ type: 'success', text1: '¡Gracias!', text2: 'Tu calificación nos ayuda a mantener servicios seguros.' });
      setRatingModalVisible(false);
      setActiveRequest(null);
    } catch (error) {
      console.error("Error al calificar:", error);
      Alert.alert("Error", "No se pudo enviar la calificación.");
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
              <Ionicons 
                name={activeRequest.serviceStarted ? "construct" : "shield-checkmark"} 
                size={44} 
                color={activeRequest.serviceStarted ? colors.primary : colors.success} 
              />
              <Text style={[styles.activeTitle, { color: activeRequest.serviceStarted ? colors.primary : colors.success }]}>
                {activeRequest.serviceStarted ? '¡Servicio en Ejecución! 🛠️' : '¡Técnico en camino! 🚀'}
              </Text>
              <Text style={[styles.activeSubtitle, { color: colors.subtext }]}>
                {activeRequest.serviceStarted
                  ? 'El técnico está realizando el trabajo en tu domicilio.'
                  : 'Verifica la identidad y entrega tu PIN de seguridad.'}
              </Text>
            </View>

            {/* 🔐 TARJETA DE PIN DE SEGURIDAD */}
            <View style={[styles.pinSecurityCard, { backgroundColor: theme === 'dark' ? '#1A2C36' : '#E8F5E9', borderColor: colors.success }]}>
              <View style={styles.pinHeader}>
                <Ionicons name="key" size={20} color={colors.success} />
                <Text style={[styles.pinLabel, { color: colors.success }]}>PIN DE SEGURIDAD (ENTRADA)</Text>
              </View>
              <Text style={[styles.pinValue, { color: colors.text }]}>{activeRequest.securityPin || '----'}</Text>
              <Text style={[styles.pinInstructions, { color: colors.subtext }]}>
                {activeRequest.serviceStarted
                  ? '✓ PIN validado con éxito. Inicio presencial verificado.'
                  : 'Muestra este código al técnico cuando llegue a tu puerta para iniciar el trabajo.'}
              </Text>
            </View>

            {/* INFORMACIÓN DEL TÉCNICO */}
            <View style={[styles.technicianInfo, { backgroundColor: colors.input }]}>
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                <Ionicons name="person" size={32} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.techName, { color: colors.text }]}>{activeRequest.providerName}</Text>
                  <View style={[styles.verifiedBadge, { backgroundColor: colors.success }]}>
                    <Text style={styles.verifiedBadgeText}>DNI ✓</Text>
                  </View>
                </View>
                <Text style={[styles.techRole, { color: colors.subtext }]}>{activeRequest.specialty || 'Técnico Especialista'}</Text>
              </View>
            </View>

            {/* BOTONES DE SEGURIDAD (COMPARTIR Y SOS) */}
            <View style={styles.safetyRow}>
              <TouchableOpacity
                style={[styles.safetyBtn, { backgroundColor: '#25D366' }]}
                onPress={shareServiceDetails}
              >
                <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                <Text style={styles.safetyBtnText}>Compartir</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.safetyBtn, { backgroundColor: colors.danger }]}
                onPress={callEmergency}
              >
                <Ionicons name="call" size={18} color="#fff" />
                <Text style={styles.safetyBtnText}>SOS 105</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* CHAT Y CANCELAR */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={() => router.push({ pathname: '/chat/[id]', params: { id: activeRequest.id } })}
              >
                <Ionicons name="chatbubbles" size={20} color="#fff" />
                <Text style={styles.actionBtnText}>CHAT</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.danger, borderWidth: 1, flex: 1 }]}
                onPress={cancelRequest}
              >
                <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
                <Text style={[styles.actionBtnText, { color: colors.danger }]}>CANCELAR</Text>
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
  activeHeader: { alignItems: 'center', marginBottom: 16 },
  activeTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 8 },
  activeSubtitle: { fontSize: 13, textAlign: 'center', marginTop: 4 },

  pinSecurityCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  pinHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  pinLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  pinValue: { fontSize: 32, fontWeight: '900', letterSpacing: 8, marginVertical: 4 },
  pinInstructions: { fontSize: 12, textAlign: 'center', lineHeight: 16 },

  technicianInfo: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 12 },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  techName: { fontSize: 16, fontWeight: 'bold' },
  techRole: { fontSize: 13 },
  verifiedBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  verifiedBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  safetyRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  safetyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  safetyBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

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