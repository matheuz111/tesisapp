import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { ServiceMap } from './ServiceMap';

export function ProviderDashboard(props: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentJob: job, incomingRequest: incoming, location } = props;
  const button = (label: string, onPress: () => void, busy = false, secondary = false) => <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={onPress} style={[styles.button, { backgroundColor: secondary ? colors.background : colors.primary, borderColor: colors.border, opacity: busy ? 0.6 : 1 }]}>{busy ? <ActivityIndicator color={colors.primary} /> : <Text style={{ color: secondary ? colors.text : '#fff', fontWeight: '800' }}>{label}</Text>}</TouchableOpacity>;
  const card = { backgroundColor: colors.card, borderColor: colors.border };
  const openNavigation = () => {
    if (!job?.location) return;
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${job.location.latitude},${job.location.longitude}`).catch(() => props.onError('No se pudo abrir la navegación.'));
  };
  const getJobHeading = () => {
    if (job?.status === 'COMPLETED') return 'Servicio completado · Cobro y confirmación';
    if (job?.status === 'IN_PROGRESS') return 'Servicio en ejecución';
    return 'En camino · Pendiente de PIN';
  };
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View style={{ flex: 1 }}><Text style={[styles.brand, { color: colors.primary }]}>MAESTRO A DOMICILIO</Text><Text style={[styles.title, { color: colors.text }]}>Hola, {props.providerName || 'técnico'}</Text><Text style={{ color: colors.subtext }}>Equipo de servicios · {props.specialty || 'Completa tu especialidad'}</Text></View>
        <TouchableOpacity accessibilityLabel="Historial" style={[styles.icon, card]} onPress={() => router.push('/provider/history')}><Ionicons name="receipt-outline" size={23} color={colors.primary} /></TouchableOpacity>
        <TouchableOpacity accessibilityLabel="Perfil y cerrar sesión" style={[styles.icon, card]} onPress={() => router.push('/profile')}><Ionicons name="person-outline" size={23} color={colors.primary} /></TouchableOpacity>
      </View>
      <View style={styles.metrics}>{[[props.totalRating, 'Valoración'], [props.jobsCompleted, 'Servicios'], [props.isVerified ? 'Aprobado' : 'Pendiente', 'Perfil']].map(([value, label]) => <View key={label} style={[styles.metric, card]}><Text style={{ color: colors.primary, fontSize: 18, fontWeight: '800' }}>{value}</Text><Text style={{ color: colors.subtext, fontSize: 12 }}>{label}</Text></View>)}</View>
      {job ? <View style={[styles.card, card]}>
        <Text style={[styles.heading, { color: colors.primary }]}>{getJobHeading()}</Text>
        <Text style={[styles.heading, { color: colors.text }]}>{job.clientName || 'Cliente'}</Text>
        <Text style={{ color: colors.subtext }}>{job.serviceLabel || job.specialty}</Text>
        <Text style={[styles.price, { color: colors.primary }]}>{job.price_agreed || 'Tarifa pendiente de la central'}</Text>
        <Text style={{ color: colors.subtext }}>Tarifa fijada por la empresa{job.pricing?.description ? ` · ${job.pricing.description}` : ''}</Text>
        
        {job.status !== 'COMPLETED' ? (
          <>
            <ServiceMap location={job.location || null} technicians={location ? [{ ...location, id: 'provider', name: 'Tu última ubicación registrada' }] : []} style={styles.map} />
            <Text selectable style={{ color: colors.text }}>{job.address || 'Sin dirección registrada'}</Text>
            <Text style={{ color: colors.subtext }}>{job.addressReference || ''} {job.district || ''}</Text>
            <View style={styles.row}>{button('Navegar al punto', openNavigation, !job.location, true)}{button('Abrir chat', () => router.push({ pathname: '/chat/[id]', params: { id: job.id } }))}</View>
          </>
        ) : null}

        {job.status === 'ACCEPTED' ? (
          <View style={[styles.pin, { backgroundColor: colors.background }]}>
            <Text style={[styles.heading, { color: colors.text }]}>Validar llegada</Text>
            <Text style={{ color: colors.subtext }}>Solicita el PIN al cliente cuando llegues. Puedes acceder a tu perfil e historial mientras esperas.</Text>
            <TextInput accessibilityLabel="PIN del cliente" style={[styles.input, { color: colors.text, borderColor: colors.border }]} keyboardType="number-pad" maxLength={4} value={props.inputPin} onChangeText={props.setInputPin} placeholder="PIN de 4 dígitos" placeholderTextColor={colors.subtext} />
            {button('Validar PIN e iniciar', props.validatePin, props.verifyingPin || props.inputPin.length !== 4)}
            {button('Solicitar reasignación a la central', props.cancelJobAsProvider, props.cancelling, true)}
          </View>
        ) : null}

        {job.status === 'IN_PROGRESS' ? (
          <>
            {button('Fotografiar evidencia y finalizar', props.finishJob, props.uploading)}
            {button('Solicitar reasignación a la central', props.cancelJobAsProvider, props.cancelling, true)}
          </>
        ) : null}

        {job.status === 'COMPLETED' ? (
          <View style={[styles.paymentBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.subheading, { color: colors.text }]}>Estado del cobro</Text>
            
            {job.paymentStatus === 'CONFIRMED' ? (
              <View style={styles.confirmedRow}>
                <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.success, fontWeight: '800' }}>Pago confirmado</Text>
                  <Text style={{ color: colors.subtext, fontSize: 12 }}>Has confirmado la recepción del dinero ({job.paymentMethod || 'Efectivo/Transferencia'}).</Text>
                </View>
              </View>
            ) : (
              <View style={{ marginVertical: 8 }}>
                {job.paymentStatus === 'PAID' ? (
                  <View style={{ marginBottom: 10 }}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>
                      El cliente registró el pago por {job.paymentMethod || 'Yape/Plin'}:
                    </Text>
                    {job.paymentVoucher ? (
                      <View style={styles.voucherContainer}>
                        <Text style={{ color: colors.subtext, fontSize: 12, marginBottom: 4 }}>Comprobante adjuntado:</Text>
                        <Image source={{ uri: job.paymentVoucher }} style={styles.voucherImg} resizeMode="cover" />
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <Text style={{ color: colors.subtext, marginBottom: 8 }}>
                    Esperando que el cliente realice el pago o envíe su comprobante. Si te pagó en efectivo, confírmalo a continuación:
                  </Text>
                )}

                {button(
                  job.paymentStatus === 'PAID' ? 'Confirmar pago recibido 💵' : 'Confirmar pago en efectivo recibido 💵',
                  () => props.confirmPayment(job.id),
                  props.confirmingPayment
                )}
              </View>
            )}

            {job.rating_given ? (
              <View style={[styles.ratingFeedback, { borderColor: colors.border }]}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>Calificación recibida:</Text>
                <View style={{ flexDirection: 'row', gap: 4, marginVertical: 4 }}>
                  {[1, 2, 3, 4, 5].map((s: number) => (
                    <Ionicons key={s} name={s <= job.rating_given ? 'star' : 'star-outline'} size={18} color="#f1c40f" />
                  ))}
                </View>
                {job.review_comment ? (
                  <Text style={{ fontStyle: 'italic', color: colors.subtext, fontSize: 13 }}>"{job.review_comment}"</Text>
                ) : null}
              </View>
            ) : null}

            <View style={styles.row}>
              {button('Abrir chat', () => router.push({ pathname: '/chat/[id]', params: { id: job.id } }), false, true)}
              {button('Volver a disponibilidad', props.dismissJob, false, true)}
            </View>
          </View>
        ) : null}
      </View> : null}
      {incoming && !job ? <View style={[styles.card, card, { borderColor: colors.primary }]}>
        <Text style={[styles.heading, { color: colors.primary }]}>Nueva asignación de la central</Text>
        <Text style={[styles.heading, { color: colors.text }]}>{incoming.clientName || 'Cliente'}</Text>
        <Text style={{ color: colors.text }}>{incoming.serviceLabel || incoming.specialty}</Text>
        <Text style={{ color: colors.subtext }}>{incoming.description}</Text>
        <Text style={{ color: colors.text, marginTop: 8 }}>{incoming.address} · {incoming.district}</Text>
        <Text style={[styles.price, { color: colors.primary }]}>{incoming.price_agreed || 'Tarifa pendiente de la central'}</Text>
        <View style={styles.row}>{button('Aceptar servicio', props.acceptJob, props.accepting)}{button('Rechazar', props.rejectJob, props.accepting, true)}</View>
      </View> : null}
      {!job && !incoming ? <View style={[styles.card, card]}>
        <Text style={[styles.heading, { color: colors.text }]}>{props.isActive ? 'Disponible para asignaciones' : 'Tu disponibilidad'}</Text>
        <Text style={{ color: colors.subtext }}>La central coordina los servicios y fija la tarifa. Tú te encargas de la atención.</Text>
        {button(props.isActive ? 'Pausar disponibilidad' : 'Activar disponibilidad', props.toggleSwitch)}
        <Text style={{ color: colors.subtext, marginTop: 14 }}>Especialidad</Text>
        <TextInput value={props.specialty} onChangeText={props.setSpecialty} editable={!props.isActive} placeholder="Ej. Electricista" placeholderTextColor={colors.subtext} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
        <Text style={{ color: colors.subtext }}>Cobertura preferida</Text>
        <View style={styles.row}>{[5, 10, 15, 20, 30].map((km) => <TouchableOpacity key={km} disabled={props.isActive} onPress={() => props.setServiceRadius(km)} style={[styles.chip, { backgroundColor: props.serviceRadius === km ? colors.primary : colors.background }]}><Text style={{ color: props.serviceRadius === km ? '#fff' : colors.text }}>{km} km</Text></TouchableOpacity>)}</View>
      </View> : null}
      <View style={[styles.card, card]}><Text style={[styles.heading, { color: colors.text }]}>Mi cuenta</Text>{button('Historial de servicios', () => router.push('/provider/history'), false, true)}{button('Mi perfil', () => router.push('/profile'), false, true)}{button('Cerrar sesión', props.handleLogout, false, true)}</View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  content: { padding: 18, width: '100%', maxWidth: 780, alignSelf: 'center' }, header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }, brand: { fontSize: 11, fontWeight: '900', letterSpacing: 1.3 }, title: { fontSize: 25, fontWeight: '900', marginVertical: 5 }, icon: { width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }, metrics: { flexDirection: 'row', gap: 8, marginBottom: 14 }, metric: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12 }, card: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 14 }, heading: { fontSize: 17, fontWeight: '800', marginBottom: 7 }, price: { fontSize: 23, fontWeight: '900', marginVertical: 10 }, button: { flexGrow: 1, minHeight: 46, borderWidth: 1, borderRadius: 12, padding: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10 }, row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, map: { height: 240, marginVertical: 14 }, pin: { borderRadius: 12, padding: 14, marginTop: 14 }, input: { borderWidth: 1, borderRadius: 12, padding: 14, marginVertical: 12 }, chip: { padding: 10, borderRadius: 12, marginTop: 10 },
  paymentBox: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 14 },
  subheading: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  confirmedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, backgroundColor: 'rgba(46, 204, 113, 0.1)', marginVertical: 6 },
  voucherContainer: { marginTop: 8, marginBottom: 8 },
  voucherImg: { width: '100%', height: 160, borderRadius: 10 },
  ratingFeedback: { borderWidth: 1, borderRadius: 10, padding: 10, marginVertical: 10 },
});
