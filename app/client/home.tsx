import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { GeoPoint, collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { MapCoordinate, ServiceMap } from '../../src/components/ServiceMap';
import { auth, db } from '../../src/config/firebase';
import { useTheme } from '../../src/context/ThemeContext';
import { useSession } from '../../src/context/SessionContext';
import { uploadServiceImage } from '../../src/services/mediaStorage';
import { queueDemoPushNotification as sendDemoPushNotification } from '../../src/services/demoPushService';
import { notifyCentral } from '../../src/services/centralNotifications';
import { withTimeout } from '../../src/services/async';
import * as Haptics from 'expo-haptics';
import { submitServiceRating, MAX_REVIEW_COMMENT_LENGTH } from '../../src/services/ratings';
import { submitClientPayment, PAYMENT_METHODS, type PaymentMethod } from '../../src/services/payment';

const ORGANIZATION_ID = 'maestro-a-domicilio';
const ACTIVE_STATUSES = ['PENDING_ASSIGNMENT', 'REQUIRES_REASSIGNMENT', 'PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'];
const SERVICES = [
  { id: 'Gasfitero', label: 'Gasfitería', icon: 'water-outline' },
  { id: 'Electricista', label: 'Electricidad', icon: 'flash-outline' },
  { id: 'Pintor', label: 'Pintura', icon: 'color-palette-outline' },
  { id: 'Carpintero', label: 'Carpintería', icon: 'hammer-outline' },
  { id: 'Albañil', label: 'Albañilería', icon: 'construct-outline' },
  { id: 'Cerrajero', label: 'Cerrajería', icon: 'key-outline' },
  { id: 'Tecnico', label: 'Línea blanca / TV', icon: 'tv-outline' },
  { id: 'Otro', label: 'Otro servicio', icon: 'apps-outline' },
] as const;

const STATUS_COPY: Record<string, { label: string; detail: string; step: number }> = {
  PENDING_ASSIGNMENT: { label: 'Buscando al técnico adecuado', detail: 'La central está revisando tu solicitud.', step: 1 },
  REQUIRES_REASSIGNMENT: { label: 'Reasignando técnico', detail: 'La central está buscando otra opción disponible.', step: 1 },
  PENDING: { label: 'Técnico asignado', detail: 'Esperando confirmación del técnico.', step: 2 },
  ACCEPTED: { label: 'Técnico en camino', detail: 'Tu servicio fue confirmado.', step: 3 },
  IN_PROGRESS: { label: 'Servicio en ejecución', detail: 'El técnico se encuentra atendiendo la solicitud.', step: 4 },
  COMPLETED: { label: '¡Trabajo culminado por el técnico!', detail: 'Revisa la evidencia, registra tu pago y califica el servicio.', step: 4 },
};

export default function ClientHome() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useSession();
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [service, setService] = useState('');
  const [visitFeePaymentMethod, setVisitFeePaymentMethod] = useState<'PLIN' | 'YAPE' | 'TRANSFERENCIA' | 'EFECTIVO'>('PLIN');
  const selectedService = useMemo(() => SERVICES.find((s) => s.id === service), [service]);
  const [description, setDescription] = useState('');
  const [district, setDistrict] = useState('');
  const [address, setAddress] = useState('');
  const [addressReference, setAddressReference] = useState('');
  const manuallySelected = useRef(false);
  const [geocoding, setGeocoding] = useState(false);
  const [urgency, setUrgency] = useState<'NOW' | 'TODAY' | 'SCHEDULED'>('TODAY');
  const [preferredSchedule, setPreferredSchedule] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [serviceLocation, setServiceLocation] = useState<MapCoordinate | null>(null);
  const [locating, setLocating] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestAttempt, setRequestAttempt] = useState(0);

  // Estados para finalización, pago y calificación
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('YAPE');
  const [voucher, setVoucher] = useState<{ uri: string; base64: string } | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [ratingStars, setRatingStars] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [dismissedCompletedId, setDismissedCompletedId] = useState<string | null>(null);
  const [providerLocation, setProviderLocation] = useState<any>(null);

  // Escuchar ubicación en vivo del técnico asignado para trazar la ruta
  useEffect(() => {
    if (!activeRequest?.id || !activeRequest?.providerId || !['ACCEPTED', 'IN_PROGRESS'].includes(activeRequest?.status)) {
      setProviderLocation(null);
      return;
    }
    const locDoc = doc(db, 'service_requests', activeRequest.id, 'locations', activeRequest.providerId);
    return onSnapshot(locDoc, (snap) => {
      const data = snap.data();
      if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        setProviderLocation({
          id: activeRequest.providerId,
          name: activeRequest.providerName || 'Técnico en camino',
          latitude: data.latitude,
          longitude: data.longitude,
          color: '#1677FF',
        });
      } else {
        setProviderLocation(null);
      }
    }, () => setProviderLocation(null));
  }, [activeRequest?.id, activeRequest?.providerId, activeRequest?.status]);

  useEffect(() => {
    setActiveRequest(null);
    setRequestError(null);
    setDescription(''); setPhoto(null); setServiceLocation(null); setAddress(''); setAddressReference(''); setDistrict('');
    if (!user) {
      setLoadingRequest(false);
      return;
    }
    let active = true;
    setLoadingRequest(true);
    const timeout = setTimeout(() => {
      if (!active) return;
      setRequestError('La conexión está tardando. Puedes abrir tu perfil o volver a intentar.');
      setLoadingRequest(false);
    }, 10000);
    const activeQuery = query(
      collection(db, 'service_requests'),
      where('clientId', '==', user.uid),
      where('status', 'in', ACTIVE_STATUSES)
    );
    const unsubscribe = onSnapshot(activeQuery, (snapshot) => {
      if (!active || auth.currentUser?.uid !== user.uid) return;
      clearTimeout(timeout);
      const requests = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() as any }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      const filtered = requests.filter((r) => r.id !== dismissedCompletedId);
      setActiveRequest(filtered[0] || null);
      setRequestError(null);
      setLoadingRequest(false);
    }, (error) => {
      if (!active) return;
      clearTimeout(timeout);
      console.error('No se pudo consultar la solicitud activa:', error);
      setRequestError('No se pudo consultar tu servicio. Revisa la conexión y vuelve a intentar.');
      setLoadingRequest(false);
    });
    return () => { active = false; clearTimeout(timeout); unsubscribe(); };
  }, [user, requestAttempt, dismissedCompletedId]);

  const selectVoucherPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso requerido', 'Permite el acceso a fotos para adjuntar el comprobante.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.25,
      base64: true,
      allowsEditing: true,
    });
    const asset = result.assets?.[0];
    if (!result.canceled && asset?.base64) {
      setVoucher({ uri: asset.uri, base64: asset.base64 });
    }
  };

  const handleSendPayment = async () => {
    if (!activeRequest || submittingPayment || !user) return;
    setSubmittingPayment(true);
    try {
      let voucherUrl: string | null = null;
      if (voucher?.base64) {
        voucherUrl = await uploadServiceImage(activeRequest.id, user.uid, voucher.base64, 'voucher');
      }
      await submitClientPayment({
        requestId: activeRequest.id,
        method: paymentMethod,
        voucherPhoto: voucherUrl,
      });
      Toast.show({ type: 'success', text1: '¡Pago registrado!', text2: 'El técnico y la central han sido notificados.' });
      setVoucher(null);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo registrar el pago.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleSendRating = async () => {
    if (!activeRequest || submittingRating || !user) return;
    setSubmittingRating(true);
    try {
      await submitServiceRating({
        requestId: activeRequest.id,
        providerId: activeRequest.providerId,
        rating: ratingStars,
        comment: reviewComment,
      });
      Toast.show({ type: 'success', text1: '¡Gracias por calificar!', text2: 'Tu opinión se registró exitosamente.' });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar la calificación.');
    } finally {
      setSubmittingRating(false);
    }
  };

  const selectPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso requerido', 'Permite el acceso a tus fotos para adjuntar evidencia del problema.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.25, base64: true, allowsEditing: true, aspect: [4, 3] });
    const asset = result.assets?.[0];
    if (!result.canceled && asset?.base64) {
      if (asset.base64.length > 700000) {
        Alert.alert('Imagen muy pesada', 'Selecciona una fotografía de menor tamaño.');
        return;
      }
      setPhoto({ uri: asset.uri, base64: asset.base64 });
    }
  };

  useEffect(() => {
    if (loadingRequest || requestError || activeRequest || !user) return;
    let cancelled = false;
    manuallySelected.current = false;
    setLocating(true);
    const locate = async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (cancelled || !permission.granted) return;

      if (Platform.OS === 'android') {
        try {
          const providerStatus = await Location.getProviderStatusAsync();
          if (!providerStatus.locationServicesEnabled) {
            await Location.enableNetworkProviderAsync();
          }
        } catch {
          // Si el usuario cancela el diálogo, continúa con la selección manual sin bloquear la pantalla
        }
      }

      if (cancelled) return;
      const last = await Location.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: 100 });
      if (last && !cancelled && !manuallySelected.current) setServiceLocation({ latitude: last.coords.latitude, longitude: last.coords.longitude });
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (!cancelled && !manuallySelected.current) setServiceLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude });
    };
    locate().catch(() => { /* Manual selection remains available without GPS. */ }).finally(() => { if (!cancelled) setLocating(false); });
    return () => { cancelled = true; };
  }, [loadingRequest, requestError, activeRequest, user]);

  useEffect(() => {
    if (!serviceLocation) return;
    let cancelled = false;
    const pointLabel = `${serviceLocation.latitude.toFixed(6)}, ${serviceLocation.longitude.toFixed(6)}`;
    setAddress(pointLabel); setDistrict(''); setGeocoding(true);
    const timer = setTimeout(async () => {
      try {
        const results = await Location.reverseGeocodeAsync(serviceLocation);
        if (cancelled) return;
        const place = results[0];
        if (place) {
          setAddress([place.street || place.name, place.streetNumber, place.city].filter(Boolean).join(' ') || pointLabel);
          setDistrict(place.district || place.subregion || place.city || '');
        }
      } catch { /* Exact coordinates remain the authoritative destination. */ }
      finally { if (!cancelled) setGeocoding(false); }
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [serviceLocation]);

  const submitRequest = async () => {
    if (!user || auth.currentUser?.uid !== user.uid || submitting || geocoding || requestError || loadingRequest) return;
    if (!service || description.trim().length < 10 || !district.trim() || !address.trim() || !serviceLocation || (urgency === 'SCHEDULED' && !preferredSchedule.trim())) {
      Alert.alert('Completa la solicitud', 'Selecciona un servicio, ingresa la dirección y confirma en el mapa la ubicación exacta.');
      return;
    }
    setSubmitting(true);
    try {
      // Obtener tokens push registrados para el cliente actual
      let clientTokens: string[] = [];
      try {
        const tokenSnap = await withTimeout(getDoc(doc(db, 'push_tokens', user.uid)), 3000);
        if (tokenSnap.exists()) {
          clientTokens = tokenSnap.data()?.tokens || [];
        }
      } catch (tokenErr) {
        console.warn('No se pudo adjuntar token del cliente:', tokenErr);
      }

      const location = new GeoPoint(serviceLocation.latitude, serviceLocation.longitude);
      if (auth.currentUser?.uid !== user.uid) return;
      const requestRef = doc(collection(db, 'service_requests'));
      await setDoc(requestRef, {
        organizationId: ORGANIZATION_ID,
        intakeChannel: 'CUSTOMER_APP',
        clientId: user.uid,
        clientName: user.displayName || user.email?.split('@')[0] || 'Cliente',
        notificationTokens: {
          client: clientTokens,
        },
        specialty: service,
        serviceLabel: selectedService?.label || service,
        description: description.trim(),
        district: district.trim(),
        address: address.trim(),
        addressReference: addressReference.trim(),
        urgency,
        preferredSchedule: urgency === 'SCHEDULED' ? preferredSchedule.trim() : null,
        issuePhoto: null,
        location,
        locationSource: 'CUSTOMER_CONFIRMED',
        status: 'PENDING_ASSIGNMENT',
        priority: urgency === 'NOW' ? 'HIGH' : 'NORMAL',
        securityPin: Math.floor(1000 + Math.random() * 9000).toString(),
        technicalVisitFee: 50.00,
        technicalVisitPaymentMethod: visitFeePaymentMethod,
        visitFeeDeductible: true,
        price_agreed: 'Visita técnica: S/. 50.00 (Deducible)',
        serviceStarted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (auth.currentUser?.uid !== user.uid) return;
      void notifyCentral(requestRef.id, urgency === 'NOW' ? 'Solicitud urgente' : 'Nueva solicitud', `${user.displayName || 'Un cliente'} solicita ${selectedService?.label || service} en ${district}.`, 'PENDING_ASSIGNMENT');
      if (photo) {
        try {
          const issuePhoto = await uploadServiceImage(requestRef.id, user.uid, photo.base64, 'issue');
          await updateDoc(requestRef, { issuePhoto, updatedAt: serverTimestamp() });
        } catch (uploadError) {
          console.warn('La solicitud se creó sin fotografía:', uploadError);
        }
      }
      setDescription(''); setDistrict(''); setAddress(''); setAddressReference(''); setService(''); setPreferredSchedule(''); setPhoto(null); setServiceLocation(null);
      Toast.show({ type: 'success', text1: 'Solicitud recibida', text2: 'La central seleccionará al técnico más adecuado.' });
    } catch (error) {
      console.error('Error creando solicitud:', error);
      Alert.alert('No se pudo enviar', 'Revisa tu conexión e inténtalo nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = () => {
    if (!activeRequest) return;
    Alert.alert('Cancelar solicitud', '¿Deseas cancelar esta atención?', [
      { text: 'Volver', style: 'cancel' },
      { text: 'Cancelar solicitud', style: 'destructive', onPress: async () => {
        const targetProviderTokens = activeRequest.notificationTokens?.provider;
        if (!user || auth.currentUser?.uid !== user.uid) return;
        try {
        await updateDoc(doc(db, 'service_requests', activeRequest.id), { status: 'CANCELLED_BY_CLIENT', cancelledAt: serverTimestamp(), updatedAt: serverTimestamp() });
        if (auth.currentUser?.uid !== user.uid) return;
        void notifyCentral(activeRequest.id, 'Solicitud cancelada', 'El cliente canceló su solicitud.', 'CANCELLED_BY_CLIENT');
        
        // Notificar al técnico si la solicitud ya tenía técnico asignado
        if (targetProviderTokens && targetProviderTokens.length > 0) {
          sendDemoPushNotification(
            targetProviderTokens,
            'Solicitud Cancelada',
            `${user?.displayName || 'El cliente'} ha cancelado la solicitud.`,
            { requestId: activeRequest.id, screen: 'provider_home', type: 'CANCELLED_BY_CLIENT' },
            { requestId: activeRequest.id, eventType: 'CANCELLED_BY_CLIENT' }
          ).catch(() => {});
        }
        } catch { Alert.alert('No se pudo cancelar', 'Revisa tu conexión y vuelve a intentar.'); }
      } },
    ]);
  };

  if (loadingRequest) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  const status = activeRequest ? STATUS_COPY[activeRequest.status] || STATUS_COPY.PENDING_ASSIGNMENT : null;

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>MAESTRO A DOMICILIO</Text>
            <Text style={[styles.title, { color: colors.text }]}>¿Qué necesitas resolver?</Text>
          </View>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.card }]} onPress={() => router.push('/client/history')}><Ionicons name="receipt-outline" size={23} color={colors.primary} /></TouchableOpacity>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.card }]} onPress={() => router.push('/profile')}><Ionicons name="person-outline" size={23} color={colors.primary} /></TouchableOpacity>
        </View>

        {requestError ? <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={{ color: colors.text }}>{requestError}</Text><TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.primary, marginTop: 12 }]} onPress={() => setRequestAttempt((value) => value + 1)}><Text style={styles.submitText}>Volver a intentar</Text></TouchableOpacity></View> : activeRequest && status ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.statusHeader}>
              <View style={[styles.statusIcon, { backgroundColor: `${colors.primary}18` }]}><Ionicons name="construct-outline" size={26} color={colors.primary} /></View>
              <View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.text }]}>{status.label}</Text><Text style={[styles.helper, { color: colors.subtext }]}>{status.detail}</Text></View>
            </View>
            <View style={styles.progressRow}>{[1, 2, 3, 4].map((step) => <View key={step} style={[styles.progressSegment, { backgroundColor: step <= status.step ? colors.primary : colors.border }]} />)}</View>
            <View style={[styles.summaryBox, { backgroundColor: colors.background }]}>
              <Text style={[styles.summaryLabel, { color: colors.subtext }]}>SERVICIO</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{activeRequest.serviceLabel || activeRequest.specialty}</Text>
              <Text style={[styles.summaryLabel, { color: colors.subtext }]}>TARIFA DE LA EMPRESA</Text><Text style={[styles.summaryValue, { color: colors.text }]}>{activeRequest.price_agreed || 'Pendiente de cotización por la central'}</Text>
              {activeRequest.pricing?.description ? <Text style={{ color: colors.subtext }}>{activeRequest.pricing.description}</Text> : null}
              <Text style={[styles.summaryLabel, { color: colors.subtext }]}>DESTINO CONFIRMADO</Text><Text style={{ color: colors.text }}>{activeRequest.address} {activeRequest.addressReference || ''}</Text>
              <View style={[styles.mapFrame, { marginTop: 10, borderColor: colors.border }]}><ServiceMap location={activeRequest.location || null} technicians={providerLocation ? [providerLocation] : []} style={styles.map} /></View>
              {activeRequest.providerName ? <><Text style={[styles.summaryLabel, { color: colors.subtext }]}>TÉCNICO ASIGNADO</Text><Text style={[styles.summaryValue, { color: colors.text }]}>{activeRequest.providerName}</Text></> : null}
              {activeRequest.status === 'ACCEPTED' ? <><Text style={[styles.summaryLabel, { color: colors.subtext }]}>PIN DE SEGURIDAD</Text><Text style={[styles.pin, { color: colors.primary }]}>{activeRequest.securityPin}</Text></> : null}
            </View>
            {activeRequest.status === 'COMPLETED' ? (
              <View style={[styles.completedSection, { borderTopColor: colors.border }]}>
                {/* 1. Evidencia del trabajo */}
                {activeRequest.evidence_photo && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={[styles.completedSubheading, { color: colors.text }]}>Evidencia del trabajo finalizado:</Text>
                    <Image source={{ uri: activeRequest.evidence_photo }} style={styles.completedEvidenceImage} />
                  </View>
                )}

                {/* 2. Sección de Pago */}
                <View style={[styles.paymentCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.completedSubheading, { color: colors.text }]}>Pago del servicio</Text>
                  <Text style={[styles.paymentAmount, { color: colors.primary }]}>{activeRequest.price_agreed || 'Tarifa fijada por empresa'}</Text>
                  
                  {activeRequest.paymentStatus === 'PAID' || activeRequest.paymentStatus === 'CONFIRMED' ? (
                    <View style={styles.paymentSuccessBox}>
                      <Ionicons name="checkmark-circle" size={26} color={colors.success} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.success, fontWeight: '800', fontSize: 14 }}>
                          {activeRequest.paymentStatus === 'CONFIRMED'
                            ? 'Pago confirmado por el técnico'
                            : 'Comprobante enviado'}
                        </Text>
                        <Text style={{ color: colors.subtext, fontSize: 12 }}>
                          Método: {activeRequest.paymentMethod || 'Yape'}
                          {activeRequest.paymentStatus !== 'CONFIRMED' && ' · Esperando confirmación del trabajador'}
                        </Text>
                      </View>
                      {activeRequest.paymentVoucher ? (
                        <Image source={{ uri: activeRequest.paymentVoucher }} style={styles.voucherThumbnail} />
                      ) : null}
                    </View>
                  ) : (
                    <View style={{ marginTop: 6 }}>
                      <Text style={{ color: colors.subtext, fontSize: 12, marginBottom: 6 }}>Selecciona cómo realizaste el pago:</Text>
                      <View style={styles.paymentMethodsRow}>
                        {PAYMENT_METHODS.map((m) => {
                          const isSel = paymentMethod === m.id;
                          return (
                            <TouchableOpacity
                              key={m.id}
                              onPress={() => setPaymentMethod(m.id)}
                              style={[
                                styles.paymentMethodChip,
                                {
                                  borderColor: isSel ? colors.primary : colors.border,
                                  backgroundColor: isSel ? `${colors.primary}18` : colors.card,
                                },
                              ]}
                            >
                              <Text style={{ color: isSel ? colors.primary : colors.text, fontWeight: '700', fontSize: 12 }}>
                                {m.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {['YAPE', 'PLIN', 'TRANSFER'].includes(paymentMethod) && (
                        <View style={{ marginTop: 8 }}>
                          {voucher ? (
                            <View style={styles.voucherPreview}>
                              <Image source={{ uri: voucher.uri }} style={styles.voucherImage} />
                              <TouchableOpacity style={styles.removeVoucherBtn} onPress={() => setVoucher(null)}>
                                <Ionicons name="close" size={16} color="#fff" />
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity style={[styles.voucherButton, { borderColor: colors.border }]} onPress={selectVoucherPhoto}>
                              <Ionicons name="document-attach-outline" size={18} color={colors.primary} />
                              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Adjuntar captura del comprobante</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}

                      <TouchableOpacity
                        style={[styles.primaryButton, { backgroundColor: colors.primary, marginTop: 10 }]}
                        onPress={handleSendPayment}
                        disabled={submittingPayment}
                      >
                        {submittingPayment ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.primaryButtonText}>Confirmar y Enviar Pago</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* 3. Sección de Calificación */}
                <View style={[styles.ratingCardContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.completedSubheading, { color: colors.text }]}>Califica la atención</Text>
                  {activeRequest.rating_given ? (
                    <View style={{ marginTop: 6 }}>
                      <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Ionicons
                            key={star}
                            name={star <= activeRequest.rating_given ? 'star' : 'star-outline'}
                            size={20}
                            color="#f1c40f"
                          />
                        ))}
                        <Text style={{ color: colors.subtext, marginLeft: 8, fontSize: 12 }}>Calificación registrada</Text>
                      </View>
                      {activeRequest.review_comment ? (
                        <Text style={{ fontStyle: 'italic', color: colors.text, marginTop: 6, fontSize: 13 }}>
                          "{activeRequest.review_comment}"
                        </Text>
                      ) : null}
                    </View>
                  ) : (
                    <View style={{ marginTop: 6 }}>
                      <View style={{ flexDirection: 'row', gap: 10, marginVertical: 6 }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <TouchableOpacity
                            key={star}
                            onPress={() => {
                              setRatingStars(star);
                              void Haptics.selectionAsync().catch(() => {});
                            }}
                          >
                            <Ionicons
                              name={star <= ratingStars ? 'star' : 'star-outline'}
                              size={30}
                              color="#f1c40f"
                            />
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TextInput
                        style={[styles.ratingCommentInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                        placeholder="Deja una reseña para el técnico (opcional)..."
                        placeholderTextColor={colors.subtext}
                        multiline
                        maxLength={MAX_REVIEW_COMMENT_LENGTH}
                        value={reviewComment}
                        onChangeText={setReviewComment}
                      />
                      <TouchableOpacity
                        style={[styles.primaryButton, { backgroundColor: colors.primary, marginTop: 10 }]}
                        onPress={handleSendRating}
                        disabled={submittingRating}
                      >
                        {submittingRating ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.primaryButtonText}>Enviar Calificación</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* 4. Botón de chat y botón para solicitar nuevo servicio */}
                <View style={[styles.actionRow, { marginTop: 12 }]}>
                  {activeRequest.providerId ? (
                    <TouchableOpacity
                      style={[styles.secondaryButton, { borderColor: colors.border }]}
                      onPress={() => router.push({ pathname: '/chat/[id]', params: { id: activeRequest.id } })}
                    >
                      <Text style={{ color: colors.text, fontWeight: '700' }}>Ver Chat</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.primary }]}
                    onPress={() => setDismissedCompletedId(activeRequest.id)}
                  >
                    <Text style={{ color: colors.primary, fontWeight: '800' }}>Nuevo servicio</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.actionRow}>
                {activeRequest.providerId ? <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: activeRequest.id } })}><Ionicons name="chatbubble-outline" size={19} color="#fff" /><Text style={styles.primaryButtonText}>Contactar</Text></TouchableOpacity> : null}
                {activeRequest.status !== 'IN_PROGRESS' ? <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.danger }]} onPress={cancelRequest}><Text style={{ color: colors.danger, fontWeight: '700' }}>Cancelar</Text></TouchableOpacity> : null}
              </View>
            )}
          </View>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Selecciona una especialidad</Text>
            <View style={styles.serviceGrid}>{SERVICES.map((item) => {
              const selected = service === item.id;
              return <TouchableOpacity key={item.id} style={[styles.serviceCard, { backgroundColor: colors.card, borderColor: selected ? colors.primary : colors.border }]} onPress={() => setService(item.id)}><Ionicons name={item.icon} size={25} color={selected ? colors.primary : colors.subtext} /><Text style={[styles.serviceText, { color: colors.text }]}>{item.label}</Text></TouchableOpacity>;
            })}</View>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Cuéntanos el problema</Text>
              <TextInput style={[styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} placeholder="Ejemplo: Hay una fuga debajo del lavadero desde esta mañana..." placeholderTextColor={colors.subtext} multiline value={description} onChangeText={setDescription} maxLength={500} />
              <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} placeholder="Distrito" placeholderTextColor={colors.subtext} value={district} onChangeText={setDistrict} />
              <Text style={[styles.helper, { color: colors.text }]}>{geocoding ? 'Buscando la dirección del punto…' : address || 'Elige el punto de atención en el mapa'}</Text>
              <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} placeholder="Referencia: piso, puerta, número interior…" placeholderTextColor={colors.subtext} value={addressReference} onChangeText={setAddressReference} maxLength={200} />
              <View style={styles.locationHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Confirma el punto exacto</Text>
                  <Text style={[styles.locationHint, { color: colors.subtext }]}>Iniciamos en tu ubicación actual. Toca otro punto o arrastra el marcador: ese será el destino de la central y del trabajador.</Text>
                </View>
                {locating ? <ActivityIndicator size="small" color={colors.primary} /> : null}
              </View>
              <View style={[styles.mapFrame, { borderColor: serviceLocation ? colors.primary : colors.border }]}>
                <ServiceMap location={serviceLocation} editable onLocationChange={(point) => { manuallySelected.current = true; setServiceLocation(point); }} style={styles.map} />
              </View>
              <Text style={[styles.mapStatus, { color: serviceLocation ? colors.success : colors.subtext }]}>
                <Ionicons name={serviceLocation ? 'checkmark-circle' : 'information-circle-outline'} size={15} />{' '}
                {serviceLocation ? 'Ubicación confirmada para la central' : 'Falta seleccionar la ubicación del servicio'}
              </Text>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>¿Cuándo lo necesitas?</Text>
              <View style={styles.urgencyRow}>{[['NOW', 'Urgente'], ['TODAY', 'Hoy'], ['SCHEDULED', 'Programar']].map(([value, label]) => <TouchableOpacity key={value} style={[styles.urgencyChip, { borderColor: urgency === value ? colors.primary : colors.border }, urgency === value && { backgroundColor: `${colors.primary}15` }]} onPress={() => setUrgency(value as typeof urgency)}><Text style={{ color: urgency === value ? colors.primary : colors.subtext, fontWeight: '700' }}>{label}</Text></TouchableOpacity>)}</View>
              {urgency === 'SCHEDULED' ? <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} placeholder="Fecha y rango horario preferido" placeholderTextColor={colors.subtext} value={preferredSchedule} onChangeText={setPreferredSchedule} /> : null}
              {photo ? <View style={styles.photoPreview}><Image source={{ uri: photo.uri }} style={styles.photo} /><TouchableOpacity style={styles.removePhoto} onPress={() => setPhoto(null)}><Ionicons name="close" size={18} color="#fff" /></TouchableOpacity></View> : <TouchableOpacity style={[styles.photoButton, { borderColor: colors.border }]} onPress={selectPhoto}><Ionicons name="camera-outline" size={21} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '700' }}>Adjuntar fotografía</Text></TouchableOpacity>}

              {/* Tarjeta de Tarifa de Visita Técnica Maestro a Domicilio */}
              <View style={[styles.visitFeeCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={styles.visitFeeHeader}>
                  <View style={[styles.visitFeeIconBox, { backgroundColor: `${colors.primary}18` }]}>
                    <Ionicons name="cash-outline" size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.visitFeeTitle, { color: colors.text }]}>Visita Técnica y Diagnóstico</Text>
                    <Text style={[styles.visitFeeSubtitle, { color: colors.subtext }]}>
                      Evaluación presencial en domicilio
                    </Text>
                  </View>
                  <Text style={[styles.visitFeeAmount, { color: colors.primary }]}>S/. 50.00</Text>
                </View>
                <View style={[styles.visitFeeNoteBox, { backgroundColor: `${colors.primary}0D` }]}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
                  <Text style={[styles.visitFeeNoteText, { color: colors.text }]}>
                    Este importe se <Text style={{ fontWeight: '800', color: colors.primary }}>descontará de la cotización final</Text> si se aprueba el servicio.
                  </Text>
                </View>

                <Text style={[styles.visitFeeMethodLabel, { color: colors.text }]}>
                  Modalidad de Abono de Visita:
                </Text>
                <View style={styles.visitPaymentRow}>
                  {(['PLIN', 'YAPE', 'TRANSFERENCIA', 'EFECTIVO'] as const).map((method) => {
                    const isSelected = visitFeePaymentMethod === method;
                    return (
                      <TouchableOpacity
                        key={method}
                        style={[
                          styles.visitPaymentChip,
                          {
                            borderColor: isSelected ? colors.primary : colors.border,
                            backgroundColor: isSelected ? `${colors.primary}18` : colors.card,
                          },
                        ]}
                        onPress={() => setVisitFeePaymentMethod(method)}
                      >
                        <Text
                          style={[
                            styles.visitPaymentChipText,
                            { color: isSelected ? colors.primary : colors.subtext, fontWeight: isSelected ? '800' : '600' },
                          ]}
                        >
                          {method}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.primary }]} onPress={submitRequest} disabled={submitting}>{submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Enviar a la central</Text>}</TouchableOpacity>
              <Text style={[styles.disclaimer, { color: colors.subtext }]}>La central evaluará tu solicitud y asignará al técnico más adecuado.</Text>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 18, paddingTop: Platform.OS === 'android' ? 52 : 64, paddingBottom: 40, maxWidth: 760, width: '100%', alignSelf: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 26 }, eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.3 }, title: { fontSize: 27, fontWeight: '800', marginTop: 4 },
  iconButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 13 },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 }, serviceCard: { width: '48%', minHeight: 82, borderWidth: 1.5, borderRadius: 16, padding: 13, gap: 7 }, serviceText: { fontSize: 13, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 22, padding: 18, marginBottom: 20 }, textArea: { minHeight: 105, borderWidth: 1, borderRadius: 14, padding: 13, textAlignVertical: 'top', marginBottom: 11 }, input: { height: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, marginBottom: 11 },
  locationHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2, marginBottom: 10 }, locationHint: { fontSize: 11, lineHeight: 16 }, locationButton: { minWidth: 105, minHeight: 42, borderWidth: 1, borderRadius: 12, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, mapFrame: { height: 220, borderWidth: 1.5, borderRadius: 15, overflow: 'hidden' }, map: { width: '100%', height: '100%' }, mapStatus: { fontSize: 12, fontWeight: '700', marginTop: 7, marginBottom: 12 },
  fieldLabel: { fontSize: 14, fontWeight: '800', marginTop: 4, marginBottom: 9 }, urgencyRow: { flexDirection: 'row', gap: 8, marginBottom: 14 }, urgencyChip: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  photoButton: { height: 50, borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }, photoPreview: { height: 160, borderRadius: 14, overflow: 'hidden', marginBottom: 14 }, photo: { width: '100%', height: '100%' }, removePhoto: { position: 'absolute', right: 8, top: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,.65)', alignItems: 'center', justifyContent: 'center' },
  submitButton: { height: 54, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, submitText: { color: '#fff', fontSize: 16, fontWeight: '800' }, disclaimer: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 10 },
  statusHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' }, statusIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, cardTitle: { fontSize: 18, fontWeight: '800' }, helper: { fontSize: 13, lineHeight: 18, marginTop: 3 }, progressRow: { flexDirection: 'row', gap: 6, marginVertical: 18 }, progressSegment: { flex: 1, height: 5, borderRadius: 4 },
  summaryBox: { padding: 15, borderRadius: 15 }, summaryLabel: { fontSize: 10, fontWeight: '800', letterSpacing: .8, marginTop: 7 }, summaryValue: { fontSize: 15, fontWeight: '700', marginTop: 2 }, pin: { fontSize: 30, fontWeight: '900', letterSpacing: 7, marginTop: 4 }, actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 }, primaryButton: { flex: 1, height: 48, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, primaryButtonText: { color: '#fff', fontWeight: '800' }, secondaryButton: { flex: 1, height: 48, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  completedSection: { marginTop: 14, paddingTop: 14, borderTopWidth: 1 },
  completedSubheading: { fontSize: 14, fontWeight: '800', marginBottom: 6 },
  completedEvidenceImage: { width: '100%', height: 160, borderRadius: 12, marginTop: 4 },
  paymentCard: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 14 },
  paymentAmount: { fontSize: 20, fontWeight: '900', marginVertical: 4 },
  paymentSuccessBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, backgroundColor: 'rgba(46, 204, 113, 0.1)', marginTop: 8 },
  voucherThumbnail: { width: 44, height: 44, borderRadius: 8 },
  paymentMethodsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  paymentMethodChip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  voucherPreview: { height: 120, borderRadius: 10, overflow: 'hidden', marginVertical: 6, position: 'relative' },
  voucherImage: { width: '100%', height: '100%' },
  removeVoucherBtn: { position: 'absolute', right: 6, top: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  voucherButton: { height: 42, borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginVertical: 6 },
  ratingCardContainer: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
  ratingCommentInput: { minHeight: 60, borderWidth: 1, borderRadius: 10, padding: 10, textAlignVertical: 'top', marginTop: 8, fontSize: 13 },
  visitFeeCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 16 },
  visitFeeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  visitFeeIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  visitFeeTitle: { fontSize: 14, fontWeight: '800' },
  visitFeeSubtitle: { fontSize: 11, marginTop: 2 },
  visitFeeAmount: { fontSize: 18, fontWeight: '900' },
  visitFeeNoteBox: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: 10, marginTop: 10 },
  visitFeeNoteText: { fontSize: 11, flex: 1, lineHeight: 15 },
  visitFeeMethodLabel: { fontSize: 12, fontWeight: '800', marginTop: 10, marginBottom: 6 },
  visitPaymentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  visitPaymentChip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 6 },
  visitPaymentChipText: { fontSize: 11 },
});
