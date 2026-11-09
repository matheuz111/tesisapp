import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { SemanticColors, TouchTarget } from '../theme/tokens';

export type RejectionReasonCode = 'DISTANCE' | 'BUSY' | 'OUT_OF_SPECIALTY' | 'OTHER';

export interface RejectionOption {
  code: RejectionReasonCode;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export const REJECTION_OPTIONS: readonly RejectionOption[] = [
  {
    code: 'DISTANCE',
    label: 'Distancia excesiva / Fuera de zona',
    description: 'El destino está muy alejado de mi ubicación o fuera del radio operativo.',
    icon: 'navigate-circle-outline',
  },
  {
    code: 'BUSY',
    label: 'Ocupado con otro servicio',
    description: 'Me encuentro actualmente atendiendo o culminando otra atención técnica.',
    icon: 'time-outline',
  },
  {
    code: 'OUT_OF_SPECIALTY',
    label: 'Fuera de mi especialidad',
    description: 'El tipo de problema requiere herramientas o especialidad distinta a la mía.',
    icon: 'construct-outline',
  },
  {
    code: 'OTHER',
    label: 'Otro motivo justificado',
    description: 'Inconveniente de transporte, emergencia personal u otra causa de fuerza mayor.',
    icon: 'alert-circle-outline',
  },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (code: RejectionReasonCode, label: string, notes?: string) => Promise<void>;
  loading?: boolean;
}

export function TechnicianRejectModal({ visible, onClose, onConfirm, loading = false }: Props) {
  const { colors } = useTheme();
  const [selectedCode, setSelectedCode] = useState<RejectionReasonCode | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!selectedCode) {
      setError('Debes seleccionar un motivo obligatorio para devolver el servicio a la central.');
      return;
    }
    const opt = REJECTION_OPTIONS.find((o) => o.code === selectedCode);
    if (!opt) return;

    setError(null);
    try {
      await onConfirm(opt.code, opt.label, notes.trim() || undefined);
      setSelectedCode(null);
      setNotes('');
    } catch (err: any) {
      setError(err?.message || 'Error al registrar el rechazo.');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: '#CBD5E1' }]}>
          {/* Cabecera */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="warning-outline" size={24} color="#B91C1C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Rechazar asignación</Text>
              <Text style={styles.subtitle}>
                Indica el motivo a la central de operaciones. El servicio será reasignado de inmediato.
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={loading}
              accessibilityLabel="Cerrar"
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color="#475569" />
            </TouchableOpacity>
          </View>

          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color="#991B1B" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Opciones */}
          <Text style={styles.sectionLabel}>MOTIVO OBLIGATORIO (Selecciona uno):</Text>
          <View style={styles.optionsList}>
            {REJECTION_OPTIONS.map((opt) => {
              const isSelected = selectedCode === opt.code;
              return (
                <TouchableOpacity
                  key={opt.code}
                  onPress={() => {
                    setSelectedCode(opt.code);
                    setError(null);
                  }}
                  disabled={loading}
                  style={[
                    styles.optionCard,
                    {
                      borderColor: isSelected ? SemanticColors.primary.main : '#E2E8F0',
                      backgroundColor: isSelected ? '#F0F9FF' : '#F8FAFC',
                    },
                  ]}
                >
                  <View style={[styles.radioCircle, { borderColor: isSelected ? SemanticColors.primary.main : '#94A3B8' }]}>
                    {isSelected && <View style={[styles.radioInner, { backgroundColor: SemanticColors.primary.main }]} />}
                  </View>
                  <Ionicons
                    name={opt.icon}
                    size={20}
                    color={isSelected ? SemanticColors.primary.main : '#475569'}
                    style={{ marginRight: 8 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionTitle, { color: isSelected ? SemanticColors.primary.main : '#0F172A' }]}>
                      {opt.label}
                    </Text>
                    <Text style={styles.optionDesc}>
                      {opt.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Nota opcional */}
          <Text style={[styles.sectionLabel, { marginTop: 10 }]}>DETALLE ADICIONAL (Opcional):</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Ej: Estoy terminando servicio en San Miguel, me toma 45 min llegar..."
            placeholderTextColor="#94A3B8"
            value={notes}
            onChangeText={setNotes}
            maxLength={180}
            multiline
            editable={!loading}
          />

          {/* Acciones */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.btn, styles.btnCancel]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.btnCancelText}>Volver</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.btn,
                styles.btnConfirm,
                { opacity: !selectedCode || loading ? 0.6 : 1 },
              ]}
              onPress={handleConfirm}
              disabled={!selectedCode || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="arrow-undo-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.btnConfirmText}>Confirmar y Devolver</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
    lineHeight: 18,
  },
  closeBtn: {
    padding: 6,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  optionsList: {
    gap: 8,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    minHeight: TouchTarget.mobileMin,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  optionDesc: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    minHeight: 56,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  btn: {
    flex: 1,
    minHeight: TouchTarget.mobileMin,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  btnCancel: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  btnCancelText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 14,
  },
  btnConfirm: {
    backgroundColor: '#DC2626',
  },
  btnConfirmText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
