import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { getDistance } from 'geolib';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { ServiceMap, TechnicianMapMarker } from '../../src/components/ServiceMap';
import { auth, db } from '../../src/config/firebase';
import { useTheme } from '../../src/context/ThemeContext';

const QUEUE_STATUSES = ['PENDING_ASSIGNMENT', 'REQUIRES_REASSIGNMENT', 'PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'];

function normalize(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function distanceBetween(request: any, provider: any) {
  if (!request.location || !provider.current_location) return null;
  return getDistance(
    { latitude: request.location.latitude, longitude: request.location.longitude },
    { latitude: provider.current_location.latitude, longitude: provider.current_location.longitude }
  );
}

function providerScore(request: any, provider: any) {
  const specialty = normalize(request.specialty);
  const providerSpecialty = normalize(provider.specialty);
  const specialtyMatch = specialty.length > 0
    && providerSpecialty.length > 0
    && (providerSpecialty.includes(specialty) || specialty.includes(providerSpecialty));
  const distance = distanceBetween(request, provider);
  const rating = provider.review_count > 0 ? Number(provider.total_rating || 0) / provider.review_count : 0;
  return (specialtyMatch ? 50 : 0) + (provider.is_active ? 25 : 0) + Math.min(rating * 4, 20) + (distance === null ? 0 : Math.max(0, 15 - distance / 2000));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING_ASSIGNMENT: 'Sin asignar', REQUIRES_REASSIGNMENT: 'Reasignar', PENDING: 'Esperando técnico',
    ACCEPTED: 'En camino', IN_PROGRESS: 'En ejecución', COMPLETED: 'Por validar',
  };
  return labels[status] || status;
}

export default function OperatorHome() {
  const router = useRouter();
  const { colors } = useTheme();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [tab, setTab] = useState<'QUEUE' | 'TECHNICIANS'>('QUEUE');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    const verifyRole = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) { router.replace('/auth/login'); return; }
      const profile = await getDoc(doc(db, 'users', currentUser.uid));
      const role = profile.data()?.role;
      const allowed = role === 'OPERATOR' || role === 'ADMIN';
      setAuthorized(allowed);
      if (!allowed) {
        Alert.alert('Acceso restringido', 'Esta sección es exclusiva de la central de operaciones.');
        router.replace('/');
      }
    };
    verifyRole().catch(() => { setAuthorized(false); router.replace('/'); });
  }, [router]);

  useEffect(() => {
    if (!authorized) return;
    const requestQuery = query(collection(db, 'service_requests'), where('status', 'in', QUEUE_STATUSES));
    const providerQuery = query(collection(db, 'users'), where('role', '==', 'PROVIDER'));
    const unsubscribeRequests = onSnapshot(requestQuery, (snapshot) => {
      const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() as any }));
      items.sort((a, b) => {
        if (a.priority === 'HIGH' && b.priority !== 'HIGH') return -1;
        if (b.priority === 'HIGH' && a.priority !== 'HIGH') return 1;
        return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
      });
      setRequests(items);
    });
    const unsubscribeProviders = onSnapshot(providerQuery, (snapshot) => {
      setProviders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() as any })));
    });
    return () => { unsubscribeRequests(); unsubscribeProviders(); };
  }, [authorized]);

  const candidates = useMemo(() => {
    if (!selectedRequest) return [];
    const rejected = selectedRequest.rejectedProviderIds || [];
    return providers
      .filter((provider) => provider.is_verified !== false && provider.is_active && !rejected.includes(provider.id))
      .map((provider) => ({ ...provider, score: providerScore(selectedRequest, provider), distance: distanceBetween(selectedRequest, provider) }))
      .sort((a, b) => b.score - a.score);
  }, [providers, selectedRequest]);

  const candidateMarkers = useMemo<TechnicianMapMarker[]>(() => candidates
    .filter((provider) => provider.current_location)
    .map((provider) => ({
      id: provider.id,
      name: provider.full_name || provider.name || 'Técnico',
      description: provider.specialty || 'Técnico disponible',
      latitude: provider.current_location.latitude,
      longitude: provider.current_location.longitude,
    })), [candidates]);

  const openRequestInMaps = async () => {
    if (!selectedRequest?.location) return;
    const { latitude, longitude } = selectedRequest.location;
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('No se pudo abrir Maps', 'Verifica que el dispositivo tenga un navegador o Google Maps disponible.');
    }
  };

  const assignProvider = async (provider: any) => {
    if (!selectedRequest || assigning || !auth.currentUser) return;
    setAssigning(true);
    try {
      await runTransaction(db, async (transaction) => {
        const requestRef = doc(db, 'service_requests', selectedRequest.id);
        const snapshot = await transaction.get(requestRef);
        const currentStatus = snapshot.data()?.status;
        if (!['PENDING_ASSIGNMENT', 'REQUIRES_REASSIGNMENT'].includes(currentStatus)) {
          throw new Error('La solicitud ya fue asignada por otro operador.');
        }
        transaction.update(requestRef, {
          providerId: provider.id,
          providerName: provider.full_name || provider.name || 'Técnico',
          status: 'PENDING',
          assignedBy: auth.currentUser!.uid,
          assignedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      Toast.show({ type: 'success', text1: 'Técnico asignado', text2: 'Se enviará una notificación al dispositivo del técnico.' });
      setSelectedRequest(null);
    } catch (error: any) {
      Alert.alert('No se pudo asignar', error.message || 'Actualiza la bandeja e inténtalo nuevamente.');
    } finally {
      setAssigning(false);
    }
  };

  const validateCompletion = async (request: any) => {
    await updateDoc(doc(db, 'service_requests', request.id), { status: 'ARCHIVED', validatedBy: auth.currentUser?.uid, validatedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    Toast.show({ type: 'success', text1: 'Servicio cerrado', text2: 'La central validó la evidencia del trabajo.' });
  };

  const approveProvider = async (provider: any) => {
    await updateDoc(doc(db, 'users', provider.id), { is_verified: true, approval_status: 'APPROVED', approvedBy: auth.currentUser?.uid, approvedAt: serverTimestamp() });
    Toast.show({ type: 'success', text1: 'Técnico aprobado' });
  };

  if (authorized === null) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} size="large" /></View>;
  if (!authorized) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}><Text style={[styles.eyebrow, { color: colors.primary }]}>CENTRAL DE OPERACIONES</Text><Text style={[styles.title, { color: colors.text }]}>Maestro a Domicilio</Text></View>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.card }]} onPress={async () => { await signOut(auth); router.replace('/auth/login'); }}><Ionicons name="log-out-outline" size={23} color={colors.danger} /></TouchableOpacity>
        </View>

        <View style={styles.metrics}>
          <Metric label="Sin asignar" value={requests.filter((item) => ['PENDING_ASSIGNMENT', 'REQUIRES_REASSIGNMENT'].includes(item.status)).length} color="#E67E22" />
          <Metric label="En atención" value={requests.filter((item) => ['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(item.status)).length} color={colors.primary} />
          <Metric label="Disponibles" value={providers.filter((item) => item.is_active && item.is_verified !== false).length} color={colors.success} />
        </View>

        <View style={[styles.tabs, { backgroundColor: colors.card }]}>
          <TabButton active={tab === 'QUEUE'} label="Solicitudes" onPress={() => setTab('QUEUE')} color={colors.primary} />
          <TabButton active={tab === 'TECHNICIANS'} label="Técnicos" onPress={() => setTab('TECHNICIANS')} color={colors.primary} />
        </View>

        {tab === 'QUEUE' ? requests.map((request) => (
          <View key={request.id} style={[styles.card, { backgroundColor: colors.card, borderColor: request.priority === 'HIGH' ? '#E74C3C' : colors.border }]}>
            <View style={styles.row}><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.text }]}>{request.serviceLabel || request.specialty || 'Servicio general'}</Text><Text style={[styles.muted, { color: colors.subtext }]}>{request.clientName || 'Cliente'} · {request.district || 'Distrito pendiente'}</Text></View><View style={[styles.badge, { backgroundColor: request.status === 'REQUIRES_REASSIGNMENT' ? '#FDEDEC' : `${colors.primary}16` }]}><Text style={{ color: request.status === 'REQUIRES_REASSIGNMENT' ? '#C0392B' : colors.primary, fontWeight: '800', fontSize: 11 }}>{statusLabel(request.status)}</Text></View></View>
            {request.description ? <Text style={[styles.description, { color: colors.text }]}>{request.description}</Text> : null}
            {request.issuePhoto ? <Image source={{ uri: request.issuePhoto }} style={styles.issuePhoto} /> : null}
            <Text style={[styles.muted, { color: colors.subtext }]}><Ionicons name="location-outline" /> {request.address || 'Sin dirección registrada'}</Text>
            {['PENDING_ASSIGNMENT', 'REQUIRES_REASSIGNMENT'].includes(request.status) ? <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={() => setSelectedRequest(request)}><Text style={styles.primaryText}>Seleccionar técnico</Text></TouchableOpacity> : null}
            {request.providerName ? <View style={[styles.assignment, { backgroundColor: colors.background }]}><Ionicons name="person-circle-outline" size={22} color={colors.primary} /><Text style={{ color: colors.text, fontWeight: '700' }}>{request.providerName}</Text></View> : null}
            {request.status === 'COMPLETED' ? <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.success }]} onPress={() => validateCompletion(request)}><Text style={styles.primaryText}>Validar y cerrar servicio</Text></TouchableOpacity> : null}
          </View>
        )) : providers.map((provider) => (
          <View key={provider.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.row}><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.text }]}>{provider.full_name || provider.name}</Text><Text style={[styles.muted, { color: colors.subtext }]}>{provider.specialty || 'Especialidad pendiente'}</Text></View><View style={[styles.onlineDot, { backgroundColor: provider.is_active ? colors.success : colors.border }]} /></View>
            {provider.is_verified === false ? <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={() => approveProvider(provider)}><Text style={styles.primaryText}>Aprobar técnico</Text></TouchableOpacity> : <Text style={{ color: colors.success, fontWeight: '700', marginTop: 10 }}>✓ Técnico verificado</Text>}
          </View>
        ))}
      </ScrollView>

      {selectedRequest ? <View style={styles.overlay}><View style={[styles.sheet, { backgroundColor: colors.card }]}><View style={styles.row}><View style={{ flex: 1 }}><Text style={[styles.sheetTitle, { color: colors.text }]}>Técnicos recomendados</Text><Text style={[styles.muted, { color: colors.subtext }]}>Ordenados por compatibilidad, disponibilidad y distancia.</Text></View><TouchableOpacity onPress={() => setSelectedRequest(null)}><Ionicons name="close-circle" size={30} color={colors.subtext} /></TouchableOpacity></View>{selectedRequest.location ? <><View style={styles.dispatchMapFrame}><ServiceMap location={{ latitude: selectedRequest.location.latitude, longitude: selectedRequest.location.longitude }} technicians={candidateMarkers} style={styles.dispatchMap} /></View><TouchableOpacity style={styles.mapsLink} onPress={openRequestInMaps}><Ionicons name="navigate-outline" size={17} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '800' }}>Abrir ubicación del cliente en Maps</Text></TouchableOpacity></> : <View style={[styles.noLocation, { backgroundColor: colors.background }]}><Ionicons name="location-outline" size={20} color={colors.subtext} /><Text style={[styles.muted, { color: colors.subtext }]}>Esta solicitud no tiene coordenadas confirmadas.</Text></View>}<ScrollView style={{ maxHeight: 300 }}>{candidates.map((provider, index) => <TouchableOpacity key={provider.id} style={[styles.candidate, { borderColor: colors.border }]} onPress={() => assignProvider(provider)} disabled={assigning}><View style={[styles.rank, { backgroundColor: `${colors.primary}18` }]}><Text style={{ color: colors.primary, fontWeight: '900' }}>{index + 1}</Text></View><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '800' }}>{provider.full_name || provider.name}</Text><Text style={[styles.muted, { color: colors.subtext }]}>{provider.specialty || 'Sin especialidad'} · {provider.is_active ? 'Disponible' : 'No disponible'}</Text><Text style={[styles.muted, { color: colors.subtext }]}>{provider.distance === null ? 'Distancia no disponible' : `${(provider.distance / 1000).toFixed(1)} km`} · Compatibilidad {Math.round(provider.score)}%</Text></View><Ionicons name="chevron-forward" size={20} color={colors.primary} /></TouchableOpacity>)}</ScrollView></View></View> : null}
    </View>
  );
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) { return <View style={[styles.metric, { borderTopColor: color }]}><Text style={[styles.metricValue, { color }]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function TabButton({ active, label, onPress, color }: { active: boolean; label: string; onPress: () => void; color: string }) { return <TouchableOpacity style={[styles.tab, active && { backgroundColor: `${color}18` }]} onPress={onPress}><Text style={{ color: active ? color : '#7B8794', fontWeight: '800' }}>{label}</Text></TouchableOpacity>; }

const styles = StyleSheet.create({
  container: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, content: { width: '100%', maxWidth: 980, alignSelf: 'center', padding: 18, paddingTop: Platform.OS === 'android' ? 50 : 62, paddingBottom: 50 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 }, eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4 }, title: { fontSize: 27, fontWeight: '900', marginTop: 3 }, iconButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  metrics: { flexDirection: 'row', gap: 10, marginBottom: 16 }, metric: { flex: 1, backgroundColor: '#fff', borderRadius: 15, padding: 13, borderTopWidth: 4 }, metricValue: { fontSize: 25, fontWeight: '900' }, metricLabel: { color: '#687481', fontSize: 11, fontWeight: '700' },
  tabs: { flexDirection: 'row', borderRadius: 15, padding: 4, marginBottom: 14 }, tab: { flex: 1, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, cardTitle: { fontSize: 17, fontWeight: '900' }, muted: { fontSize: 12, lineHeight: 18 }, description: { fontSize: 14, lineHeight: 20, marginVertical: 12 }, badge: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6 }, issuePhoto: { width: '100%', height: 170, borderRadius: 13, marginBottom: 12 },
  primaryButton: { height: 45, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 13 }, primaryText: { color: '#fff', fontWeight: '900' }, assignment: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 11, borderRadius: 12, marginTop: 12 }, onlineDot: { width: 12, height: 12, borderRadius: 6 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,.55)', justifyContent: 'flex-end' }, sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 32 }, sheetTitle: { fontSize: 20, fontWeight: '900' }, candidate: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1 }, rank: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dispatchMapFrame: { height: 205, borderRadius: 16, overflow: 'hidden', marginTop: 14 }, dispatchMap: { width: '100%', height: '100%' }, mapsLink: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, noLocation: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginTop: 12 },
});
