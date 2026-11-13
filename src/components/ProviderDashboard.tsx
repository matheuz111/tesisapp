import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ServiceMap } from './ServiceMap';
import { TechnicianPinKeypad } from './TechnicianPinKeypad';
import { SemanticColors, TouchTarget, Typography } from '../theme/tokens';
import { useTheme, type ThemeColors } from '../context/ThemeContext';
import { useTabBarClearance } from './navigation/FloatingTabBar';
import { OPERATIONAL_CONFIG } from '../config/operationalConfig';

export function ProviderDashboard(props: any) {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const router = useRouter();
  const { currentJob: job, incomingRequest: incoming, location } = props;
  const [showPinInput, setShowPinInput] = useState(false);

  // Alto contraste para exteriores / luz solar en claro; paleta del tema en oscuro.
  const { colors, theme, toggleTheme } = useTheme();
  const sunTheme = useMemo(() => createSunTheme(colors, theme === 'dark'), [colors, theme]);
  const styles = useMemo(() => createStyles(sunTheme), [sunTheme]);

  const cardStyle = {
    backgroundColor: sunTheme.card,
    borderColor: sunTheme.border,
  };

  const openNavigation = () => {
    if (!job?.location) return;
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${job.location.latitude},${job.location.longitude}`
    ).catch(() => props.onError('No se pudo abrir la navegación de Google Maps.'));
  };

  const getJobHeading = () => {
    if (job?.status === 'COMPLETED') return 'Servicio culminado · Cobro y confirmación';
    if (job?.status === 'IN_PROGRESS') return 'Servicio en ejecución técnica';
    if (job?.arrivalValidated || job?.pinValidatedAt) return 'Llegada validada · Listo para iniciar';
    return 'En camino al destino · Pendiente validación de PIN';
  };

  const isArrivalValidated = Boolean(job?.arrivalValidated || job?.pinValidatedAt);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: sunTheme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        overScrollMode="never"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: tabBarClearance + 16 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
                {/* Indicador de Evidencias en Cola Offline (Fase 4) */}
        {Boolean(props.offlinePhotosCount && props.offlinePhotosCount > 0) && (
          <View style={{ backgroundColor: sunTheme.warningBg, borderColor: sunTheme.warningBorder, borderWidth: 1, padding: 12, borderRadius: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="cloud-offline" size={22} color={sunTheme.warningText} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: sunTheme.warningText, fontSize: 13, fontWeight: '800' }}>
                {props.offlinePhotosCount} evidencia(s) fotográfica(s) en cola offline
              </Text>
              <Text style={{ color: sunTheme.warningText, fontSize: 11, marginTop: 2, lineHeight: 15 }}>
                Se sincronizarán automáticamente con el servidor apenas se recupere la conexión a internet.
              </Text>
            </View>
          </View>
        )}

        {/* Cabecera Principal */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={styles.brandRow}>
              <View style={[styles.brandLogoTile, { borderColor: sunTheme.border }]}>
                <Image source={require('../../assets/brand/logo-icon.png')} style={styles.brandLogo} resizeMode="contain" accessibilityLabel="Logo de Maestro a Domicilio" />
              </View>
              <Text style={[styles.brand, { color: sunTheme.primary }]}>MAESTRO A DOMICILIO</Text>
            </View>
            <Text style={[styles.title, { color: sunTheme.text }]}>Hola, {props.providerName || 'Técnico'}</Text>
            <Text style={[styles.techSubtitle, { color: sunTheme.textSecondary }]}>
              Equipo Técnico Operativo · {props.specialty || 'Especialidad pendiente'}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Llamar a la central de operaciones"
            style={[styles.iconBtn, cardStyle]}
            onPress={() => Linking.openURL(`tel:${OPERATIONAL_CONFIG.CENTRAL_EMERGENCY_PHONE}`).catch(() => props.onError('No se pudo iniciar la llamada a la central.'))}
          >
            <Ionicons name="call-outline" size={22} color={sunTheme.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            style={[styles.iconBtn, cardStyle]}
            onPress={toggleTheme}
          >
            <Ionicons name={theme === 'dark' ? 'sunny-outline' : 'moon-outline'} size={22} color={sunTheme.text} />
          </TouchableOpacity>
        </View>

        {/* Métricas del Técnico */}
        <View style={styles.metricsRow}>
          <View style={[styles.metricCard, cardStyle]}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.metricValue, { color: sunTheme.primary }]}>{props.totalRating || '5.0'}</Text>
            <Text style={[styles.metricLabel, { color: sunTheme.textSecondary }]}>Calificación</Text>
          </View>
          <View style={[styles.metricCard, cardStyle]}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.metricValue, { color: sunTheme.primary }]}>{props.jobsCompleted || 0}</Text>
            <Text style={[styles.metricLabel, { color: sunTheme.textSecondary }]}>Servicios</Text>
          </View>
          <View style={[styles.metricCard, cardStyle]}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.metricValue, { color: props.isVerified ? sunTheme.successText : sunTheme.warningText }]}>
              {props.isVerified ? 'Habilitado' : 'Pendiente'}
            </Text>
            <Text style={[styles.metricLabel, { color: sunTheme.textSecondary }]}>Estado</Text>
          </View>
        </View>

        {/* ── CASO 1: SERVICIO ACTIVO ASIGNADO ── */}
        {job ? (
          <View style={[styles.card, cardStyle]}>
            {/* Banner de Estado Operativo */}
            <View style={[styles.statusBanner, { backgroundColor: sunTheme.infoBg, borderColor: sunTheme.infoBorder }]}>
              <Ionicons name="construct" size={18} color={sunTheme.primary} />
              <Text style={[styles.statusBannerText, { color: sunTheme.primary }]}>
                {getJobHeading()}
              </Text>
            </View>

            {/* Código y Cliente */}
            <View style={styles.jobClientHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.clientName, { color: sunTheme.text }]}>
                  {job.clientName || 'Cliente Particular'}
                </Text>
                <Text style={[styles.serviceTypeLabel, { color: sunTheme.textSecondary }]}>
                  {job.serviceLabel || job.specialty || 'Servicio Técnico'}
                </Text>
              </View>
              {job.code && (
                <View style={styles.codePill}>
                  <Text style={styles.codeText} numberOfLines={2}>{job.code}</Text>
                </View>
              )}
            </View>

            {/* Tarifa Oficial */}
            <View style={styles.priceContainer}>
              <Text style={[styles.priceTag, { color: sunTheme.primary }]}>
                {job.price_agreed || 'Tarifa establecida por Central'}
              </Text>
              <Text style={[styles.priceNote, { color: sunTheme.textSecondary }]}>
                Tarifa oficial de la empresa · Visita técnica deducible
              </Text>
            </View>

            {/* ── SECCIÓN SEGÚN ESTADO ── */}

            {/* A) ESTADO: ACCEPTED (En camino o Llegada validada) */}
            {job.status === 'ACCEPTED' && (
              <View style={{ marginTop: 12 }}>
                {/* Mapa y Dirección */}
                <ServiceMap
                  location={job.location || null}
                  technicians={location ? [{ ...location, id: 'provider', name: 'Tu ubicación' }] : []}
                  showEtaBadge={!isArrivalValidated}
                  style={styles.map}
                />
                <View style={styles.addressBox}>
                  <Ionicons name="location-outline" size={18} color={sunTheme.primary} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text selectable style={[styles.addressText, { color: sunTheme.text }]}>
                      {job.address || 'Sin dirección exacta'}
                    </Text>
                    {job.addressReference ? (
                      <Text style={[styles.addressRef, { color: sunTheme.textSecondary }]}>
                        Ref: {job.addressReference} ({job.district || 'Lima'})
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Sub-caso A1: Todavía NO validó PIN de llegada */}
                {!isArrivalValidated ? (
                  <View style={styles.stageContainer}>
                    {/* Botón Primario 1: Abrir en mapas */}
                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: sunTheme.primarySolid }]}
                      onPress={openNavigation}
                    >
                      <Ionicons name="navigate" size={20} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>Abrir en Google Maps</Text>
                    </TouchableOpacity>

                    {/* Módulo de Validación de PIN al llegar */}
                    <View style={[styles.pinModule, { backgroundColor: sunTheme.surfaceAlt, borderColor: sunTheme.border }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Ionicons name="keypad-outline" size={20} color={sunTheme.primary} />
                        <Text style={[styles.moduleTitle, { color: sunTheme.text }]}>
                          Validar llegada con PIN
                        </Text>
                      </View>
                      <Text style={[styles.moduleHelp, { color: sunTheme.textSecondary }]}>
                        Pide al cliente el código de 4 dígitos que aparece en su pantalla para registrar tu llegada en el domicilio.
                      </Text>

                      {/* Teclado numérico táctil de 72px */}
                      <TechnicianPinKeypad
                        pin={props.inputPin}
                        onChangePin={props.setInputPin}
                        onSubmitPin={props.validateArrivalPin || props.validatePin}
                        verifying={props.verifyingPin}
                        lockoutSeconds={props.lockoutSeconds}
                      />
                    </View>

                    {/* Acciones Secundarias */}
                    <View style={styles.secondaryActionsRow}>
                      <TouchableOpacity
                        style={[styles.secondaryBtn, { borderColor: sunTheme.border }]}
                        onPress={() => router.push({ pathname: '/chat/[id]', params: { id: job.id } })}
                      >
                        <Ionicons name="chatbubble-ellipses-outline" size={18} color={sunTheme.text} />
                        <Text style={[styles.secondaryBtnText, { color: sunTheme.text }]}>Chat con cliente</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.secondaryBtn, { borderColor: sunTheme.dangerBorder }]}
                        onPress={props.cancelJobAsProvider}
                        disabled={props.cancelling}
                      >
                        <Ionicons name="arrow-undo-outline" size={18} color={sunTheme.danger} />
                        <Text style={[styles.secondaryBtnText, { color: sunTheme.danger }]}>
                          {props.cancelling ? 'Devolviendo...' : 'Solicitar reasignación'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  /* Sub-caso A2: PIN Validado -> Botón Primario 2: Iniciar Trabajo */
                  <View style={styles.stageContainer}>
                    <View style={[styles.arrivalConfirmedBox, { backgroundColor: sunTheme.successBg, borderColor: sunTheme.successBorder }]}>
                      <Ionicons name="checkmark-circle" size={24} color={sunTheme.successText} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.arrivalConfirmedTitle, { color: sunTheme.successText }]}>
                          ¡Llegada confirmada con PIN!
                        </Text>
                        <Text style={[styles.arrivalConfirmedSubtitle, { color: sunTheme.successText }]}>
                          Tu hora de arribo quedó registrada en la central. Presiona el botón para iniciar la intervención.
                        </Text>
                      </View>
                    </View>

                    {/* Botón Primario Único: Iniciar trabajo */}
                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: '#166534', marginTop: 14 }]}
                      onPress={props.startJob}
                    >
                      <Ionicons name="construct" size={20} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>Iniciar trabajo técnico</Text>
                    </TouchableOpacity>

                    <View style={styles.secondaryActionsRow}>
                      <TouchableOpacity
                        style={[styles.secondaryBtn, { borderColor: sunTheme.border }]}
                        onPress={() => router.push({ pathname: '/chat/[id]', params: { id: job.id } })}
                      >
                        <Ionicons name="chatbubble-ellipses-outline" size={18} color={sunTheme.text} />
                        <Text style={[styles.secondaryBtnText, { color: sunTheme.text }]}>Chat</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.secondaryBtn, { borderColor: sunTheme.dangerBorder }]}
                        onPress={props.cancelJobAsProvider}
                        disabled={props.cancelling}
                      >
                        <Ionicons name="arrow-undo-outline" size={18} color={sunTheme.danger} />
                        <Text style={[styles.secondaryBtnText, { color: sunTheme.danger }]}>Reasignar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* B) ESTADO: IN_PROGRESS (En ejecución técnica) */}
            {job.status === 'IN_PROGRESS' && (
              <View style={styles.stageContainer}>
                {/* Control de Calidad y Evidencias */}
                <View style={[styles.evidenceBox, { backgroundColor: sunTheme.surfaceAlt, borderColor: sunTheme.border }]}>
                  <Text style={[styles.evidenceSectionTitle, { color: sunTheme.text }]}>
                    Control de Calidad · Evidencia Fotográfica
                  </Text>

                  {/* Foto Inicial (Antes) */}
                  <View style={styles.photoRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.photoLabel, { color: sunTheme.text }]}>1. Estado Inicial (Antes)</Text>
                      <Text style={[styles.photoHelper, { color: sunTheme.textSecondary }]}>
                        {job.issuePhoto || job.issue_photo
                          ? '✓ Foto registrada correctamente (EVID_INI)'
                          : 'Toma la foto antes de desarmar o reparar'}
                      </Text>
                    </View>
                    {job.issuePhoto || job.issue_photo ? (
                      <Image
                        source={{ uri: job.issuePhoto || job.issue_photo }}
                        style={styles.evidenceThumbnail}
                        resizeMode="cover"
                      />
                    ) : (
                      <TouchableOpacity
                        style={[styles.photoActionBtn, { borderColor: sunTheme.primary }]}
                        onPress={props.takeInitialPhoto}
                        disabled={props.uploadingInitial}
                      >
                        {props.uploadingInitial ? (
                          <ActivityIndicator size="small" color={sunTheme.primary} />
                        ) : (
                          <>
                            <Ionicons name="camera" size={18} color={sunTheme.primary} />
                            <Text style={[styles.photoActionText, { color: sunTheme.primary }]}>Foto Antes</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Botón Primario Único: Finalizar y Enviar Evidencia (Después) */}
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: sunTheme.primarySolid, marginTop: 14 }]}
                  onPress={props.finishJob}
                  disabled={props.uploading}
                >
                  {props.uploading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="camera-reverse" size={20} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>Finalizar y enviar evidencia (Después)</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Acciones Secundarias */}
                <View style={styles.secondaryActionsRow}>
                  <TouchableOpacity
                    style={[styles.secondaryBtn, { borderColor: sunTheme.border }]}
                    onPress={() => router.push({ pathname: '/chat/[id]', params: { id: job.id } })}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={18} color={sunTheme.text} />
                    <Text style={[styles.secondaryBtnText, { color: sunTheme.text }]}>Abrir chat</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.secondaryBtn, { borderColor: sunTheme.dangerBorder }]}
                    onPress={props.cancelJobAsProvider}
                    disabled={props.cancelling}
                  >
                    <Ionicons name="arrow-undo-outline" size={18} color={sunTheme.danger} />
                    <Text style={[styles.secondaryBtnText, { color: sunTheme.danger }]}>Reasignar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* C) ESTADO: COMPLETED (Culminado · Confirmación de Cobro) */}
            {job.status === 'COMPLETED' && (
              <View style={[styles.stageContainer, { marginTop: 10 }]}>
                <View style={[styles.paymentBox, { backgroundColor: sunTheme.surfaceAlt, borderColor: sunTheme.border }]}>
                  <Text style={[styles.moduleTitle, { color: sunTheme.text }]}>
                    Confirmación de Recepción de Pago
                  </Text>

                  {job.paymentStatus === 'CONFIRMED' ? (
                    <View style={[styles.arrivalConfirmedBox, { backgroundColor: sunTheme.successBg, borderColor: sunTheme.successBorder, marginTop: 10 }]}>
                      <Ionicons name="checkmark-done-circle" size={24} color={sunTheme.successText} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.arrivalConfirmedTitle, { color: sunTheme.successText }]}>
                          Pago confirmado exitosamente
                        </Text>
                        <Text style={[styles.arrivalConfirmedSubtitle, { color: sunTheme.successText }]}>
                          Has verificado la recepción de fondos ({job.paymentMethod || 'Efectivo / Transferencia'}).
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={{ marginTop: 10 }}>
                      <Text style={[styles.moduleHelp, { color: sunTheme.textSecondary, marginBottom: 10 }]}>
                        {job.paymentStatus === 'PAID'
                          ? `El cliente reportó haber pagado mediante ${job.paymentMethod || 'Yape/Plin'}. Confirma la recepción:`
                          : 'Esperando el pago del cliente. Si te pagó en efectivo en mano, presiona confirmar:'}
                      </Text>

                      {job.paymentVoucher ? (
                        <View style={{ marginBottom: 12 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: sunTheme.text, marginBottom: 4 }}>
                            Comprobante adjuntado por el cliente:
                          </Text>
                          <Image
                            source={{ uri: job.paymentVoucher }}
                            style={{ width: '100%', height: 160, borderRadius: 8, backgroundColor: '#0F172A' }}
                            resizeMode="contain"
                          />
                        </View>
                      ) : null}

                      {/* Botón Primario de Cobro */}
                      <TouchableOpacity
                        style={[styles.primaryBtn, { backgroundColor: '#166534' }]}
                        onPress={() => props.confirmPayment(job.id)}
                        disabled={props.confirmingPayment}
                      >
                        {props.confirmingPayment ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="cash-outline" size={20} color="#FFFFFF" />
                            <Text style={styles.primaryBtnText}>
                              {job.paymentStatus === 'PAID' ? 'Confirmar pago recibido' : 'Confirmar pago en efectivo recibido'}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Acciones de cierre */}
                <View style={styles.secondaryActionsRow}>
                  <TouchableOpacity
                    style={[styles.secondaryBtn, { borderColor: sunTheme.border }]}
                    onPress={() => router.push({ pathname: '/chat/[id]', params: { id: job.id } })}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={18} color={sunTheme.text} />
                    <Text style={[styles.secondaryBtnText, { color: sunTheme.text }]}>Chat</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.secondaryBtn, { borderColor: sunTheme.border }]}
                    onPress={props.dismissJob}
                  >
                    <Ionicons name="checkmark-outline" size={18} color={sunTheme.primary} />
                    <Text style={[styles.secondaryBtnText, { color: sunTheme.primary }]}>Volver a disponible</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : null}

        {/* ── CASO 2: SOLICITUD ENTRANTE (PENDING) ── */}
        {incoming && !job ? (
          <View style={[styles.card, cardStyle, { borderColor: sunTheme.primary, borderWidth: 2 }]}>
            <View style={[styles.statusBanner, { backgroundColor: sunTheme.warningBg, borderColor: sunTheme.warningBorder }]}>
              <Ionicons name="notifications" size={18} color={sunTheme.warningText} />
              <Text style={[styles.statusBannerText, { color: sunTheme.warningText }]}>
                Nueva Asignación de la Central
              </Text>
            </View>

            <Text style={[styles.clientName, { color: sunTheme.text, marginTop: 8 }]}>
              {incoming.clientName || 'Cliente Particular'}
            </Text>
            <Text style={[styles.serviceTypeLabel, { color: sunTheme.textSecondary }]}>
              {incoming.serviceLabel || incoming.specialty}
            </Text>
            <Text style={[styles.incomingDesc, { color: sunTheme.text }]}>
              {incoming.description || 'Sin descripción detallada'}
            </Text>

            <View style={styles.addressBox}>
              <Ionicons name="location" size={18} color={sunTheme.primary} />
              <Text style={[styles.addressText, { color: sunTheme.text }]}>
                {incoming.address} · {incoming.district || 'Lima'}
              </Text>
            </View>

            <View style={styles.priceContainer}>
              <Text style={[styles.priceTag, { color: sunTheme.primary }]}>
                {incoming.price_agreed || 'Tarifa oficial fijada por central'}
              </Text>
            </View>

            {/* Acciones de la Asignación */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { flex: 1.2, backgroundColor: props.isOnline === false ? '#94A3B8' : '#166534' },
                ]}
                onPress={props.acceptJob}
                disabled={props.accepting || props.isOnline === false}
              >
                {props.accepting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    <Text style={styles.primaryBtnText}>Aceptar servicio</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryBtn, { flex: 0.8, borderColor: sunTheme.dangerBorder }]}
                onPress={props.rejectJob}
                disabled={props.accepting}
              >
                <Ionicons name="close" size={18} color={sunTheme.danger} />
                <Text style={[styles.secondaryBtnText, { color: sunTheme.danger }]}>Rechazar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* ── CASO 3: SIN SERVICIO ACTIVO (DISPONIBILIDAD) ── */}
        {!job && !incoming ? (
          <View style={[styles.card, cardStyle]}>
            <Text style={[styles.clientName, { color: sunTheme.text }]}>
              {props.isActive ? 'Conectado · Listo para servicios' : 'Desconectado'}
            </Text>
            <Text style={[styles.moduleHelp, { color: sunTheme.textSecondary, marginBottom: 14 }]}>
              La central coordina las solicitudes de los clientes y fija las tarifas homologadas. Conéctate para recibir asignaciones en tu radio operativo.
            </Text>

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                { backgroundColor: props.isActive ? '#DC2626' : sunTheme.primarySolid },
              ]}
              onPress={props.toggleSwitch}
            >
              <Ionicons
                name={props.isActive ? 'power' : 'radio-outline'}
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.primaryBtnText}>
                {props.isActive ? 'Pausar disponibilidad' : 'Activar disponibilidad'}
              </Text>
            </TouchableOpacity>

            <View style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: sunTheme.text, marginBottom: 6 }}>
                Especialidad técnica
              </Text>
              <TextInput
                value={props.specialty}
                onChangeText={props.setSpecialty}
                editable={!props.isActive}
                placeholder="Ej. Gasfitero, Electricista"
                placeholderTextColor={sunTheme.textSecondary}
                style={[styles.inputField, { borderColor: sunTheme.border, color: sunTheme.text }]}
              />

              <Text style={{ fontSize: 13, fontWeight: '700', color: sunTheme.text, marginTop: 10, marginBottom: 6 }}>
                Radio de cobertura preferido
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[5, 10, 15, 20, 30].map((km) => (
                  <TouchableOpacity
                    key={km}
                    disabled={props.isActive}
                    onPress={() => props.setServiceRadius(km)}
                    style={[
                      styles.kmChip,
                      {
                        backgroundColor: props.serviceRadius === km ? sunTheme.primarySolid : sunTheme.surfaceAlt,
                        borderColor: props.serviceRadius === km ? sunTheme.primarySolid : sunTheme.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: props.serviceRadius === km ? '#FFFFFF' : sunTheme.text,
                        fontWeight: '700',
                        fontSize: 13,
                      }}
                    >
                      {km} km
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        {/* Accesos rápidos */}
        <View style={[styles.card, cardStyle, { marginTop: 10 }]}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: sunTheme.text, marginBottom: 10 }}>
            Mi Cuenta de Técnico
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={[styles.secondaryBtn, { flex: 1, borderColor: sunTheme.border }]}
              onPress={() => router.push('/provider/history')}
            >
              <Ionicons name="time-outline" size={18} color={sunTheme.text} />
              <Text style={[styles.secondaryBtnText, { color: sunTheme.text }]}>Historial</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { flex: 1, borderColor: sunTheme.border }]}
              onPress={() => router.push('/profile')}
            >
              <Ionicons name="person-circle-outline" size={18} color={sunTheme.text} />
              <Text style={[styles.secondaryBtnText, { color: sunTheme.text }]}>Perfil</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type SunTheme = ReturnType<typeof createSunTheme>;

function createSunTheme(colors: ThemeColors, dark: boolean) {
  const st = colors.states;
  return {
    background: colors.background,
    card: colors.card,
    surfaceAlt: dark ? colors.input : '#F8FAFC',
    border: dark ? colors.border : '#CBD5E1',
    primary: dark ? colors.primary : SemanticColors.primary.main, // texto/iconos de acento
    primarySolid: SemanticColors.primary.main, // fondo sólido con texto blanco (AA en ambos temas)
    text: colors.text,
    textSecondary: dark ? colors.subtext : '#334155',
    infoBg: colors.primarySoft,
    infoStrong: colors.primaryStrong,
    infoBorder: dark ? colors.border : '#BAE6FD',
    successBg: st.completed.bg,
    successText: st.completed.fg,
    successBorder: dark ? st.completed.border : '#86EFAC',
    warningBg: st.pending.bg,
    warningText: st.pending.fg,
    warningBorder: dark ? st.pending.border : '#FDE68A',
    dangerBg: st.danger.bg,
    dangerText: st.danger.fg,
    danger: dark ? st.danger.fg : '#DC2626',
    dangerBorder: dark ? st.danger.border : '#FCA5A5',
  };
}

const createStyles = (sunTheme: SunTheme) => StyleSheet.create({
  content: {
    padding: 16,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    flexShrink: 1,
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  brandLogoTile: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  brandLogo: { width: 22, height: 21 },
  brand: {
    fontSize: 11,
    flexShrink: 1,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 22,
    flexShrink: 1,
    fontWeight: '900',
    marginVertical: 2,
  },
  techSubtitle: {
    fontSize: 13,
    flexShrink: 1,
    fontWeight: '600',
  },
  iconBtn: {
    width: TouchTarget.mobileMin,
    height: TouchTarget.mobileMin,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    flexShrink: 1,
    gap: 8,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  metricValue: {
    alignSelf: 'stretch',
    textAlign: 'center',
    fontSize: 20,
    flexShrink: 1,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 12,
    flexShrink: 1,
    fontWeight: '600',
    marginTop: 2,
  },
  card: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statusBanner: {
    flexDirection: 'row',
    flexShrink: 1,
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  statusBannerText: {
    fontSize: 13,
    flexShrink: 1,
    fontWeight: '800',
  },
  jobClientHeader: {
    flexDirection: 'row',
    flexShrink: 1,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  clientName: {
    fontSize: 18,
    flexShrink: 1,
    fontWeight: '800',
  },
  serviceTypeLabel: {
    fontSize: 14,
    flexShrink: 1,
    fontWeight: '600',
    marginTop: 2,
  },
  codePill: {
    backgroundColor: sunTheme.infoStrong,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  codeText: {
    fontFamily: Typography.fontFamily.mono,
    color: sunTheme.primary,
    fontWeight: '800',
    fontSize: 12,
    flexShrink: 1,
  },
  priceContainer: {
    marginVertical: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: sunTheme.surfaceAlt,
  },
  priceTag: {
    fontFamily: Typography.fontFamily.mono,
    fontSize: 22,
    flexShrink: 1,
    fontWeight: '900',
  },
  priceNote: {
    fontSize: 12,
    flexShrink: 1,
    marginTop: 2,
  },
  map: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 10,
  },
  addressBox: {
    flexDirection: 'row',
    flexShrink: 1,
    gap: 8,
    alignItems: 'flex-start',
    marginVertical: 6,
  },
  addressText: {
    fontSize: 14,
    flexShrink: 1,
    fontWeight: '700',
  },
  addressRef: {
    fontSize: 12,
    flexShrink: 1,
    marginTop: 2,
  },
  stageContainer: {
    marginTop: 10,
  },
  primaryBtn: {
    minHeight: TouchTarget.mobileMin,
    borderRadius: 12,
    flexDirection: 'row',
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    flexShrink: 1,
    fontWeight: '800',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    flexShrink: 1,
    gap: 10,
    marginTop: 10,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: TouchTarget.mobileMin,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: sunTheme.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  secondaryBtnText: {
    fontSize: 13,
    flexShrink: 1,
    fontWeight: '700',
  },
  pinModule: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 14,
  },
  moduleTitle: {
    fontSize: 15,
    flexShrink: 1,
    fontWeight: '800',
  },
  moduleHelp: {
    fontSize: 12,
    flexShrink: 1,
    lineHeight: 17,
  },
  arrivalConfirmedBox: {
    flexDirection: 'row',
    flexShrink: 1,
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  arrivalConfirmedTitle: {
    fontSize: 14,
    flexShrink: 1,
    fontWeight: '800',
  },
  arrivalConfirmedSubtitle: {
    fontSize: 12,
    flexShrink: 1,
    marginTop: 2,
    lineHeight: 16,
  },
  evidenceBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 8,
  },
  evidenceSectionTitle: {
    fontSize: 14,
    flexShrink: 1,
    fontWeight: '800',
    marginBottom: 10,
  },
  photoRow: {
    flexDirection: 'row',
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  photoLabel: {
    fontSize: 13,
    flexShrink: 1,
    fontWeight: '700',
  },
  photoHelper: {
    fontSize: 12,
    flexShrink: 1,
    marginTop: 2,
  },
  photoActionBtn: {
    flexDirection: 'row',
    flexShrink: 1,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: sunTheme.card,
  },
  photoActionText: {
    fontSize: 12,
    flexShrink: 1,
    fontWeight: '700',
  },
  evidenceThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  paymentBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  incomingDesc: {
    fontSize: 13,
    flexShrink: 1,
    lineHeight: 18,
    marginVertical: 8,
  },
  inputField: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    flexShrink: 1,
    backgroundColor: sunTheme.card,
  },
  kmChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
});
