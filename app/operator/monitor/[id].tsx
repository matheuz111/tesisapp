import { useLocalSearchParams, useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ServiceMap, TechnicianMapMarker } from '../../../src/components/ServiceMap';
import { auth, db } from '../../../src/config/firebase';
import { useTheme } from '../../../src/context/ThemeContext';
import { locationStatus, validCoordinate as coordinate } from '../../../src/services/monitoring';

export default function ServiceMonitor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState(auth.currentUser);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [request, setRequest] = useState<any>(null);
  const [locations, setLocations] = useState<Record<string, any>>({});
  const [messages, setMessages] = useState<any[]>([]);
  const [pageSize, setPageSize] = useState(50);
  const [loadingChat, setLoadingChat] = useState(true);
  const [error, setError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [chatError, setChatError] = useState('');
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [image, setImage] = useState<string | null>(null);
  useEffect(() => onAuthStateChanged(auth, (next) => { setUser(next); setAllowed(null); setRequest(null); setMessages([]); setLocations({}); }), []);
  useEffect(() => {
    if (!user) { setAllowed(false); return; }
    return onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      setAllowed(['ADMIN', 'OPERATOR'].includes(snapshot.data()?.role));
    }, () => setAllowed(false));
  }, [user]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setRequest(null); setLocations({}); setError(''); setPageSize(50);
    if (!allowed) return;
    if (typeof id !== 'string' || !id || id.includes('/')) { setError('Servicio inválido.'); return; }
    const stopRequest = onSnapshot(doc(db, 'service_requests', id), { includeMetadataChanges: true }, (snapshot) => {
      setOffline(snapshot.metadata.fromCache);
      if (!snapshot.exists()) { setRequest(null); setError('El servicio no existe o ya no está disponible.'); return; }
      setError(''); setRequest(snapshot.data());
    }, () => { setRequest(null); setError('No se pudo consultar el servicio. Revisa tu acceso y conexión.'); });
    const stopLocations = onSnapshot(collection(db, 'service_requests', id, 'locations'), (snapshot) => {
      setLocationError('');
      setLocations(Object.fromEntries(snapshot.docs.map((item) => [item.id, item.data()])));
    }, () => { setLocations({}); setLocationError('No se pudo consultar el GPS. Comprueba conexión y reglas de Firestore.'); });
    return () => { stopRequest(); stopLocations(); };
  }, [allowed, id]);
  useEffect(() => {
    if (!allowed || typeof id !== 'string' || !id || id.includes('/')) return;
    setLoadingChat(true); setChatError('');
    return onSnapshot(query(collection(db, 'service_requests', id, 'messages'), orderBy('createdAt', 'desc'), limit(pageSize)), (snapshot) => {
      setMessages(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setLoadingChat(false);
    }, () => { setMessages([]); setLoadingChat(false); setChatError('No se pudo consultar la conversación. Revisa conexión y permisos.'); });
  }, [allowed, id, pageSize]);

  const back = <TouchableOpacity onPress={() => router.replace('/operator/home')} style={styles.button}><Text style={{ color: colors.primary, fontWeight: '800' }}>‹ Volver a la central</Text></TouchableOpacity>;
  if (allowed === null) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!allowed || error) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={{ color: colors.text }}>{error || 'Acceso exclusivo para ADMIN y OPERATOR.'}</Text>{back}</View>;
  const people = request ? [
    { id: request.clientId, label: 'Cliente', name: request.clientName || 'Cliente', color: '#138A50' },
    { id: request.providerId, label: 'Trabajador', name: request.providerName || 'Sin técnico asignado', color: '#1677FF' },
  ] : [];
  const markers: TechnicianMapMarker[] = people.filter((person) => person.id && coordinate(locations[person.id])).map((person) => ({
    id: person.id, name: `${person.label}: ${person.name}`, color: person.color,
    latitude: locations[person.id].latitude, longitude: locations[person.id].longitude,
    description: locationStatus(locations[person.id], now),
  }));
  return <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
    <ScrollView contentContainerStyle={styles.content}>
      {back}
      <Text style={[styles.title, { color: colors.text }]}>Monitoreo del servicio</Text>
      {offline ? <Text style={styles.warning}>Sin confirmación del servidor. Los datos pueden estar desactualizados.</Text> : null}
      {!request ? <ActivityIndicator /> : <>
        <Text style={{ color: colors.subtext }}>{request.serviceLabel || request.specialty} · {request.status}</Text>
        <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 20 }}>{request.price_agreed || 'Tarifa pendiente'}</Text>
        <Text style={{ color: colors.subtext }}>{request.pricing?.description || ''}</Text>
        <Text selectable style={{ color: colors.subtext }}>Servicio: {id}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.heading, { color: colors.text }]}>Ubicaciones</Text>
          <Text style={{ color: colors.subtext }}>Rojo: domicilio del servicio · Verde: cliente · Azul: trabajador</Text>
          <ServiceMap location={coordinate(request.location) ? request.location : null} technicians={markers} style={styles.map} />
          <Text style={{ color: colors.subtext }}>{request.address || 'Sin dirección registrada'}</Text>
          {people.map((person) => <View key={person.label} style={{ marginTop: 14 }}>
            <Text style={{ color: person.color, fontWeight: '800' }}>{person.label}: {person.name}</Text>
            <Text style={{ color: colors.subtext }}>{locationStatus(locations[person.id], now)}</Text>
          </View>)}
          {locationError ? <Text style={styles.warning}>{locationError}</Text> : null}
          <Text style={[styles.note, { color: colors.subtext }]}>GPS actualizado mientras cada participante comparte su ubicación con la app abierta. Una posición antigua no confirma dónde se encuentra ahora.</Text>
        </View>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.heading, { color: colors.text }]}>Chat cliente ↔ trabajador</Text>
          <Text style={{ color: colors.subtext }}>En vivo · Solo lectura · Mensajes más recientes primero</Text>
          {loadingChat ? <ActivityIndicator /> : null}
          {chatError ? <Text style={styles.warning}>{chatError}</Text> : !loadingChat && !messages.length ? <Text style={[styles.note, { color: colors.subtext }]}>Todavía no hay mensajes.</Text> : null}
          {messages.map((message) => {
            const sender = people.find((person) => person.id === message.senderId);
            return <View key={message.id} style={[styles.message, { backgroundColor: colors.background, borderLeftColor: sender?.color || colors.subtext }]}>
              <Text style={{ color: sender?.color || colors.subtext, fontWeight: '800' }}>{sender ? `${sender.label}: ${sender.name}` : 'Otro participante / central'}</Text>
              {message.type === 'image' && message.mediaUrl ? <TouchableOpacity accessibilityLabel="Ampliar imagen del chat" onPress={() => setImage(message.mediaUrl)}><Image source={{ uri: message.mediaUrl }} style={styles.thumbnail} resizeMode="contain" /></TouchableOpacity> : null}
              {message.text ? <Text selectable style={{ color: colors.text, marginTop: 6 }}>{message.text}</Text> : null}
              <Text style={[styles.note, { color: colors.subtext }]}>{message.createdAt?.toDate?.().toLocaleString('es-PE') || 'Enviando…'}</Text>
            </View>;
          })}
          {messages.length === pageSize ? <TouchableOpacity disabled={loadingChat} onPress={() => setPageSize((value) => value + 50)} style={styles.button}><Text style={{ color: colors.primary }}>Cargar mensajes anteriores</Text></TouchableOpacity> : null}
        </View>
      </>}
    </ScrollView>
    <Modal visible={!!image} onRequestClose={() => setImage(null)} animationType="fade">
      <View style={[styles.container, { backgroundColor: '#111', paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <TouchableOpacity style={styles.button} onPress={() => setImage(null)}><Text style={{ color: '#fff' }}>Cerrar imagen</Text></TouchableOpacity>
        {image ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flex: 1, justifyContent: 'center' }}
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <Image source={{ uri: image }} resizeMode="contain" style={{ flex: 1, width: '100%' }} />
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { padding: 18, width: '100%', maxWidth: 980, alignSelf: 'center' },
  title: { fontSize: 26, fontWeight: '900', marginBottom: 10 }, heading: { fontSize: 19, fontWeight: '800', marginBottom: 8 },
  card: { padding: 16, borderRadius: 16, marginTop: 16 }, map: { height: 300, marginVertical: 12 },
  note: { fontSize: 12, marginTop: 8 }, warning: { color: '#B45309', marginVertical: 10 },
  button: { paddingVertical: 14, paddingHorizontal: 8 },
  message: { padding: 12, borderRadius: 10, borderLeftWidth: 4, marginTop: 12 }, thumbnail: { height: 200, width: '100%', marginTop: 8 },
});
