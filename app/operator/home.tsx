import CustomAlert, { useCustomAlert } from '../../components/CustomAlert';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOutWithNotifications } from '../../utils/pushNotifications';
import { collection, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { getDistance } from 'geolib';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { ServiceMap, TechnicianMapMarker } from '../../src/components/ServiceMap';
import { auth, db } from '../../src/config/firebase';
import { useTheme } from '../../src/context/ThemeContext';
import { useSession } from '../../src/context/SessionContext';
import { queueDemoPushNotification as sendDemoPushNotification } from '../../src/services/demoPushService';
import { formatPrice, parsePriceCents } from '../../src/services/pricing';
import { withTimeout } from '../../src/services/async';

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
  const { user, profile, loading: profileLoading, error: profileError, retry } = useSession();
  const authorized = profile?.role === 'OPERATOR' || profile?.role === 'ADMIN';
  const { alertProps, showAlert } = useCustomAlert();
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [feedAttempt, setFeedAttempt] = useState(0);
  const [requests, setRequests] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [tab, setTab] = useState<'QUEUE' | 'TECHNICIANS'>('QUEUE');
  const [assigning, setAssigning] = useState(false);
  const [pricingRequest, setPricingRequest] = useState<any>(null);
  const [priceInput, setPriceInput] = useState('');
  const [priceDescription, setPriceDescription] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);

  const savePrice = async () => {
    const amountCents = parsePriceCents(priceInput);
    if (!amountCents || !priceDescription.trim()) { showAlert({ title: 'Tarifa inválida', message: 'Ingresa un importe positivo en soles, con hasta dos decimales, y el alcance del servicio.', type: 'warning' }); return; }
    if (savingPrice || !auth.currentUser || !pricingRequest) return;
    setSavingPrice(true);
    try {
      await runTransaction(db, async (transaction) => {
        const ref = doc(db, 'service_requests', pricingRequest.id);
        const snapshot = await transaction.get(ref);
        const data = snapshot.data();
        if (!data || !['PENDING_ASSIGNMENT', 'REQUIRES_REASSIGNMENT', 'PENDING'].includes(data.status)) throw new Error('La tarifa queda bloqueada cuando el trabajador acepta.');
        if ((data.pricing?.version || 0) !== (pricingRequest.pricing?.version || 0)) throw new Error('Otro operador cambió la tarifa. Vuelve a abrirla.');
        const pricing = { amountCents, currency: 'PEN', description: priceDescription.trim(), assignedBy: auth.currentUser!.uid, updatedAt: serverTimestamp(), version: (data.pricing?.version || 0) + 1 };
        transaction.update(ref, { pricing, price_agreed: formatPrice(amountCents), updatedAt: serverTimestamp() });
        transaction.set(doc(collection(ref, 'price_history')), pricing);
      });
      await sendDemoPushNotification(pricingRequest.notificationTokens?.client, 'Tarifa de tu servicio', `La central cotizó ${formatPrice(amountCents)}. Revisa el alcance en la app.`, { requestId: pricingRequest.id, screen: 'client_home', type: 'PRICED' });
      if (pricingRequest.providerId) await sendDemoPushNotification(pricingRequest.notificationTokens?.provider, 'Tarifa actualizada por la central', formatPrice(amountCents), { requestId: pricingRequest.id, screen: 'provider_home', type: 'PRICED' });
      setPricingRequest(null);
      Toast.show({ type: 'success', text1: 'Tarifa guardada por la central' });
    } catch (error: any) { showAlert({ title: 'No se pudo guardar', message: error.message, type: 'error' }); }
    finally { setSavingPrice(false); }
  };

  useEffect(() => {
    setRequests([]); setProviders([]); setSelectedRequest(null); setPricingRequest(null); setFeedError(null);
    if (!authorized || !user) return;
    let active = true;
    const handleError = (error: Error) => {
      if (!active || auth.currentUser?.uid !== user.uid) return;
      console.warn('No se pudo actualizar la central:', error.message);
      setFeedError('No se pudo actualizar la bandeja. Revisa la conexión y vuelve a intentar.');
    };
    const requestQuery = query(collection(db, 'service_requests'), where('status', 'in', QUEUE_STATUSES));
    const providerQuery = query(collection(db, 'users'), where('role', '==', 'PROVIDER'));
    const unsubscribeRequests = onSnapshot(requestQuery, (snapshot) => {
      if (!active || auth.currentUser?.uid !== user.uid) return;
      const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() as any }));
      items.sort((a, b) => {
        if (a.priority === 'HIGH' && b.priority !== 'HIGH') return -1;
        if (b.priority === 'HIGH' && a.priority !== 'HIGH') return 1;
        return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
      });
      setRequests(items);
    }, handleError);
    const unsubscribeProviders = onSnapshot(providerQuery, (snapshot) => {
      if (!active || auth.currentUser?.uid !== user.uid) return;
      setProviders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() as any })));
    }, handleError);
    return () => { active = false; unsubscribeRequests(); unsubscribeProviders(); };
  }, [authorized, user, feedAttempt]);

  const candidates = useMemo(() => {
    if (!selectedRequest) return [];
    const rejected = selectedRequest.rejectedProviderIds || [];
    return providers
      .filter((provider) => provider.is_verified !== false && provider.is_active && !rejected.includes(provider.id))
      .filter((provider) => !requests.some((item) => item.providerId === provider.id && ['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(item.status)))
      .map((provider) => ({ ...provider, score: providerScore(selectedRequest, provider), distance: distanceBetween(selectedRequest, provider) }))
      .sort((a, b) => b.score - a.score);
  }, [providers, selectedRequest, requests]);

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
      showAlert({ title: 'No se pudo abrir Maps', message: 'Verifica que el dispositivo tenga un navegador o Google Maps disponible.', type: 'error' });
    }
  };

  const assignProvider = async (provider: any) => {
    if (!selectedRequest || assigning || !auth.currentUser) return;
    setAssigning(true);
    try {
      // 1. Obtener tokens push registrados para el técnico que se va a asignar
      let providerTokens: string[] = [];
      try {
        const tokenSnap = await withTimeout(getDoc(doc(db, 'push_tokens', provider.id)), 4000);
        if (tokenSnap.exists()) {
          providerTokens = tokenSnap.data()?.tokens || [];
        }
      } catch (tokenErr) {
        console.warn('No se pudo leer el token del técnico:', tokenErr);
      }

      await runTransaction(db, async (transaction) => {
        const requestRef = doc(db, 'service_requests', selectedRequest.id);
        const snapshot = await transaction.get(requestRef);
        const providerRef = doc(db, 'users', provider.id);
        const providerSnapshot = await transaction.get(providerRef);
        const lockedId = providerSnapshot.data()?.activeRequestId;
        const lockedRequest = lockedId ? await transaction.get(doc(db, 'service_requests', lockedId)) : null;
        if (lockedRequest?.exists() && ['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(lockedRequest.data()?.status)) throw new Error('El técnico ya tiene un servicio asignado.');
        if (!providerSnapshot.data()?.is_active || providerSnapshot.data()?.is_verified === false) throw new Error('El técnico ya no está disponible.');
        if (!snapshot.data()?.pricing?.amountCents) throw new Error('La central debe fijar una tarifa antes de asignar al trabajador.');
        const currentStatus = snapshot.data()?.status;
        if (!['PENDING_ASSIGNMENT', 'REQUIRES_REASSIGNMENT'].includes(currentStatus)) {
          throw new Error('La solicitud ya fue asignada por otro operador.');
        }

        const existingTokens = snapshot.data()?.notificationTokens || {};

        transaction.update(requestRef, {
          providerId: provider.id,
          providerName: provider.full_name || provider.name || 'Técnico',
          notificationTokens: {
            ...existingTokens,
            provider: providerTokens,
          },
          status: 'PENDING',
          assignedBy: auth.currentUser!.uid,
          assignedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        transaction.update(providerRef, { activeRequestId: selectedRequest.id });
      });

      // 2. Enviar notificación push directa al técnico (en modo demo-direct)
      if (providerTokens.length > 0) {
        const serviceType = selectedRequest.serviceLabel || selectedRequest.specialty || 'un servicio';
        const clientName = selectedRequest.clientName || 'Un cliente';
        const districtName = selectedRequest.district || 'Lima';

        sendDemoPushNotification(
          providerTokens,
          'Nuevo servicio asignado 🔧',
          `${clientName} solicita ${serviceType} en ${districtName}.`,
          {
            requestId: selectedRequest.id,
            screen: 'provider_home',
            type: 'ASSIGNED',
          },
          {
            requestId: selectedRequest.id,
            eventType: 'ASSIGNED',
          }
        ).catch(() => {});
      }

      Toast.show({ type: 'success', text1: 'Técnico asignado', text2: 'Se enviará una notificación al dispositivo del técnico.' });
      await sendDemoPushNotification(selectedRequest.notificationTokens?.client, 'Técnico seleccionado', `${provider.full_name || provider.name || 'Un técnico'} fue asignado a tu servicio.`, { requestId: selectedRequest.id, screen: 'client_home', type: 'PROVIDER_ASSIGNED' });
      setSelectedRequest(null);
    } catch (error: any) {
      showAlert({ title: 'No se pudo asignar', message: error.message || 'Actualiza la bandeja e inténtalo nuevamente.', type: 'error' });
    } finally {
      setAssigning(false);
    }
  };

  const validateCompletion = async (request: any) => {
    try {
      await runTransaction(db, async (transaction) => {
        const ref = doc(db, 'service_requests', request.id);
        const snapshot = await transaction.get(ref);
        if (snapshot.data()?.status !== 'COMPLETED') throw new Error('El servicio ya no está pendiente de validación.');
        if (!snapshot.data()?.evidence_photo) throw new Error('Este servicio no tiene evidencia. Solicita al trabajador que la complete antes de cerrarlo.');
        transaction.update(ref, { status: 'ARCHIVED', validatedBy: auth.currentUser?.uid, validatedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      });
      await sendDemoPushNotification(request.notificationTokens?.client, 'Servicio validado', 'La central revisó la evidencia y cerró tu servicio.', { requestId: request.id, screen: 'client_home', type: 'ARCHIVED' });
      Toast.show({ type: 'success', text1: 'Servicio cerrado', text2: 'La central validó la evidencia del trabajo.' });
    } catch (error: any) { showAlert({ title: 'No se pudo cerrar', message: error.message, type: 'error' }); }
  };

  const approveProvider = async (provider: any) => {
    await updateDoc(doc(db, 'users', provider.id), { is_verified: true, approval_status: 'APPROVED', approvedBy: auth.currentUser?.uid, approvedAt: serverTimestamp() });
    Toast.show({ type: 'success', text1: 'Técnico aprobado' });
  };

  if (profileLoading || !authorized) return <View style={[styles.center, { backgroundColor: colors.background }]}>{profileLoading ? <ActivityIndicator color={colors.primary} size="large" /> : <Text style={{ color: colors.text }}>{profileError || 'Esta cuenta no tiene acceso a la central.'}</Text>}<TouchableOpacity style={{ padding: 16 }} onPress={() => router.push('/profile')}><Text style={{ color: colors.primary }}>Abrir mi perfil</Text></TouchableOpacity>{profileError ? <TouchableOpacity style={{ padding: 16 }} onPress={retry}><Text style={{ color: colors.primary }}>Volver a intentar</Text></TouchableOpacity> : null}</View>;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}><Text style={[styles.eyebrow, { color: colors.primary }]}>CENTRAL DE OPERACIONES</Text><Text style={[styles.title, { color: colors.text }]}>Maestro a Domicilio</Text></View>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.card }]} onPress={async () => {
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
                    try { await signOutWithNotifications(); router.replace('/auth/login'); }
                    catch { showAlert({ title: 'No se pudo cerrar sesión', message: 'Revisa tu conexión e intenta nuevamente.', type: 'error' }); }
                  },
                },
              ],
            });
          }}><Ionicons name="log-out-outline" size={23} color={colors.danger} /></TouchableOpacity>
        </View>

        {feedError ? <View style={{ padding: 12, backgroundColor: colors.card }}><Text style={{ color: colors.text }}>{feedError}</Text><TouchableOpacity style={{ paddingVertical: 10 }} onPress={() => setFeedAttempt((value) => value + 1)}><Text style={{ color: colors.primary }}>Volver a intentar</Text></TouchableOpacity></View> : null}
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
            {request.issuePhoto ? <TouchableOpacity onPress={() => setZoomImage(request.issuePhoto)} activeOpacity={0.85}><Image source={{ uri: request.issuePhoto }} style={styles.issuePhoto} /></TouchableOpacity> : null}
            <Text style={[styles.muted, { color: colors.subtext }]}><Ionicons name="location-outline" /> {request.address || 'Sin dirección registrada'}</Text>
            {request.addressReference ? <Text style={{ color: colors.subtext }}>{request.addressReference}</Text> : null}
            <Text style={[styles.cardTitle, { color: colors.primary, marginTop: 12 }]}>{request.price_agreed || 'Tarifa pendiente'}</Text>
            {request.pricing?.description ? <Text style={{ color: colors.subtext }}>{request.pricing.description}</Text> : null}
            {['PENDING_ASSIGNMENT', 'REQUIRES_REASSIGNMENT', 'PENDING'].includes(request.status) ? <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={() => { setPricingRequest(request); setPriceInput(request.pricing ? (request.pricing.amountCents / 100).toFixed(2) : ''); setPriceDescription(request.pricing?.description || ''); }}><Text style={styles.primaryText}>{request.pricing ? 'Editar tarifa de la empresa' : 'Asignar tarifa de la empresa'}</Text></TouchableOpacity> : null}
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={() => router.push({ pathname: '/operator/monitor/[id]' as any, params: { id: request.id } })}><Text style={styles.primaryText}>Monitorear ubicación y chat</Text></TouchableOpacity>
            {['PENDING_ASSIGNMENT', 'REQUIRES_REASSIGNMENT'].includes(request.status) ? <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={() => setSelectedRequest(request)}><Text style={styles.primaryText}>Seleccionar técnico</Text></TouchableOpacity> : null}
            {request.providerName ? <View style={[styles.assignment, { backgroundColor: colors.background }]}><Ionicons name="person-circle-outline" size={22} color={colors.primary} /><Text style={{ color: colors.text, fontWeight: '700' }}>{request.providerName}</Text></View> : null}
            {request.status === 'COMPLETED' ? (
              <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontWeight: '800', color: colors.text, marginBottom: 6 }}>Supervisión de Cierre y Cobro</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons
                    name={request.paymentStatus === 'CONFIRMED' ? 'checkmark-circle' : request.paymentStatus === 'PAID' ? 'time-outline' : 'alert-circle-outline'}
                    size={18}
                    color={request.paymentStatus === 'CONFIRMED' ? colors.success : '#f39c12'}
                  />
                  <Text style={{ fontSize: 13, color: colors.text, fontWeight: '600' }}>
                    Pago: {request.paymentStatus === 'CONFIRMED' ? 'Confirmado por técnico' : request.paymentStatus === 'PAID' ? 'Comprobante reportado' : 'Pendiente de pago'}
                    {request.paymentMethod ? ` (${request.paymentMethod})` : ''}
                  </Text>
                </View>
                {request.paymentVoucher ? (
                  <View style={{ marginVertical: 6 }}>
                    <Text style={{ color: colors.subtext, fontSize: 12, marginBottom: 4 }}>Comprobante de pago enviado:</Text>
                    <TouchableOpacity onPress={() => setZoomImage(request.paymentVoucher)} activeOpacity={0.85}>
                      <Image source={{ uri: request.paymentVoucher }} resizeMode="contain" style={styles.issuePhoto} />
                    </TouchableOpacity>
                  </View>
                ) : null}
                {request.rating_given ? (
                  <View style={{ marginVertical: 4 }}>
                    <Text style={{ fontSize: 12, color: colors.subtext }}>
                      Calificación del cliente: {'⭐'.repeat(request.rating_given)} ({request.rating_given}/5)
                    </Text>
                    {request.review_comment ? (
                      <Text style={{ fontSize: 12, fontStyle: 'italic', color: colors.text }}>"{request.review_comment}"</Text>
                    ) : null}
                  </View>
                ) : null}
                <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.success, marginTop: 8 }]} onPress={() => validateCompletion(request)}>
                  <Text style={styles.primaryText}>Validar evidencia y cerrar servicio</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {request.evidence_photo ? <>
              <Text style={{ color: colors.subtext, marginTop: 12 }}>Evidencia del trabajo</Text>
              <TouchableOpacity onPress={() => setZoomImage(request.evidence_photo)} activeOpacity={0.85}>
                <Image source={{ uri: request.evidence_photo }} resizeMode="contain" style={styles.issuePhoto} />
              </TouchableOpacity>
            </> : null}
          </View>
        )) : providers.map((provider) => (
          <View key={provider.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.row}><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.text }]}>{provider.full_name || provider.name}</Text><Text style={[styles.muted, { color: colors.subtext }]}>{provider.specialty || 'Especialidad pendiente'}</Text></View><View style={[styles.onlineDot, { backgroundColor: provider.is_active ? colors.success : colors.border }]} /></View>
            {provider.is_verified === false ? <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={() => approveProvider(provider)}><Text style={styles.primaryText}>Aprobar técnico</Text></TouchableOpacity> : <Text style={{ color: colors.success, fontWeight: '700', marginTop: 10 }}>✓ Técnico verificado</Text>}
          </View>
        ))}
      </ScrollView>
      <Modal visible={!!pricingRequest} transparent animationType="slide" onRequestClose={() => { if (!savingPrice) setPricingRequest(null); }}>
        <View style={styles.overlay}><View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Tarifa de la empresa</Text>
          <Text style={{ color: colors.subtext }}>Precio total del servicio en soles. Queda fijo cuando el trabajador acepta.</Text>
          <TextInput accessibilityLabel="Importe total en soles" placeholder="Ej. 85.00" placeholderTextColor={colors.subtext} keyboardType="decimal-pad" value={priceInput} onChangeText={setPriceInput} style={{ padding: 14, borderWidth: 1, borderColor: colors.border, color: colors.text, borderRadius: 12, marginTop: 14 }} />
          <TextInput accessibilityLabel="Alcance de la tarifa" placeholder="Incluye visita y mano de obra; materiales…" placeholderTextColor={colors.subtext} value={priceDescription} onChangeText={setPriceDescription} maxLength={300} multiline style={{ padding: 14, borderWidth: 1, borderColor: colors.border, color: colors.text, borderRadius: 12, marginTop: 14 }} />
          <TouchableOpacity disabled={savingPrice} style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={savePrice}>{savingPrice ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Guardar tarifa</Text>}</TouchableOpacity>
          <TouchableOpacity disabled={savingPrice} style={styles.primaryButton} onPress={() => setPricingRequest(null)}><Text style={{ color: colors.subtext }}>Volver</Text></TouchableOpacity>
        </View></View>
      </Modal>

      {selectedRequest ? <View style={styles.overlay}><View style={[styles.sheet, { backgroundColor: colors.card }]}><View style={styles.row}><View style={{ flex: 1 }}><Text style={[styles.sheetTitle, { color: colors.text }]}>Técnicos recomendados</Text><Text style={[styles.muted, { color: colors.subtext }]}>Ordenados por compatibilidad, disponibilidad y distancia.</Text></View><TouchableOpacity onPress={() => setSelectedRequest(null)}><Ionicons name="close-circle" size={30} color={colors.subtext} /></TouchableOpacity></View>{selectedRequest.location ? <><View style={styles.dispatchMapFrame}><ServiceMap location={{ latitude: selectedRequest.location.latitude, longitude: selectedRequest.location.longitude }} technicians={candidateMarkers} style={styles.dispatchMap} /></View><TouchableOpacity style={styles.mapsLink} onPress={openRequestInMaps}><Ionicons name="navigate-outline" size={17} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '800' }}>Abrir ubicación del cliente en Maps</Text></TouchableOpacity></> : <View style={[styles.noLocation, { backgroundColor: colors.background }]}><Ionicons name="location-outline" size={20} color={colors.subtext} /><Text style={[styles.muted, { color: colors.subtext }]}>Esta solicitud no tiene coordenadas confirmadas.</Text></View>}<ScrollView style={{ maxHeight: 300 }}>{candidates.map((provider, index) => <TouchableOpacity key={provider.id} style={[styles.candidate, { borderColor: colors.border }]} onPress={() => assignProvider(provider)} disabled={assigning}><View style={[styles.rank, { backgroundColor: `${colors.primary}18` }]}><Text style={{ color: colors.primary, fontWeight: '900' }}>{index + 1}</Text></View><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '800' }}>{provider.full_name || provider.name}</Text><Text style={[styles.muted, { color: colors.subtext }]}>{provider.specialty || 'Sin especialidad'} · {provider.is_active ? 'Disponible' : 'No disponible'}</Text><Text style={[styles.muted, { color: colors.subtext }]}>{provider.distance === null ? 'Distancia no disponible' : `${(provider.distance / 1000).toFixed(1)} km`} · Compatibilidad {Math.round(provider.score)}%</Text></View><Ionicons name="chevron-forward" size={20} color={colors.primary} /></TouchableOpacity>)}</ScrollView></View></View> : null}

      {/* ── Modal de zoom de imágenes ── */}
      <Modal visible={!!zoomImage} onRequestClose={() => setZoomImage(null)} animationType="fade" statusBarTranslucent>
        <View style={styles.zoomContainer}>
          <TouchableOpacity style={styles.zoomClose} onPress={() => setZoomImage(null)} accessibilityLabel="Cerrar imagen">
            <View style={styles.zoomCloseBtn}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>✕</Text>
            </View>
          </TouchableOpacity>
          {zoomImage ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ flex: 1, justifyContent: 'center' }}
              maximumZoomScale={4}
              minimumZoomScale={1}
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image source={{ uri: zoomImage }} style={styles.zoomImage} resizeMode="contain" />
            </ScrollView>
          ) : null}
        </View>
      </Modal>

      <CustomAlert {...alertProps} />
    </View>
  );
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.metric, { backgroundColor: colors.card, borderTopColor: color }]}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.subtext }]}>{label}</Text>
    </View>
  );
}
function TabButton({ active, label, onPress, color }: { active: boolean; label: string; onPress: () => void; color: string }) { return <TouchableOpacity style={[styles.tab, active && { backgroundColor: `${color}18` }]} onPress={onPress}><Text style={{ color: active ? color : '#7B8794', fontWeight: '800' }}>{label}</Text></TouchableOpacity>; }

const styles = StyleSheet.create({
  container: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, content: { width: '100%', maxWidth: 980, alignSelf: 'center', padding: 18, paddingTop: Platform.OS === 'android' ? 50 : 62, paddingBottom: 50 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 }, eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4 }, title: { fontSize: 27, fontWeight: '900', marginTop: 3 }, iconButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  metrics: { flexDirection: 'row', gap: 10, marginBottom: 16 }, metric: { flex: 1, borderRadius: 15, padding: 13, borderTopWidth: 4 }, metricValue: { fontSize: 25, fontWeight: '900' }, metricLabel: { fontSize: 11, fontWeight: '700' },
  tabs: { flexDirection: 'row', borderRadius: 15, padding: 4, marginBottom: 14 }, tab: { flex: 1, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, cardTitle: { fontSize: 17, fontWeight: '900' }, muted: { fontSize: 12, lineHeight: 18 }, description: { fontSize: 14, lineHeight: 20, marginVertical: 12 }, badge: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6 }, issuePhoto: { width: '100%', height: 170, borderRadius: 13, marginBottom: 10 },
  primaryButton: { height: 45, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 13 }, primaryText: { color: '#fff', fontWeight: '900' }, assignment: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 11, borderRadius: 12, marginTop: 12 }, onlineDot: { width: 12, height: 12, borderRadius: 6 },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,.55)', justifyContent: 'flex-end' }, sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 32 }, sheetTitle: { fontSize: 20, fontWeight: '900' }, candidate: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1 }, rank: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dispatchMapFrame: { height: 205, borderRadius: 16, overflow: 'hidden', marginTop: 14 }, dispatchMap: { width: '100%', height: '100%' }, mapsLink: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, noLocation: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginTop: 12 },
  zoomContainer: { flex: 1, backgroundColor: '#000' },
  zoomClose: { position: 'absolute', top: 52, right: 18, zIndex: 10 },
  zoomCloseBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  zoomImage: { width: '100%', aspectRatio: 1 },
});
