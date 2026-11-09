import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, TouchTarget } from '../theme/tokens';

interface Props {
  request: any;
  onConfirm: () => Promise<void>;
  onDispute: (reason: string) => Promise<void>;
  confirming?: boolean;
  disputing?: boolean;
}

export function ClientConformityView({
  request,
  onConfirm,
  onDispute,
  confirming = false,
  disputing = false,
}: Props) {
  const [problemModalVisible, setProblemModalVisible] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSendProblem = async () => {
    if (!disputeReason.trim()) {
      setError('Por favor describe brevemente qué ocurrió para que la central te atienda.');
      return;
    }
    setError(null);
    try {
      await onDispute(disputeReason.trim());
      setProblemModalVisible(false);
      setDisputeReason('');
    } catch (err: any) {
      setError(err?.message || 'Error al reportar el problema.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Cabecera de Conformidad */}
      <View style={styles.headerBox}>
        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark" size={24} color="#0369A1" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Revisión de Conformidad del Servicio</Text>
          <Text style={styles.subtitle}>
            El técnico ha finalizado las labores. Revisa el resultado antes de proceder al pago.
          </Text>
        </View>
      </View>

      {/* Galería de Evidencias Antes y Después */}
      {(request.issuePhoto || request.evidence_photo || request.evidencePhoto) && (
        <View style={styles.evidenceSection}>
          <Text style={styles.sectionLabel}>EVIDENCIA FOTOGRÁFICA REGISTRADA:</Text>
          <View style={styles.photosRow}>
            {request.issuePhoto ? (
              <View style={styles.photoCard}>
                <View style={styles.photoTag}>
                  <Text style={styles.photoTagText}>1. ANTES (INICIAL)</Text>
                </View>
                <Image
                  source={{ uri: request.issuePhoto }}
                  style={styles.photoImg}
                  resizeMode="cover"
                />
              </View>
            ) : null}

            {(request.evidence_photo || request.evidencePhoto) ? (
              <View style={styles.photoCard}>
                <View style={[styles.photoTag, { backgroundColor: '#166534' }]}>
                  <Text style={styles.photoTagText}>2. DESPUÉS (FINAL)</Text>
                </View>
                <Image
                  source={{ uri: request.evidence_photo || request.evidencePhoto }}
                  style={styles.photoImg}
                  resizeMode="cover"
                />
              </View>
            ) : null}
          </View>
        </View>
      )}

      {/* Resumen del Servicio */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Especialidad:</Text>
          <Text style={styles.summaryVal}>{request.serviceLabel || request.specialty}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Técnico Responsable:</Text>
          <Text style={styles.summaryVal}>{request.providerName || 'Técnico Especialista'}</Text>
        </View>
        <View style={[styles.summaryRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
          <Text style={styles.summaryLabel}>Total Liquidado:</Text>
          <Text style={styles.summaryPrice}>{request.price_agreed || 'Tarifa fijada por central'}</Text>
        </View>
      </View>

      {/* Acciones de Conformidad */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.btnConfirm, confirming && { opacity: 0.6 }]}
          onPress={onConfirm}
          disabled={confirming || disputing}
        >
          {confirming ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.btnConfirmText}>Estoy conforme con el trabajo</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnDispute, disputing && { opacity: 0.6 }]}
          onPress={() => setProblemModalVisible(true)}
          disabled={confirming || disputing}
        >
          <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
          <Text style={styles.btnDisputeText}>Reportar un problema a la Central</Text>
        </TouchableOpacity>
      </View>

      {/* Modal para Reportar Problema */}
      <Modal
        visible={problemModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProblemModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={24} color="#B91C1C" />
              <Text style={styles.modalTitle}>Reportar inconveniente</Text>
            </View>

            <Text style={styles.modalDesc}>
              Cuéntanos qué problema persiste o qué no se completó adecuadamente. La central revisará la evidencia y se pondrá en contacto contigo.
            </Text>

            {error && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={16} color="#991B1B" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TextInput
              style={styles.modalInput}
              placeholder="Describe detalladamente el motivo de tu disconformidad..."
              placeholderTextColor="#94A3B8"
              multiline
              maxLength={300}
              value={disputeReason}
              onChangeText={setDisputeReason}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setProblemModalVisible(false)}
                disabled={disputing}
              >
                <Text style={styles.modalBtnCancelText}>Volver</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSend]}
                onPress={handleSendProblem}
                disabled={disputing}
              >
                {disputing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalBtnSendText}>Enviar reporte a Central</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  headerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginBottom: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0369A1',
  },
  subtitle: {
    fontSize: 12,
    color: '#0C4A6E',
    marginTop: 2,
    lineHeight: 16,
  },
  evidenceSection: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  photosRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoCard: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  photoTag: {
    backgroundColor: '#0369A1',
    paddingVertical: 3,
    alignItems: 'center',
  },
  photoTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  photoImg: {
    width: '100%',
    height: 120,
  },
  summaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  summaryPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0369A1',
  },
  actionsContainer: {
    gap: 10,
  },
  btnConfirm: {
    minHeight: TouchTarget.mobileMin,
    borderRadius: 12,
    backgroundColor: '#166534',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  btnConfirmText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  btnDispute: {
    minHeight: TouchTarget.mobileMin,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  btnDisputeText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '600',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    minHeight: TouchTarget.mobileMin,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  modalBtnCancel: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modalBtnCancelText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 13,
  },
  modalBtnSend: {
    backgroundColor: '#DC2626',
  },
  modalBtnSendText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
