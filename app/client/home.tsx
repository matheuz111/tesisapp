import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { GeoPoint, collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { MapCoordinate, ServiceMap } from '../../src/components/ServiceMap';
import { auth, db } from '../../src/config/firebase';
import { useTheme } from '../../src/context/ThemeContext';
import { uploadServiceImage } from '../../src/services/mediaStorage';

const ORGANIZATION_ID = 'maestro-a-domicilio';
const ACTIVE_STATUSES = ['PENDING_ASSIGNMENT', 'REQUIRES_REASSIGNMENT', 'PENDING', 'ACCEPTED', 'IN_PROGRESS'];
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
};

export default function ClientHome() {
  const router = useRouter();
  const { colors } = useTheme();
  const [user, setUser] = useState(auth.currentUser);
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [service, setService] = useState('');
  const [description, setDescription] = useState('');
  const [district, setDistrict] = useState('');
  const [address, setAddress] = useState('');
  const [urgency, setUrgency] = useState<'NOW' | 'TODAY' | 'SCHEDULED'>('TODAY');
  const [preferredSchedule, setPreferredSchedule] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [serviceLocation, setServiceLocation] = useState<MapCoordinate | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) {
      setLoadingRequest(false);
      return;
    }
    const activeQuery = query(
      collection(db, 'service_requests'),
      where('clientId', '==', user.uid),
      where('status', 'in', ACTIVE_STATUSES)
    );
    return onSnapshot(activeQuery, (snapshot) => {
      const requests = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() as any }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setActiveRequest(requests[0] || null);
      setLoadingRequest(false);
    }, (error) => {
      console.error('No se pudo consultar la solicitud activa:', error);
      setLoadingRequest(false);
    });
  }, [user]);

  const selectedService = useMemo(() => SERVICES.find((item) => item.id === service), [service]);

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

  const useCurrentLocation = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Ubicación no autorizada', 'Puedes marcar manualmente en el mapa el lugar donde se realizará el servicio.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setServiceLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude });
    } catch (error) {
      console.error('No se pudo obtener la ubicación:', error);
      Alert.alert('Ubicación no disponible', 'Activa el GPS o marca manualmente el punto en el mapa.');
    } finally {
      setLocating(false);
    }
  };

  const submitRequest = async () => {
    if (!user || submitting) return;
    if (!service || description.trim().length < 10 || !district.trim() || !address.trim() || !serviceLocation || (urgency === 'SCHEDULED' && !preferredSchedule.trim())) {
      Alert.alert('Completa la solicitud', 'Selecciona un servicio, ingresa la dirección y confirma en el mapa la ubicación exacta.');
      return;
    }
    setSubmitting(true);
    try {
      const location = new GeoPoint(serviceLocation.latitude, serviceLocation.longitude);
      const requestRef = doc(collection(db, 'service_requests'));
      await setDoc(requestRef, {
        organizationId: ORGANIZATION_ID,
        intakeChannel: 'CUSTOMER_APP',
        clientId: user.uid,
        clientName: user.displayName || user.email?.split('@')[0] || 'Cliente',
        specialty: service,
        serviceLabel: selectedService?.label || service,
        description: description.trim(),
        district: district.trim(),
        address: address.trim(),
        urgency,
        preferredSchedule: urgency === 'SCHEDULED' ? preferredSchedule.trim() : null,
        issuePhoto: null,
        location,
        locationSource: 'CUSTOMER_CONFIRMED',
        status: 'PENDING_ASSIGNMENT',
        priority: urgency === 'NOW' ? 'HIGH' : 'NORMAL',
        securityPin: Math.floor(1000 + Math.random() * 9000).toString(),
        serviceStarted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (photo) {
        try {
          const issuePhoto = await uploadServiceImage(requestRef.id, user.uid, photo.base64, 'issue');
          await updateDoc(requestRef, { issuePhoto, updatedAt: serverTimestamp() });
        } catch (uploadError) {
          console.warn('La solicitud se creó sin fotografía:', uploadError);
        }
      }
      setDescription(''); setDistrict(''); setAddress(''); setService(''); setPreferredSchedule(''); setPhoto(null); setServiceLocation(null);
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
        await updateDoc(doc(db, 'service_requests', activeRequest.id), { status: 'CANCELLED_BY_CLIENT', cancelledAt: serverTimestamp(), updatedAt: serverTimestamp() });
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

        {activeRequest && status ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.statusHeader}>
              <View style={[styles.statusIcon, { backgroundColor: `${colors.primary}18` }]}><Ionicons name="construct-outline" size={26} color={colors.primary} /></View>
              <View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.text }]}>{status.label}</Text><Text style={[styles.helper, { color: colors.subtext }]}>{status.detail}</Text></View>
            </View>
            <View style={styles.progressRow}>{[1, 2, 3, 4].map((step) => <View key={step} style={[styles.progressSegment, { backgroundColor: step <= status.step ? colors.primary : colors.border }]} />)}</View>
            <View style={[styles.summaryBox, { backgroundColor: colors.background }]}>
              <Text style={[styles.summaryLabel, { color: colors.subtext }]}>SERVICIO</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{activeRequest.serviceLabel || activeRequest.specialty}</Text>
              {activeRequest.providerName ? <><Text style={[styles.summaryLabel, { color: colors.subtext }]}>TÉCNICO ASIGNADO</Text><Text style={[styles.summaryValue, { color: colors.text }]}>{activeRequest.providerName}</Text></> : null}
              {activeRequest.status === 'ACCEPTED' ? <><Text style={[styles.summaryLabel, { color: colors.subtext }]}>PIN DE SEGURIDAD</Text><Text style={[styles.pin, { color: colors.primary }]}>{activeRequest.securityPin}</Text></> : null}
            </View>
            <View style={styles.actionRow}>
              {activeRequest.providerId ? <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: activeRequest.id } })}><Ionicons name="chatbubble-outline" size={19} color="#fff" /><Text style={styles.primaryButtonText}>Contactar</Text></TouchableOpacity> : null}
              <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.danger }]} onPress={cancelRequest}><Text style={{ color: colors.danger, fontWeight: '700' }}>Cancelar</Text></TouchableOpacity>
            </View>
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
              <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} placeholder="Dirección y referencia" placeholderTextColor={colors.subtext} value={address} onChangeText={setAddress} />
              <View style={styles.locationHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Confirma el punto exacto</Text>
                  <Text style={[styles.locationHint, { color: colors.subtext }]}>Usa tu GPS y ajusta el marcador tocando o arrastrando sobre el mapa.</Text>
                </View>
                <TouchableOpacity style={[styles.locationButton, { borderColor: colors.primary }]} onPress={useCurrentLocation} disabled={locating}>
                  {locating ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="locate-outline" size={19} color={colors.primary} />}
                  <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>{locating ? 'Buscando' : 'Mi ubicación'}</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.mapFrame, { borderColor: serviceLocation ? colors.primary : colors.border }]}>
                <ServiceMap location={serviceLocation} editable onLocationChange={setServiceLocation} style={styles.map} />
              </View>
              <Text style={[styles.mapStatus, { color: serviceLocation ? colors.success : colors.subtext }]}>
                <Ionicons name={serviceLocation ? 'checkmark-circle' : 'information-circle-outline'} size={15} />{' '}
                {serviceLocation ? 'Ubicación confirmada para la central' : 'Falta seleccionar la ubicación del servicio'}
              </Text>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>¿Cuándo lo necesitas?</Text>
              <View style={styles.urgencyRow}>{[['NOW', 'Urgente'], ['TODAY', 'Hoy'], ['SCHEDULED', 'Programar']].map(([value, label]) => <TouchableOpacity key={value} style={[styles.urgencyChip, { borderColor: urgency === value ? colors.primary : colors.border }, urgency === value && { backgroundColor: `${colors.primary}15` }]} onPress={() => setUrgency(value as typeof urgency)}><Text style={{ color: urgency === value ? colors.primary : colors.subtext, fontWeight: '700' }}>{label}</Text></TouchableOpacity>)}</View>
              {urgency === 'SCHEDULED' ? <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} placeholder="Fecha y rango horario preferido" placeholderTextColor={colors.subtext} value={preferredSchedule} onChangeText={setPreferredSchedule} /> : null}
              {photo ? <View style={styles.photoPreview}><Image source={{ uri: photo.uri }} style={styles.photo} /><TouchableOpacity style={styles.removePhoto} onPress={() => setPhoto(null)}><Ionicons name="close" size={18} color="#fff" /></TouchableOpacity></View> : <TouchableOpacity style={[styles.photoButton, { borderColor: colors.border }]} onPress={selectPhoto}><Ionicons name="camera-outline" size={21} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '700' }}>Adjuntar fotografía</Text></TouchableOpacity>}
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
});
