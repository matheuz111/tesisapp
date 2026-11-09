import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { signOutWithNotifications } from '../../utils/pushNotifications';
import { GeoPoint, collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getNextServiceRequestCode } from '../../src/domain/counterService';
import { createInitialStatusHistoryRecord, transitionServiceStatus } from '../../src/domain/serviceRequestTransition';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { getDefaultVisitFee, getFormattedVisitFee } from '../../src/services/pricingPolicyService';
import { resolveOperationalZone } from '../../src/types/canonical';
import { SPECIALTIES_CATALOG, OPERATIONAL_CONFIG } from '../../src/config/operationalConfig';
import { QuoteApprovalView } from '../../src/components/QuoteApprovalView';
import { CsatSurveyModal } from '../../src/components/CsatSurveyModal';
import { ClientConformityView } from '../../src/components/ClientConformityView';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { useNetworkStatus } from '../../src/services/networkStatus';
import { AnimatedPressable } from '../../src/components/AnimatedPressable';
import { AnimatedFadeIn } from '../../src/components/AnimatedFadeIn';
import { SemanticColors, DisplayPin } from '../../src/theme/tokens';
import { BaseDistrictPicker } from '../../src/components/base/BaseDistrictPicker';

const ORGANIZATION_ID = 'maestro-a-domicilio';
const ACTIVE_STATUSES = ['PENDING_ASSIGNMENT', 'QUOTED', 'REQUIRES_REASSIGNMENT', 'PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'];
const SERVICES = SPECIALTIES_CATALOG;

const STATUS_COPY: Record<string, { label: string; detail: string; step: number; icon: any }> = {
  PENDING_ASSIGNMENT: { label: 'Buscando al técnico adecuado', detail: 'La central de operaciones está evaluando tu solicitud.', step: 1, icon: 'search-outline' },
  QUOTED: { label: 'Cotización técnica disponible', detail: 'Revisa la proforma y el alcance antes de continuar.', step: 1, icon: 'receipt-outline' },
  REQUIRES_REASSIGNMENT: { label: 'Reasignando técnico', detail: 'La central está gestionando otro técnico disponible para ti.', step: 1, icon: 'repeat-outline' },
  PENDING: { label: 'Técnico asignado', detail: 'Esperando confirmación de salida del técnico propio.', step: 2, icon: 'person-outline' },
  ACCEPTED: { label: 'Técnico en camino a tu domicilio', detail: 'El técnico va hacia la dirección indicada. Prepara tu PIN.', step: 3, icon: 'navigate-outline' },
  IN_PROGRESS: { label: 'Servicio en ejecución', detail: 'El técnico se encuentra atendiendo la labor en tu domicilio.', step: 4, icon: 'construct-outline' },
  COMPLETED: { label: '¡Trabajo culminado por el técnico!', detail: 'Verifica la evidencia fotográfica, registra tu pago y califica.', step: 4, icon: 'checkmark-circle-outline' },
};

export default function ClientHome() {
  const router = useRouter();
  const { category } = useLocalSearchParams<{ category?: string }>();
  const { colors } = useTheme();
  const { user, profile } = useSession();
  const { isOnline } = useNetworkStatus();
  const [csatModalVisible, setCsatModalVisible] = useState(false);
  const [confirmingConformity, setConfirmingConformity] = useState(false);
  const [disputingConformity, setDisputingConformity] = useState(false);
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [service, setService] = useState('');

  // Pre-llenado de dirección y distrito desde el perfil del usuario
  useEffect(() => {
    if (profile && !activeRequest) {
      if (profile.district && !district) setDistrict(profile.district);
      if (profile.address && !address) setAddress(profile.address);
    }
  }, [profile, activeRequest]);

  const [serviceType, setServiceType] = useState<'WITH_QUOTE' | 'SIMPLE'>('WITH_QUOTE');
  const [approvingQuote, setApprovingQuote] = useState(false);
  const [rejectingQuote, setRejectingQuote] = useState(false);
  const [visitFeePaymentMethod, setVisitFeePaymentMethod] = useState<'PLIN' | 'YAPE' | 'TRANSFERENCIA' | 'EFECTIVO'>('PLIN');
  const selectedService = useMemo(() => SERVICES.find((s) => s.id === service), [service]);

  useEffect(() => {
    if (category) {
      const match = SERVICES.find(
        (s) => s.id.toLowerCase() === category.toLowerCase() || s.label.toLowerCase() === category.toLowerCase()
      );
      if (match) {
        setService(match.id);
      }
    }
  }, [category]);

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
          color: '#0369A1',
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

  // Selector optimizado de foto completa (Cámara o Galería sin recorte)
  const pickPhotoComplete = async (title: string): Promise<{ uri: string; base64: string } | null> => {
    return new Promise((resolve) => {
      Alert.alert(
        title,
        'Selecciona el origen de la imagen (se conservará completa y sin recortes):',
        [
          {
            text: 'Cámara 📷',
            onPress: async () => {
              const perm = await ImagePicker.requestCameraPermissionsAsync();
              if (!perm.granted) {
                Alert.alert('Permiso requerido', 'Permite el acceso a la cámara para capturar la fotografía.');
                resolve(null);
                return;
              }
              const res = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                quality: 0.7,
                base64: true,
                allowsEditing: false,
              });
              const asset = res.assets?.[0];
              if (!res.canceled && asset?.base64 && asset?.uri) {
                resolve({ uri: asset.uri, base64: asset.base64 });
              } else {
                resolve(null);
              }
            },
          },
          {
            text: 'Galería 🖼️',
            onPress: async () => {
              const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!perm.granted) {
                Alert.alert('Permiso requerido', 'Permite el acceso a tus fotos para adjuntar la fotografía.');
                resolve(null);
                return;
              }
              const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.7,
                base64: true,
                allowsEditing: false,
              });
              const asset = res.assets?.[0];
              if (!res.canceled && asset?.base64 && asset?.uri) {
                resolve({ uri: asset.uri, base64: asset.base64 });
              } else {
                resolve(null);
              }
            },
          },
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(null) },
        ]
      );
    });
  };

  const selectVoucherPhoto = async () => {
    const asset = await pickPhotoComplete('Adjuntar Comprobante de Pago');
    if (asset) {
      setVoucher(asset);
    }
  };

  const handleSendPayment = async () => {
    if (!isOnline) {
      Alert.alert('Sin conexión', 'No es posible registrar el pago sin conexión a internet.');
      return;
    }
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

  const handleAcceptConformity = async () => {
    if (!isOnline) {
      Alert.alert('Sin conexión', 'No es posible registrar la conformidad sin conexión a internet.');
      return;
    }
    if (!activeRequest || !user || confirmingConformity) return;
    setConfirmingConformity(true);
    try {
      await updateDoc(doc(db, 'service_requests', activeRequest.id), {
        clientConformity: 'ACCEPTED',
        clientConformityAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Toast.show({
        type: 'success',
        text1: '¡Conformidad registrada!',
        text2: 'Procede a confirmar el pago del servicio.',
      });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo registrar la conformidad.');
    } finally {
      setConfirmingConformity(false);
    }
  };

  const handleDisputeConformity = async (reason: string) => {
    if (!activeRequest || !user || disputingConformity) return;
    setDisputingConformity(true);
    try {
      await updateDoc(doc(db, 'service_requests', activeRequest.id), {
        clientConformity: 'DISPUTED',
        clientConformityReason: reason,
        clientConformityAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      void notifyCentral(
        activeRequest.id,
        'Disconformidad reportada por cliente',
        `El cliente reportó inconformidad: ${reason}`,
        'COMPLETED'
      );
      Toast.show({
        type: 'info',
        text1: 'Reporte enviado a la Central',
        text2: 'Un supervisor revisará el caso.',
      });
      router.push({ pathname: '/chat/[id]', params: { id: activeRequest.id } });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo enviar el reporte.');
    } finally {
      setDisputingConformity(false);
    }
  };

  const handleSendCsatRating = async (answers: Record<number, number>, comment: string, overallRating: number) => {
    if (!activeRequest || !user || submittingRating) return;
    setSubmittingRating(true);
    try {
      await submitServiceRating({
        requestId: activeRequest.id,
        providerId: activeRequest.providerId,
        rating: overallRating,
        comment,
        csatAnswers: answers,
      });
      setCsatModalVisible(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Toast.show({
        type: 'success',
        text1: '¡Gracias por tu evaluación!',
        text2: 'Tu encuesta CSAT se registró exitosamente.',
      });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo guardar la evaluación.');
    } finally {
      setSubmittingRating(false);
    }
  };

  const selectPhoto = async () => {
    const asset = await pickPhotoComplete('Adjuntar Fotografía del Problema');
    if (asset) {
      setPhoto(asset);
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
    locate().catch(() => {}).finally(() => { if (!cancelled) setLocating(false); });
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
      } catch {}
      finally { if (!cancelled) setGeocoding(false); }
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [serviceLocation]);

  const submitRequest = async () => {
    if (!isOnline) {
      Alert.alert('Sin conexión', 'No es posible enviar solicitudes sin conexión. Conéctate a internet para que la central reciba tu pedido.');
      return;
    }
    if (!user || auth.currentUser?.uid !== user.uid || submitting || geocoding || requestError || loadingRequest) return;
    if (!service || description.trim().length < 10 || !district.trim() || !address.trim() || !serviceLocation || (urgency === 'SCHEDULED' && !preferredSchedule.trim())) {
      Alert.alert('Completa la solicitud', 'Selecciona un servicio, describe el requerimiento, ingresa la dirección y confirma la ubicación exacta en el mapa.');
      return;
    }
    setSubmitting(true);
    try {
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

      const code = await getNextServiceRequestCode(db);
      const requestRef = doc(collection(db, 'service_requests'));
      const batch = writeBatch(db);

      const clientZone = resolveOperationalZone({
        district: district.trim(),
        latitude: location?.latitude,
        longitude: location?.longitude,
      });
      const resolvedVisitFee = getDefaultVisitFee(clientZone, service);
      const resolvedPriceAgreed = getFormattedVisitFee(clientZone, service);

      batch.set(requestRef, {
        code,
        intakeChannel: 'APP',
        origin: 'CLIENT',
        datosCompletos: true,
        organizationId: ORGANIZATION_ID,
        clientId: user.uid,
        clientName: user.displayName || user.email?.split('@')[0] || 'Cliente',
        notificationTokens: {
          client: clientTokens,
        },
        specialty: service,
        serviceLabel: selectedService?.label || service,
        description: description.trim(),
        district: district.trim(),
        zone: clientZone,
        address: address.trim(),
        addressReference: addressReference.trim(),
        urgency,
        preferredSchedule: urgency === 'SCHEDULED' ? preferredSchedule.trim() : null,
        serviceType,
        requiresQuote: serviceType === 'WITH_QUOTE',
        quoteStatus: serviceType === 'WITH_QUOTE' ? 'PENDING_QUOTE' : null,
        issuePhoto: null,
        evidencePhoto: null,
        evidence_photo: null,
        location,
        locationSource: 'CUSTOMER_CONFIRMED',
        status: 'PENDING_ASSIGNMENT',
        priority: urgency === 'NOW' ? 'HIGH' : 'NORMAL',
        securityPin: Math.floor(1000 + Math.random() * 9000).toString(),
        technicalVisitFee: resolvedVisitFee,
        technicalVisitPaymentMethod: visitFeePaymentMethod,
        visitFeeDeductible: true,
        price_agreed: resolvedPriceAgreed,
        serviceStarted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      createInitialStatusHistoryRecord(batch, db, requestRef.id, {
        uid: user.uid,
        role: 'CLIENT',
      });

      await batch.commit();
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
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
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
    Alert.alert('Cancelar solicitud', '¿Deseas cancelar esta atención técnica?', [
      { text: 'Volver', style: 'cancel' },
      { text: 'Cancelar solicitud', style: 'destructive', onPress: async () => {
        const targetProviderTokens = activeRequest.notificationTokens?.provider;
        if (!user || auth.currentUser?.uid !== user.uid) return;
        try {
          await transitionServiceStatus(
            db,
            activeRequest.id,
            'CANCELLED_BY_CLIENT',
            { uid: user.uid, role: 'CLIENT' },
            {
              fromStatus: activeRequest.status,
              notes: 'El cliente canceló la solicitud',
              extraFields: { cancelledAt: serverTimestamp() },
            }
          );
          if (auth.currentUser?.uid !== user.uid) return;
          void notifyCentral(activeRequest.id, 'Solicitud cancelada', 'El cliente canceló su solicitud.', 'CANCELLED_BY_CLIENT');
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

  const handleAcceptQuote = async () => {
    if (!isOnline) {
      Alert.alert('Sin conexión', 'No es posible aprobar la cotización sin conexión a internet.');
      return;
    }
    if (!activeRequest || !user || approvingQuote) return;
    setApprovingQuote(true);
    try {
      await transitionServiceStatus(
        db,
        activeRequest.id,
        'PENDING_ASSIGNMENT',
        { uid: user.uid, role: 'CLIENT' },
        {
          fromStatus: 'QUOTED',
          notes: 'Cotización formal aprobada por el cliente. Pendiente de asignación técnica.',
          extraFields: {
            quoteAccepted: true,
            quoteStatus: 'APPROVED',
            quoteAcceptedAt: serverTimestamp(),
          },
        }
      );
      void notifyCentral(
        activeRequest.id,
        'Cotización Aprobada por Cliente',
        `${user.displayName || 'El cliente'} aprobó la cotización de ${activeRequest.price_agreed || 'la empresa'}. Procede a asignar técnico.`,
        'PENDING_ASSIGNMENT'
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Toast.show({ type: 'success', text1: '¡Cotización Aprobada!', text2: 'La central está gestionando a tu técnico.' });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo aprobar la cotización.');
    } finally {
      setApprovingQuote(false);
    }
  };

  const handleRejectQuote = async (reason?: string) => {
    if (!isOnline) {
      Alert.alert('Sin conexión', 'No es posible rechazar la cotización sin conexión a internet.');
      return;
    }
    if (!activeRequest || !user || rejectingQuote) return;
    setRejectingQuote(true);
    try {
      const reasonText = reason || 'Tarifa o alcance no se ajusta a lo requerido';
      await transitionServiceStatus(
        db,
        activeRequest.id,
        'CANCELLED_BY_CLIENT',
        { uid: user.uid, role: 'CLIENT' },
        {
          fromStatus: activeRequest.status,
          notes: `Cotización rechazada por el cliente. Motivo: ${reasonText}`,
          extraFields: {
            cancelReason: 'QUOTE_REJECTED',
            quoteStatus: 'REJECTED',
            quoteRejectionReason: reasonText,
            quoteRejectedAt: serverTimestamp(),
            cancelledAt: serverTimestamp(),
          },
        }
      );
      void notifyCentral(
        activeRequest.id,
        'Cotización Rechazada por Cliente',
        `${user.displayName || 'El cliente'} rechazó la cotización. Motivo: ${reasonText}.`,
        'CANCELLED_BY_CLIENT'
      );
      Toast.show({ type: 'info', text1: 'Cotización rechazada', text2: 'La solicitud ha sido cancelada.' });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo rechazar la cotización.');
    } finally {
      setRejectingQuote(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro de que deseas salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar Sesión',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOutWithNotifications();
            router.replace('/auth/login');
          } catch (error: any) {
            Alert.alert('Error', error.message || 'No se pudo cerrar sesión.');
          }
        },
      },
    ]);
  };

  const handleCallCentral = () => {
    Linking.openURL('tel:017008899').catch(() => {
      Alert.alert('Atención Telefónica', 'Comunícate con la central al (01) 700-8899');
    });
  };

  if (loadingRequest) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={SemanticColors.primary.main} />
      </View>
    );
  }

  const status = activeRequest ? STATUS_COPY[activeRequest.status] || STATUS_COPY.PENDING_ASSIGNMENT : null;
  const currentZone = resolveOperationalZone({ district: district || profile?.district || '' });

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <OfflineBanner />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        
        {/* CABECERA ESTILO UBER ADAPTADA A MAESTRO A DOMICILIO */}
        <AnimatedFadeIn duration={180}>
          <View style={styles.topHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.brandBadge}>
                <View style={styles.brandDot} />
                <Text style={styles.brandText}>MAESTRO A DOMICILIO</Text>
              </View>
              <Text style={[styles.mainTitle, { color: colors.text }]}>Servicio Técnico</Text>
              
              {/* Chip de Ubicación y Zona Operativa */}
              <View style={styles.locationPill}>
                <Ionicons name="location-sharp" size={13} color={SemanticColors.primary.main} />
                <Text style={styles.locationPillText} numberOfLines={1}>
                  {district || profile?.district || 'Lima y Callao'} · {currentZone.replace('_', ' ')}
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <AnimatedPressable
                accessibilityLabel="Historial de solicitudes"
                style={[styles.headerIconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push('/client/history')}
                hapticFeedback="light"
              >
                <Ionicons name="receipt-outline" size={20} color={SemanticColors.primary.main} />
              </AnimatedPressable>

              <AnimatedPressable
                accessibilityLabel="Mi perfil"
                style={[styles.headerIconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push('/profile')}
                hapticFeedback="light"
              >
                <Ionicons name="person-outline" size={20} color={colors.text} />
              </AnimatedPressable>

              <AnimatedPressable
                accessibilityLabel="Cerrar sesión"
                style={[styles.headerIconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={handleLogout}
                hapticFeedback="medium"
              >
                <Ionicons name="log-out-outline" size={20} color="#991B1B" />
              </AnimatedPressable>
            </View>
          </View>
        </AnimatedFadeIn>

        {requestError ? (
          <AnimatedFadeIn>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="alert-circle-outline" size={28} color="#991B1B" style={{ alignSelf: 'center', marginBottom: 8 }} />
              <Text style={{ color: colors.text, textAlign: 'center', fontWeight: '600' }}>{requestError}</Text>
              <AnimatedPressable
                style={[styles.primaryCtaBtn, { marginTop: 14 }]}
                onPress={() => setRequestAttempt((value) => value + 1)}
                hapticFeedback="light"
              >
                <Text style={styles.primaryCtaText}>Volver a intentar</Text>
              </AnimatedPressable>
            </View>
          </AnimatedFadeIn>
        ) : activeRequest && status ? (
          /* ========================================================================= */
          /* MODO SEGUIMIENTO EN VIVO (UBER TRIP TRACKING ADAPTADO A SERVICIO TÉCNICO) */
          /* ========================================================================= */
          <AnimatedFadeIn duration={240}>
            {/* 1. Mapa interactivo de llegada con ruta y ETA */}
            <View style={[styles.mapContainer, { borderColor: colors.border }]}>
              <ServiceMap
                location={activeRequest.location || null}
                technicians={providerLocation ? [providerLocation] : []}
                showEtaBadge={activeRequest.urgency !== 'SCHEDULED' && ['ACCEPTED', 'IN_PROGRESS'].includes(activeRequest.status)}
                style={styles.map}
              />
            </View>

            {/* 2. Tarjeta Inferior de Seguimiento */}
            <View style={[styles.trackingSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
              
              {/* Barra de progreso de etapas del servicio */}
              <View style={styles.stepperContainer}>
                <View style={styles.stepProgressRow}>
                  {[1, 2, 3, 4].map((step) => (
                    <View
                      key={step}
                      style={[
                        styles.stepperBar,
                        {
                          backgroundColor:
                            step <= status.step
                              ? SemanticColors.primary.main
                              : colors.border,
                        },
                      ]}
                    />
                  ))}
                </View>
                <View style={styles.statusTitleRow}>
                  <View style={[styles.statusIconWrap, { backgroundColor: '#E0F2FE' }]}>
                    <Ionicons name={status.icon} size={22} color={SemanticColors.primary.main} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.statusTitle, { color: colors.text }]}>{status.label}</Text>
                    <Text style={[styles.statusSubtitle, { color: colors.subtext }]}>{status.detail}</Text>
                  </View>
                </View>
              </View>

              {/* HERO BOX: PIN DE SEGURIDAD PARA LLEGADA (INSPIRADO EN UBER PIN VERIFICATION) */}
              {activeRequest.status === 'ACCEPTED' ? (
                <AnimatedFadeIn duration={200} translateDistance={6}>
                  <View style={styles.pinHeroCard}>
                    <View style={styles.pinHeader}>
                      <Ionicons name="shield-checkmark" size={18} color="#0369A1" />
                      <Text style={styles.pinHeaderLabel}>CÓDIGO DE LLEGADA AL DOMICILIO</Text>
                    </View>
                    <Text style={styles.pinDigitsDisplay}>
                      {activeRequest.securityPin || '----'}
                    </Text>
                    <Text style={styles.pinInstructionText}>
                      Muestra este código de 4 dígitos al técnico cuando toque tu puerta para autorizar el ingreso.
                    </Text>
                  </View>
                </AnimatedFadeIn>
              ) : null}

              {/* FICHA DEL TÉCNICO ASIGNADO (UBER DRIVER PROFILE CARD) */}
              {activeRequest.providerName ? (
                <View style={[styles.technicianCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={styles.technicianAvatar}>
                    <Ionicons name="person" size={26} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.technicianName, { color: colors.text }]}>
                      {activeRequest.providerName}
                    </Text>
                    <View style={styles.technicianBadgeRow}>
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={12} color="#166534" />
                        <Text style={styles.verifiedBadgeText}>Técnico Propio</Text>
                      </View>
                      <Text style={[styles.ratingPill, { color: colors.subtext }]}>★ 4.9 · Homologado</Text>
                    </View>
                  </View>

                  {/* Acciones de Contacto Rápido */}
                  <View style={styles.technicianActions}>
                    <AnimatedPressable
                      style={styles.callTechnicianBtn}
                      onPress={handleCallCentral}
                      hapticFeedback="medium"
                      accessibilityLabel="Llamar a la Central"
                    >
                      <Ionicons name="call" size={18} color="#FFFFFF" />
                    </AnimatedPressable>

                    <AnimatedPressable
                      style={[styles.chatTechnicianBtn, { borderColor: colors.border }]}
                      onPress={() => router.push({ pathname: '/chat/[id]', params: { id: activeRequest.id } })}
                      hapticFeedback="light"
                      accessibilityLabel="Abrir chat del servicio"
                    >
                      <Ionicons name="chatbubble-ellipses" size={18} color={SemanticColors.primary.main} />
                    </AnimatedPressable>
                  </View>
                </View>
              ) : null}

              {/* Componente Formal de Aprobación de Cotización (Fase 2) */}
              {activeRequest.status === 'QUOTED' ? (
                <QuoteApprovalView
                  request={activeRequest}
                  onApprove={handleAcceptQuote}
                  onReject={handleRejectQuote}
                  approving={approvingQuote}
                  rejecting={rejectingQuote}
                />
              ) : null}

              {/* Resumen del Servicio */}
              <View style={[styles.serviceSummaryBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                {activeRequest.code ? (
                  <View style={styles.summaryMetaRow}>
                    <Text style={styles.summaryMetaLabel}>CÓDIGO DE SERVICIO</Text>
                    <View style={styles.codeBadge}>
                      <Text style={styles.codeBadgeText}>{activeRequest.code}</Text>
                    </View>
                  </View>
                ) : null}

                <View style={styles.summaryDetailRow}>
                  <Ionicons name="construct-outline" size={16} color={SemanticColors.primary.main} />
                  <Text style={[styles.summaryDetailText, { color: colors.text }]}>
                    {activeRequest.serviceLabel || activeRequest.specialty}
                  </Text>
                </View>

                <View style={styles.summaryDetailRow}>
                  <Ionicons name="location-outline" size={16} color={SemanticColors.primary.main} />
                  <Text style={[styles.summaryDetailText, { color: colors.subtext }]} numberOfLines={2}>
                    {activeRequest.address} {activeRequest.addressReference ? `(${activeRequest.addressReference})` : ''}
                  </Text>
                </View>

                <View style={styles.summaryDetailRow}>
                  <Ionicons name="cash-outline" size={16} color={SemanticColors.primary.main} />
                  <Text style={[styles.summaryDetailText, { color: colors.text, fontWeight: '700' }]}>
                    Tarifa: {activeRequest.price_agreed || 'Pendiente de cotización'}
                  </Text>
                </View>
              </View>

              {/* SECCIÓN DE COMPLETADO, CONFORMIDAD, PAGO Y CSAT */}
              {activeRequest.status === 'COMPLETED' ? (
                <View style={[styles.completedSection, { borderTopColor: colors.border }]}>
                  {(!activeRequest.clientConformity || activeRequest.clientConformity === 'DISPUTED') ? (
                    <ClientConformityView
                      request={activeRequest}
                      onConfirm={handleAcceptConformity}
                      onDispute={handleDisputeConformity}
                      confirming={confirmingConformity}
                      disputing={disputingConformity}
                    />
                  ) : (
                    <>
                      <View style={styles.conformityAcceptedBox}>
                        <Ionicons name="shield-checkmark" size={20} color="#166534" />
                        <Text style={styles.conformityAcceptedText}>
                          Trabajo verificado con tu conformidad. Procede al pago y evaluación.
                        </Text>
                      </View>

                      {/* Tarjeta de Pago */}
                      <View style={[styles.paymentCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <Text style={[styles.completedSubheading, { color: colors.text }]}>Pago del servicio</Text>
                        <Text style={[styles.paymentAmount, { color: SemanticColors.primary.main }]}>
                          {activeRequest.price_agreed || 'Tarifa fijada por empresa'}
                        </Text>

                        {activeRequest.paymentStatus === 'PAID' || activeRequest.paymentStatus === 'CONFIRMED' ? (
                          <View style={styles.paymentSuccessBox}>
                            <Ionicons name="checkmark-circle" size={24} color="#16A34A" />
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: '#166534', fontWeight: '800', fontSize: 13 }}>
                                {activeRequest.paymentStatus === 'CONFIRMED' ? 'Pago confirmado por el técnico' : 'Comprobante enviado'}
                              </Text>
                              <Text style={{ color: colors.subtext, fontSize: 11 }}>
                                Método: {activeRequest.paymentMethod || 'Yape'}
                              </Text>
                            </View>
                          </View>
                        ) : (
                          <View style={{ marginTop: 6 }}>
                            <Text style={{ color: colors.subtext, fontSize: 12, marginBottom: 8 }}>
                              Selecciona la modalidad de abono:
                            </Text>
                            <View style={styles.paymentMethodsRow}>
                              {PAYMENT_METHODS.map((m) => {
                                const isSel = paymentMethod === m.id;
                                return (
                                  <AnimatedPressable
                                    key={m.id}
                                    onPress={() => setPaymentMethod(m.id)}
                                    scaleTo={0.96}
                                    style={[
                                      styles.paymentMethodChip,
                                      {
                                        borderColor: isSel ? SemanticColors.primary.main : colors.border,
                                        backgroundColor: isSel ? '#F0F9FF' : colors.card,
                                      },
                                    ]}
                                  >
                                    <Text style={{ color: isSel ? SemanticColors.primary.main : colors.text, fontWeight: '700', fontSize: 12 }}>
                                      {m.label}
                                    </Text>
                                  </AnimatedPressable>
                                );
                              })}
                            </View>

                            {voucher ? (
                              <View style={styles.voucherPreview}>
                                <Image source={{ uri: voucher.uri }} style={styles.voucherImage} resizeMode="contain" />
                                <AnimatedPressable style={styles.removeVoucherBtn} onPress={() => setVoucher(null)}>
                                  <Ionicons name="close" size={16} color="#fff" />
                                </AnimatedPressable>
                              </View>
                            ) : (
                              <AnimatedPressable style={[styles.voucherButton, { borderColor: colors.border }]} onPress={selectVoucherPhoto}>
                                <Ionicons name="document-attach-outline" size={18} color={SemanticColors.primary.main} />
                                <Text style={{ color: SemanticColors.primary.main, fontWeight: '700', fontSize: 13 }}>Adjuntar captura del comprobante</Text>
                              </AnimatedPressable>
                            )}

                            <AnimatedPressable
                              style={[styles.primaryCtaBtn, { marginTop: 10 }]}
                              onPress={handleSendPayment}
                              disabled={submittingPayment}
                              hapticFeedback="heavy"
                            >
                              {submittingPayment ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryCtaText}>Confirmar y Registrar Pago</Text>}
                            </AnimatedPressable>
                          </View>
                        )}
                      </View>

                      {/* Evaluación Oficial CSAT */}
                      <View style={[styles.ratingCardContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <Text style={[styles.completedSubheading, { color: colors.text }]}>Evaluación Oficial CSAT</Text>
                        {activeRequest.rating_given ? (
                          <View style={{ marginTop: 6 }}>
                            <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Ionicons
                                  key={star}
                                  name={star <= activeRequest.rating_given ? 'star' : 'star-outline'}
                                  size={20}
                                  color="#EAB308"
                                />
                              ))}
                              <Text style={{ color: colors.text, marginLeft: 8, fontSize: 13, fontWeight: '700' }}>
                                {activeRequest.rating_given}/5 estrellas
                              </Text>
                            </View>
                            <Text style={{ color: '#166534', fontSize: 11, fontWeight: '700', marginTop: 4 }}>
                              ✓ Evaluación completada para auditoría de calidad
                            </Text>
                          </View>
                        ) : (
                          <View style={{ marginTop: 6 }}>
                            <Text style={{ color: colors.subtext, fontSize: 12, marginBottom: 10 }}>
                              Por favor completa los 5 ítems de calidad de la atención técnica recibida.
                            </Text>
                            <AnimatedPressable
                              style={styles.primaryCtaBtn}
                              onPress={() => setCsatModalVisible(true)}
                              hapticFeedback="medium"
                            >
                              <Ionicons name="star" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                              <Text style={styles.primaryCtaText}>Realizar Evaluación CSAT (5 Pasos)</Text>
                            </AnimatedPressable>
                          </View>
                        )}
                      </View>
                    </>
                  )}

                  {/* Acciones de cierre */}
                  <View style={{ marginTop: 12 }}>
                    <AnimatedPressable
                      style={[styles.outlineBtn, { borderColor: SemanticColors.primary.main }]}
                      onPress={() => setDismissedCompletedId(activeRequest.id)}
                      hapticFeedback="light"
                    >
                      <Text style={{ color: SemanticColors.primary.main, fontWeight: '800' }}>Solicitar un nuevo servicio</Text>
                    </AnimatedPressable>
                  </View>
                </View>
              ) : (
                /* Botones de acción durante el servicio activo */
                <View style={styles.activeActionsRow}>
                  {activeRequest.status !== 'IN_PROGRESS' ? (
                    <AnimatedPressable
                      style={styles.cancelRequestBtn}
                      onPress={cancelRequest}
                      hapticFeedback="medium"
                    >
                      <Text style={styles.cancelRequestBtnText}>Cancelar Solicitud</Text>
                    </AnimatedPressable>
                  ) : null}
                </View>
              )}
            </View>
          </AnimatedFadeIn>
        ) : (
          /* ========================================================================= */
          /* MODO DESCUBRIMIENTO Y NUEVA SOLICITUD (ESTILO UBER HOME & BOTTOM SHEET)   */
          /* ========================================================================= */
          <AnimatedFadeIn duration={220}>
            {/* 1. Selector de Modalidad Oficial: Con Cotización vs Atención Simple */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Modalidad del Servicio</Text>
            </View>
            <View style={styles.serviceModeGrid}>
              <AnimatedPressable
                onPress={() => setServiceType('WITH_QUOTE')}
                scaleTo={0.97}
                style={[
                  styles.serviceModeCard,
                  {
                    borderColor: serviceType === 'WITH_QUOTE' ? SemanticColors.primary.main : colors.border,
                    backgroundColor: serviceType === 'WITH_QUOTE' ? '#F0F9FF' : colors.card,
                  },
                ]}
              >
                <View style={styles.modeCardHeader}>
                  <View style={[styles.modeIconCircle, { backgroundColor: serviceType === 'WITH_QUOTE' ? '#E0F2FE' : '#F1F5F9' }]}>
                    <Ionicons name="document-text" size={20} color={serviceType === 'WITH_QUOTE' ? SemanticColors.primary.main : colors.subtext} />
                  </View>
                  {serviceType === 'WITH_QUOTE' ? (
                    <View style={styles.activeCheckPill}>
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.modeTitle, { color: serviceType === 'WITH_QUOTE' ? SemanticColors.primary.main : colors.text }]}>
                  Con Cotización
                </Text>
                <Text style={[styles.modeSubtitle, { color: colors.subtext }]}>
                  Visita técnica con presupuesto formal previo antes de asignar la cuadrilla.
                </Text>
              </AnimatedPressable>

              <AnimatedPressable
                onPress={() => setServiceType('SIMPLE')}
                scaleTo={0.97}
                style={[
                  styles.serviceModeCard,
                  {
                    borderColor: serviceType === 'SIMPLE' ? SemanticColors.primary.main : colors.border,
                    backgroundColor: serviceType === 'SIMPLE' ? '#F0F9FF' : colors.card,
                  },
                ]}
              >
                <View style={styles.modeCardHeader}>
                  <View style={[styles.modeIconCircle, { backgroundColor: serviceType === 'SIMPLE' ? '#E0F2FE' : '#F1F5F9' }]}>
                    <Ionicons name="flash" size={20} color={serviceType === 'SIMPLE' ? SemanticColors.primary.main : colors.subtext} />
                  </View>
                  {serviceType === 'SIMPLE' ? (
                    <View style={styles.activeCheckPill}>
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.modeTitle, { color: serviceType === 'SIMPLE' ? SemanticColors.primary.main : colors.text }]}>
                  Atención Simple
                </Text>
                <Text style={[styles.modeSubtitle, { color: colors.subtext }]}>
                  Inspección y labor directa con tarifa regulada de visita técnica.
                </Text>
              </AnimatedPressable>
            </View>

            {/* 2. Selector de Especialidades Técnicas (Uber Suggestions Grid) */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>¿En qué área requieres apoyo?</Text>
            </View>
            <View style={styles.specialtyGrid}>
              {SERVICES.map((item) => {
                const isSelected = service === item.id;
                return (
                  <AnimatedPressable
                    key={item.id}
                    onPress={() => setService(item.id)}
                    scaleTo={0.96}
                    hapticFeedback="light"
                    style={[
                      styles.specialtyCard,
                      {
                        backgroundColor: isSelected ? '#F0F9FF' : colors.card,
                        borderColor: isSelected ? SemanticColors.primary.main : colors.border,
                      },
                    ]}
                  >
                    <View style={[styles.specialtyIconWrap, { backgroundColor: isSelected ? '#E0F2FE' : colors.background }]}>
                      <Ionicons
                        name={item.icon as any}
                        size={24}
                        color={isSelected ? SemanticColors.primary.main : colors.text}
                      />
                    </View>
                    <Text style={[styles.specialtyLabel, { color: isSelected ? SemanticColors.primary.main : colors.text }]}>
                      {item.label}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>

            {/* 3. Hoja de Solicitud de Servicio Técnico */}
            <View style={[styles.requestFormCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.formCardHeading, { color: colors.text }]}>Detalles de la Visita</Text>

              {/* Descripción del problema */}
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Descripción del requerimiento</Text>
              <TextInput
                style={[styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Ejemplo: Se presentó una fuga continua debajo del lavadero de la cocina desde hoy por la mañana..."
                placeholderTextColor={colors.subtext}
                multiline
                value={description}
                onChangeText={setDescription}
                maxLength={500}
              />
              <Text style={[styles.charCountHelper, { color: colors.subtext }]}>
                {description.length}/500 caracteres (mínimo 10)
              </Text>

              {/* Dirección y Distrito con Combobox Selector */}
              <BaseDistrictPicker
                label="Distrito del domicilio (Lima / Callao)"
                selectedDistrict={district}
                onSelectDistrict={(distName) => {
                  setDistrict(distName);
                }}
                placeholder="Selecciona el distrito..."
              />
              <Text style={[styles.helper, { color: colors.text, marginBottom: 8 }]}>
                {geocoding ? 'Identificando dirección por GPS…' : address || 'Selecciona el punto exacto en el mapa inferior'}
              </Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Referencia: piso, torre, interior, manzana..."
                placeholderTextColor={colors.subtext}
                value={addressReference}
                onChangeText={setAddressReference}
                maxLength={200}
              />

              {/* Mapa interactivo de confirmación */}
              <View style={styles.locationHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.mapSectionLabel, { color: colors.text }]}>Confirma el punto exacto en el mapa</Text>
                  <Text style={[styles.locationHint, { color: colors.subtext }]}>
                    Toca en el mapa para ajustar la chincheta exacta para el técnico.
                  </Text>
                </View>
                {locating ? <ActivityIndicator size="small" color={SemanticColors.primary.main} /> : null}
              </View>

              <View style={[styles.mapFrame, { borderColor: serviceLocation ? SemanticColors.primary.main : colors.border }]}>
                <ServiceMap
                  location={serviceLocation}
                  editable
                  onLocationChange={(point) => {
                    manuallySelected.current = true;
                    setServiceLocation(point);
                  }}
                  style={styles.map}
                />
              </View>

              <Text style={[styles.mapStatus, { color: serviceLocation ? '#166534' : colors.subtext }]}>
                <Ionicons name={serviceLocation ? 'checkmark-circle' : 'information-circle-outline'} size={15} />{' '}
                {serviceLocation ? 'Ubicación confirmada para la central' : 'Falta seleccionar la ubicación exacta'}
              </Text>

              {/* ¿Cuándo lo necesitas? Urgencia */}
              <Text style={[styles.fieldLabel, { color: colors.text }]}>¿Cuándo lo necesitas?</Text>
              <View style={styles.urgencyRow}>
                {[
                  ['NOW', 'Urgente', 'flash-outline'],
                  ['TODAY', 'Hoy', 'today-outline'],
                  ['SCHEDULED', 'Programar', 'calendar-outline'],
                ].map(([value, label, iconName]) => {
                  const isSel = urgency === value;
                  return (
                    <AnimatedPressable
                      key={value}
                      style={[
                        styles.urgencyChip,
                        {
                          borderColor: isSel ? SemanticColors.primary.main : colors.border,
                          backgroundColor: isSel ? '#F0F9FF' : colors.card,
                        },
                      ]}
                      onPress={() => setUrgency(value as typeof urgency)}
                      scaleTo={0.96}
                    >
                      <Ionicons
                        name={iconName as any}
                        size={15}
                        color={isSel ? SemanticColors.primary.main : colors.subtext}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={{ color: isSel ? SemanticColors.primary.main : colors.subtext, fontWeight: '700', fontSize: 13 }}>
                        {label}
                      </Text>
                    </AnimatedPressable>
                  );
                })}
              </View>

              {urgency === 'SCHEDULED' ? (
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  placeholder="Fecha y rango de horario preferido (ej: Mañana 10am-1pm)"
                  placeholderTextColor={colors.subtext}
                  value={preferredSchedule}
                  onChangeText={setPreferredSchedule}
                />
              ) : null}

              {/* Adjuntar Fotografía */}
              {photo ? (
                <View style={styles.photoPreview}>
                  <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="contain" />
                  <AnimatedPressable style={styles.removePhoto} onPress={() => setPhoto(null)}>
                    <Ionicons name="close" size={18} color="#fff" />
                  </AnimatedPressable>
                </View>
              ) : (
                <AnimatedPressable style={[styles.photoButton, { borderColor: colors.border }]} onPress={selectPhoto}>
                  <Ionicons name="camera-outline" size={20} color={SemanticColors.primary.main} />
                  <Text style={{ color: SemanticColors.primary.main, fontWeight: '700', fontSize: 13 }}>
                    Adjuntar fotografía completa de la avería
                  </Text>
                </AnimatedPressable>
              )}

              {/* Tarjeta de Tarifa de Visita Técnica y Transparencia */}
              <View style={[styles.visitFeeCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={styles.visitFeeHeader}>
                  <View style={[styles.visitFeeIconBox, { backgroundColor: '#E0F2FE' }]}>
                    <Ionicons name="cash-outline" size={22} color={SemanticColors.primary.main} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.visitFeeTitle, { color: colors.text }]}>Tarifa de Visita y Diagnóstico</Text>
                    <Text style={[styles.visitFeeSubtitle, { color: colors.subtext }]}>
                      Evaluación presencial en domicilio
                    </Text>
                  </View>
                  <Text style={[styles.visitFeeAmount, { color: SemanticColors.primary.main }]}>
                    {`S/. ${getDefaultVisitFee().toFixed(2)}`}
                  </Text>
                </View>

                <View style={styles.visitFeeNoteBox}>
                  <Ionicons name="information-circle" size={16} color="#0369A1" />
                  <Text style={styles.visitFeeNoteText}>
                    Este importe se <Text style={{ fontWeight: '800' }}>descontará de la cotización final</Text> al aprobar el trabajo.
                  </Text>
                </View>

                <Text style={[styles.visitFeeMethodLabel, { color: colors.text }]}>
                  Modalidad de Abono de Visita:
                </Text>
                <View style={styles.visitPaymentRow}>
                  {(['PLIN', 'YAPE', 'TRANSFERENCIA', 'EFECTIVO'] as const).map((method) => {
                    const isSelected = visitFeePaymentMethod === method;
                    return (
                      <AnimatedPressable
                        key={method}
                        style={[
                          styles.visitPaymentChip,
                          {
                            borderColor: isSelected ? SemanticColors.primary.main : colors.border,
                            backgroundColor: isSelected ? '#F0F9FF' : colors.card,
                          },
                        ]}
                        onPress={() => setVisitFeePaymentMethod(method)}
                        scaleTo={0.96}
                      >
                        <Text
                          style={[
                            styles.visitPaymentChipText,
                            { color: isSelected ? SemanticColors.primary.main : colors.subtext, fontWeight: isSelected ? '800' : '600' },
                          ]}
                        >
                          {method}
                        </Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              </View>

              {/* Botón Primario de Envío a Central (Uber Style High-Contrast CTA) */}
              <AnimatedPressable
                style={[
                  styles.primaryCtaBtn,
                  {
                    backgroundColor: !isOnline ? '#94A3B8' : SemanticColors.primary.main,
                  },
                ]}
                onPress={submitRequest}
                disabled={submitting || !isOnline}
                hapticFeedback="heavy"
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryCtaText}>
                      {!isOnline ? 'Sin conexión a internet' : 'Solicitar Visita a la Central'}
                    </Text>
                  </View>
                )}
              </AnimatedPressable>
              
              <Text style={[styles.disclaimer, { color: colors.subtext }]}>
                La central técnica de Maestro a Domicilio asignará un técnico homologado de cuadrilla propia.
              </Text>
            </View>
          </AnimatedFadeIn>
        )}
      </ScrollView>

      {/* Modal CSAT de 5 Pasos */}
      <CsatSurveyModal
        visible={csatModalVisible}
        onClose={() => setCsatModalVisible(false)}
        onSubmit={handleSendCsatRating}
        loading={submittingRating}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 48 : 58,
    paddingBottom: 40,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  brandDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#0369A1',
  },
  brandText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0369A1',
    letterSpacing: 1.2,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369A1',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderRow: {
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  serviceModeGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  serviceModeCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  modeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modeIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCheckPill: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0369A1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  modeSubtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
  specialtyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  specialtyCard: {
    width: '48.5%',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 64,
  },
  specialtyIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specialtyLabel: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  requestFormCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  formCardHeading: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 6,
  },
  textArea: {
    minHeight: 90,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  charCountHelper: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 8,
  },
  helper: {
    fontSize: 12,
    lineHeight: 16,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  mapSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  locationHint: {
    fontSize: 11,
    lineHeight: 15,
  },
  mapFrame: {
    height: 190,
    borderWidth: 1.5,
    borderRadius: 14,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapStatus: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 10,
  },
  urgencyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  urgencyChip: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1.5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButton: {
    height: 48,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  photoPreview: {
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 14,
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removePhoto: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitFeeCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  visitFeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  visitFeeIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitFeeTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  visitFeeSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  visitFeeAmount: {
    fontSize: 17,
    fontWeight: '900',
  },
  visitFeeNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    marginTop: 8,
  },
  visitFeeNoteText: {
    fontSize: 11,
    color: '#0369A1',
    flex: 1,
    lineHeight: 15,
  },
  visitFeeMethodLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 6,
  },
  visitPaymentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  visitPaymentChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  visitPaymentChipText: {
    fontSize: 11,
  },
  primaryCtaBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#0369A1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  disclaimer: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 10,
  },
  mapContainer: {
    height: 240,
    borderWidth: 1.5,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
  },
  trackingSheet: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  stepperContainer: {
    marginBottom: 14,
  },
  stepProgressRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  stepperBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  statusTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  statusSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  pinHeroCard: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginVertical: 12,
  },
  pinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  pinHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0369A1',
    letterSpacing: 0.8,
  },
  pinDigitsDisplay: {
    fontSize: 36,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#0369A1',
    letterSpacing: 8,
    marginVertical: 4,
  },
  pinInstructionText: {
    fontSize: 12,
    color: '#0C4A6E',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 8,
  },
  technicianCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: 14,
    marginVertical: 10,
  },
  technicianAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#0369A1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  technicianName: {
    fontSize: 15,
    fontWeight: '800',
  },
  technicianBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  ratingPill: {
    fontSize: 11,
    fontWeight: '600',
  },
  technicianActions: {
    flexDirection: 'row',
    gap: 6,
  },
  callTechnicianBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#166534',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatTechnicianBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceSummaryBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginVertical: 10,
    gap: 6,
  },
  summaryMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 4,
  },
  summaryMetaLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  codeBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  codeBadgeText: {
    color: '#0369A1',
    fontSize: 12,
    fontWeight: '800',
  },
  summaryDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryDetailText: {
    fontSize: 13,
    flex: 1,
  },
  completedSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  conformityAcceptedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    marginBottom: 12,
  },
  conformityAcceptedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
    flex: 1,
  },
  paymentCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  completedSubheading: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  paymentAmount: {
    fontSize: 19,
    fontWeight: '900',
    marginVertical: 4,
  },
  paymentSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#DCFCE7',
    marginTop: 6,
  },
  paymentMethodsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  paymentMethodChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  voucherPreview: {
    height: 160,
    borderRadius: 8,
    overflow: 'hidden',
    marginVertical: 6,
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  voucherImage: {
    width: '100%',
    height: '100%',
  },
  removeVoucherBtn: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voucherButton: {
    height: 40,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 6,
  },
  ratingCardContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  outlineBtn: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeActionsRow: {
    marginTop: 12,
  },
  cancelRequestBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#991B1B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelRequestBtnText: {
    color: '#991B1B',
    fontWeight: '700',
    fontSize: 13,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginVertical: 12,
  },
});
