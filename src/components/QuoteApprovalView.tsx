import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Linking,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, type ThemeColors } from '../context/ThemeContext';
import { StatusBadge } from './StatusBadge';
import { OPERATIONAL_CONFIG } from '../config/operationalConfig';
import { TouchTargets, Typography } from '../theme/tokens';

export interface QuoteApprovalViewProps {
  request: any;
  onApprove: () => Promise<void>;
  onReject: (reason: string, reasonDetails?: string) => Promise<void>;
  approving: boolean;
  rejecting: boolean;
}

const REJECTION_REASONS = [
  { id: 'HIGH_PRICE', label: 'Tarifa elevada para mi presupuesto' },
  { id: 'ALREADY_RESOLVED', label: 'Ya resolví el problema por otro medio' },
  { id: 'TIME_UNSUITABLE', label: 'Horario o tiempo de atención no adecuado' },
  { id: 'OTHER', label: 'Otro motivo' },
];

export function QuoteApprovalView({
  request,
  onApprove,
  onReject,
  approving,
  rejecting,
}: QuoteApprovalViewProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('HIGH_PRICE');

  // Cálculos de desglose
  const visitFee = request.technicalVisitFee || OPERATIONAL_CONFIG.DEFAULT_VISIT_FEE_PEN;
  const priceDisplay = request.price_agreed || 'S/ 0.00';
  const pricingDesc = request.pricing?.description || 'Diagnóstico y reparación técnica especializada según reporte.';

  const handleOpenWhatsApp = () => {
    const phone = OPERATIONAL_CONFIG.CENTRAL_WHATSAPP_PHONE;
    const text = encodeURIComponent(
      `Hola Central de Maestro a Domicilio, tengo una consulta sobre la cotización de mi solicitud ${request.code || ''}.`
    );
    Linking.openURL(`https://wa.me/51${phone}?text=${text}`).catch(() => {});
  };

  const handleOpenPhone = () => {
    Linking.openURL(`tel:${OPERATIONAL_CONFIG.CENTRAL_EMERGENCY_PHONE}`).catch(() => {});
  };

  const handleConfirmReject = async () => {
    const reasonItem = REJECTION_REASONS.find((r) => r.id === selectedReason);
    setRejectModalVisible(false);
    await onReject(selectedReason, reasonItem?.label || 'Rechazado por cliente');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* 1. Encabezado con Código y Estado */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: colors.subtext }]}>PROPUESTA FORMAL DE SERVICIO</Text>
          <Text style={[styles.serviceTitle, { color: colors.text }]}>
            {request.serviceLabel || request.specialty || 'Servicio Técnico'}
          </Text>
          {request.code ? (
            <Text style={[styles.codeText, { color: colors.primary }]}>{request.code}</Text>
          ) : null}
        </View>
        <StatusBadge status="QUOTED" size="md" />
      </View>

      {/* 2. Tarjeta de Total Destacado */}
      <View style={[styles.totalCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text style={[styles.totalLabel, { color: colors.subtext }]}>MONTO TOTAL COTIZADO (INC. IGV)</Text>
        <Text style={[styles.totalAmount, { color: colors.primary }]}>{priceDisplay}</Text>
        <Text style={[styles.totalHint, { color: colors.subtext }]}>
          Tarifa corporativa inmutable · Sin sobrecostos sorpresa
        </Text>
      </View>

      {/* 3. Desglose Detallado por Rubro */}
      <View style={styles.breakdownSection}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>Desglose del Presupuesto</Text>

        <View style={[styles.breakdownRow, { borderBottomColor: colors.border }]}>
          <View style={styles.breakdownInfo}>
            <Text style={[styles.breakdownItemTitle, { color: colors.text }]}>1. Visita Técnica & Diagnóstico</Text>
            <Text style={[styles.breakdownItemSub, { color: colors.subtext }]}>
              {OPERATIONAL_CONFIG.VISIT_FEE_DEDUCTIBLE_FROM_TOTAL
                ? 'Deducible del importe total de mano de obra'
                : 'Costo fijo de desplazamiento y diagnóstico'}
            </Text>
          </View>
          <Text style={[styles.breakdownItemPrice, { color: colors.text }]}>
            S/ {visitFee.toFixed(2)}
          </Text>
        </View>

        <View style={[styles.breakdownRow, { borderBottomColor: colors.border }]}>
          <View style={styles.breakdownInfo}>
            <Text style={[styles.breakdownItemTitle, { color: colors.text }]}>2. Mano de Obra Especializada</Text>
            <Text style={[styles.breakdownItemSub, { color: colors.subtext }]}>{pricingDesc}</Text>
          </View>
          <Text style={[styles.breakdownItemPrice, { color: colors.text }]}>Incluido</Text>
        </View>

        <View style={styles.breakdownRow}>
          <View style={styles.breakdownInfo}>
            <Text style={[styles.breakdownItemTitle, { color: colors.text }]}>3. Materiales y Repuestos</Text>
            <Text style={[styles.breakdownItemSub, { color: colors.subtext }]}>
              No incluye repuestos mayores salvo acuerdo explícito en el predio
            </Text>
          </View>
          <Text style={[styles.breakdownItemPrice, { color: colors.subtext }]}>Por definir</Text>
        </View>
      </View>

      {/* 4. Vigencia y Garantía */}
      <View style={[styles.validityBadge, { backgroundColor: `${colors.primary}12`, borderColor: colors.border }]}>
        <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.validityTitle, { color: colors.text }]}>
            Garantía Oficial de {OPERATIONAL_CONFIG.WARRANTY_DAYS_DEFAULT} días
          </Text>
          <Text style={[styles.validitySub, { color: colors.subtext }]}>
            Vigencia de esta cotización: {OPERATIONAL_CONFIG.QUOTE_VALIDITY_DAYS} días calendario desde su emisión.
          </Text>
        </View>
      </View>

      {/* 5. Acciones Principales */}
      <View style={styles.actionsContainer}>
        {/* Botón Primario: Aprobar */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Aprobar cotización y solicitar asignación de técnico"
          style={[styles.primaryButton, { backgroundColor: colors.primary, minHeight: TouchTargets.min }]}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            void onApprove();
          }}
          disabled={approving || rejecting}
        >
          {approving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>✓ Aprobar Cotización</Text>
          )}
        </TouchableOpacity>

        {/* Botón Secundario: Rechazar */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Rechazar cotización y cancelar solicitud"
          style={[styles.secondaryButton, { borderColor: '#DC2626', minHeight: TouchTargets.min }]}
          onPress={() => setRejectModalVisible(true)}
          disabled={approving || rejecting}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.danger }]}>✕ Rechazar Propuesta</Text>
        </TouchableOpacity>

        {/* Botón Terciario: Hablar con la Central */}
        <View style={styles.tertiaryRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Consultar dudas con la central por WhatsApp"
            style={[styles.tertiaryButton, { borderColor: colors.border }]}
            onPress={handleOpenWhatsApp}
          >
            <Ionicons name="logo-whatsapp" size={16} color="#16A34A" />
            <Text style={[styles.tertiaryButtonText, { color: colors.text }]}>Consultar por WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Llamar por teléfono a la central"
            style={[styles.tertiaryButton, { borderColor: colors.border }]}
            onPress={handleOpenPhone}
          >
            <Ionicons name="call-outline" size={16} color={colors.primary} />
            <Text style={[styles.tertiaryButtonText, { color: colors.text }]}>Llamar a Central</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal Asistido de Rechazo con Motivo Obligatorio */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="alert-circle" size={24} color={colors.danger} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>¿Rechazar cotización?</Text>
            </View>

            <Text style={[styles.modalExplanation, { color: colors.subtext }]}>
              Ayúdanos a entender el motivo. Al confirmar el rechazo, esta solicitud se cerrará y la central quedará notificada.
            </Text>

            <View style={styles.reasonsList}>
              {REJECTION_REASONS.map((reason) => {
                const isSelected = selectedReason === reason.id;
                return (
                  <TouchableOpacity
                    key={reason.id}
                    style={[
                      styles.reasonOption,
                      {
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected ? `${colors.primary}12` : colors.background,
                      },
                    ]}
                    onPress={() => setSelectedReason(reason.id)}
                  >
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={isSelected ? colors.primary : colors.subtext}
                    />
                    <Text style={[styles.reasonLabel, { color: colors.text }]}>{reason.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { borderColor: colors.border }]}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.text }]}>Volver atrás</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmRejectButton, { backgroundColor: '#DC2626' }]}
                onPress={() => void handleConfirmReject()}
              >
                <Text style={styles.modalConfirmRejectText}>Sí, Rechazar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
    marginVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    flexShrink: 1,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  eyebrow: {
    fontSize: 11,
    flexShrink: 1,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  serviceTitle: {
    fontSize: 18,
    flexShrink: 1,
    fontWeight: '800',
  },
  codeText: {
    fontFamily: Typography.fontFamily.mono,
    fontSize: 13,
    flexShrink: 1,
    fontWeight: '700',
    marginTop: 2,
  },
  totalCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  totalLabel: {
    fontSize: 11,
    flexShrink: 1,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  totalAmount: {
    fontFamily: Typography.fontFamily.mono,
    fontSize: 32,
    flexShrink: 1,
    fontWeight: '800',
  },
  totalHint: {
    fontSize: 12,
    flexShrink: 1,
    marginTop: 4,
  },
  breakdownSection: {
    marginBottom: 14,
  },
  sectionHeading: {
    fontSize: 14,
    flexShrink: 1,
    fontWeight: '700',
    marginBottom: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    flexShrink: 1,
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  breakdownInfo: {
    flex: 1,
    paddingRight: 12,
  },
  breakdownItemTitle: {
    fontSize: 13,
    flexShrink: 1,
    fontWeight: '600',
  },
  breakdownItemSub: {
    fontSize: 11,
    flexShrink: 1,
    marginTop: 2,
    lineHeight: 15,
  },
  breakdownItemPrice: {
    fontFamily: Typography.fontFamily.mono,
    fontSize: 13,
    flexShrink: 1,
    fontWeight: '700',
  },
  validityBadge: {
    flexDirection: 'row',
    flexShrink: 1,
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 16,
  },
  validityTitle: {
    fontSize: 13,
    flexShrink: 1,
    fontWeight: '700',
  },
  validitySub: {
    fontSize: 11,
    flexShrink: 1,
    marginTop: 1,
  },
  actionsContainer: {
    gap: 8,
  },
  primaryButton: {
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    flexShrink: 1,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 8,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontSize: 14,
    flexShrink: 1,
    fontWeight: '700',
  },
  tertiaryRow: {
    flexDirection: 'row',
    flexShrink: 1,
    gap: 8,
    marginTop: 4,
  },
  tertiaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  tertiaryButtonText: {
    fontSize: 12,
    flexShrink: 1,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    flexShrink: 1,
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    flexShrink: 1,
    fontWeight: '800',
  },
  modalExplanation: {
    fontSize: 13,
    flexShrink: 1,
    lineHeight: 18,
    marginBottom: 14,
  },
  reasonsList: {
    gap: 8,
    marginBottom: 16,
  },
  reasonOption: {
    flexDirection: 'row',
    flexShrink: 1,
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  reasonLabel: {
    fontSize: 13,
    flexShrink: 1,
    fontWeight: '600',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    flexShrink: 1,
    gap: 10,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    flexShrink: 1,
    fontWeight: '700',
  },
  modalConfirmRejectButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmRejectText: {
    color: '#FFFFFF',
    fontSize: 14,
    flexShrink: 1,
    fontWeight: '700',
  },
});
