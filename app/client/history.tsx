import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { db } from '../../src/config/firebase';
import { useSession } from '../../src/context/SessionContext';
import { MAX_REVIEW_COMMENT_LENGTH, submitServiceRating } from '../../src/services/ratings';
import {
  BaseColors,
  BaseElevation,
  BaseRadii,
  BaseTypography,
  BaseHeader,
  BaseCard,
  BaseTag,
  BaseButton,
  BaseBottomSheet,
  TagVariant,
} from '../../src/components/base';

const RATING_LABELS: Record<number, string> = {
  1: 'Muy deficiente 😞',
  2: 'Regular 😐',
  3: 'Bueno 🙂',
  4: 'Muy bueno 😊',
  5: '¡Excelente servicio! ⭐',
};

export default function ClientHistory() {
  const router = useRouter();
  const { user } = useSession();

  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estado del modal de calificación
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedServiceToRate, setSelectedServiceToRate] = useState<any>(null);
  const [ratingStars, setRatingStars] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const q = query(
        collection(db, 'service_requests'),
        where('clientId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const historyData: any[] = [];
      querySnapshot.forEach((docSnap) => {
        historyData.push({ id: docSnap.id, ...docSnap.data() });
      });
      setRequests(historyData);
    } catch (error: any) {
      console.error('Error cargando historial:', error.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const openRatingModal = (item: any) => {
    setSelectedServiceToRate(item);
    setRatingStars(item.rating_given || 5);
    setReviewComment(item.review_comment || '');
    setRatingModalVisible(true);
  };

  const handleSelectStar = (star: number) => {
    setRatingStars(star);
    void Haptics.selectionAsync().catch(() => {});
  };

  const handleSendRating = async () => {
    if (!selectedServiceToRate) return;
    setSubmittingRating(true);
    try {
      await submitServiceRating({
        requestId: selectedServiceToRate.id,
        providerId: selectedServiceToRate.providerId,
        rating: ratingStars,
        comment: reviewComment,
      });

      setRequests((prev) =>
        prev.map((r) =>
          r.id === selectedServiceToRate.id
            ? { ...r, rating_given: ratingStars, review_comment: reviewComment.trim() || null }
            : r
        )
      );

      setRatingModalVisible(false);
      Toast.show({
        type: 'success',
        text1: '¡Gracias por calificar!',
        text2: 'Tu opinión ayuda a mejorar la atención del servicio.',
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar la calificación.');
    } finally {
      setSubmittingRating(false);
    }
  };

  const getStatusBadgeVariant = (status: string): TagVariant => {
    switch (status) {
      case 'COMPLETED':
      case 'VALIDATED':
      case 'ARCHIVED':
        return 'positive';
      case 'ACCEPTED':
      case 'IN_PROGRESS':
        return 'accent';
      case 'PENDING':
      case 'PENDING_ASSIGNMENT':
      case 'REQUIRES_REASSIGNMENT':
      case 'QUOTED':
        return 'warning';
      case 'CANCELLED':
      case 'CANCELLED_BY_CLIENT':
      case 'CANCELLED_BY_PROVIDER':
        return 'negative';
      default:
        return 'neutral';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'Culminado';
      case 'ACCEPTED': return 'Aceptado';
      case 'PENDING': return 'Pendiente';
      case 'PENDING_ASSIGNMENT': return 'Buscando Técnico';
      case 'REQUIRES_REASSIGNMENT': return 'Reasignando';
      case 'IN_PROGRESS': return 'En Ejecución';
      case 'VALIDATED':
      case 'ARCHIVED': return 'Finalizado';
      case 'CANCELLED':
      case 'CANCELLED_BY_CLIENT':
      case 'CANCELLED_BY_PROVIDER': return 'Cancelado';
      default: return status;
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isFinished = item.status === 'VALIDATED' || item.status === 'ARCHIVED' || item.status === 'COMPLETED';
    const hasRating = typeof item.rating_given === 'number' && item.rating_given > 0;

    return (
      <BaseCard
        variant="elevated"
        elevation="sm"
        style={styles.card}
      >
        <View style={styles.cardHeader}>
          <View style={styles.providerInfo}>
            <View style={styles.avatarIconWrap}>
              <Ionicons name="construct" size={16} color={BaseColors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.providerName} numberOfLines={1}>
                {item.providerName || 'Central evaluando solicitud'}
              </Text>
              <Text style={styles.serviceCategory}>
                {item.serviceLabel || item.specialty || 'Servicio técnico'}
              </Text>
            </View>
          </View>

          <BaseTag
            label={getStatusLabel(item.status)}
            variant={getStatusBadgeVariant(item.status)}
            size="sm"
          />
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={14} color={BaseColors.gray500} />
            <Text style={styles.metaText}>
              {item.createdAt
                ? new Date(item.createdAt.seconds * 1000).toLocaleString('es-PE', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Fecha no registrada'}
            </Text>
          </View>

          <View style={styles.metaItem}>
            <Ionicons name="cash-outline" size={14} color={BaseColors.accent} />
            <Text style={styles.priceText}>
              {item.price_agreed || 'S/ Por cotizar'}
            </Text>
          </View>
        </View>

        {Boolean(item.address) && (
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={14} color={BaseColors.gray400} />
            <Text style={styles.addressText} numberOfLines={1}>
              {item.address} {item.district ? `· ${item.district}` : ''}
            </Text>
          </View>
        )}

        {item.evidence_photo && (
          <View style={styles.evidenceContainer}>
            <Text style={styles.evidenceLabel}>Evidencia fotográfica del trabajo:</Text>
            <Image source={{ uri: item.evidence_photo }} style={styles.evidenceImage} />
          </View>
        )}

        {/* Calificación y Reseña */}
        {isFinished && (
          hasRating ? (
            <View style={styles.ratingBox}>
              <View style={styles.ratingHeader}>
                <Text style={styles.ratingLabel}>Tu calificación:</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name={star <= item.rating_given ? 'star' : 'star-outline'}
                      size={16}
                      color="#f1c40f"
                    />
                  ))}
                </View>
              </View>
              {item.review_comment ? (
                <View style={styles.commentBubble}>
                  <Text style={styles.commentText}>
                    "{item.review_comment}"
                  </Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={styles.editRatingBtn}
                onPress={() => openRatingModal(item)}
              >
                <Text style={styles.editRatingText}>Modificar opinión</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.rateButton}
              onPress={() => openRatingModal(item)}
            >
              <Ionicons name="star" size={16} color="#f1c40f" />
              <Text style={styles.rateButtonText}>CALIFICAR SERVICIO</Text>
            </TouchableOpacity>
          )
        )}

        {/* Acciones de la tarjeta */}
        <View style={styles.actionsContainer}>
          <BaseButton
            title="Ver Chat"
            icon="chatbubble-ellipses-outline"
            variant="outline"
            intent="secondary"
            size="sm"
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}
            style={{ flex: 1 }}
          />

          <BaseButton
            title="Pedir de Nuevo"
            icon="reload"
            variant="solid"
            intent="primary"
            size="sm"
            onPress={() =>
              router.replace({
                pathname: '/client/home',
                params: { category: item.specialty || item.serviceLabel || '' },
              })
            }
            style={{ flex: 1 }}
          />
        </View>
      </BaseCard>
    );
  };

  return (
    <View style={styles.container}>
      <BaseHeader
        title="Historial de Solicitudes"
        subtitle="Servicios técnicos realizados y en curso"
        showBack
        onBack={() => router.back()}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BaseColors.accent} />
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.iconCircle}>
                <Ionicons name="document-text-outline" size={48} color={BaseColors.gray400} />
              </View>
              <Text style={styles.emptyTitle}>Sin servicios aún</Text>
              <Text style={styles.emptyText}>
                Tus solicitudes técnicas realizadas aparecerán organizadas aquí.
              </Text>
              <BaseButton
                title="Solicitar mi primer servicio"
                onPress={() => router.replace('/client/home')}
                variant="solid"
                intent="primary"
                size="md"
                style={{ marginTop: 20 }}
              />
            </View>
          }
        />
      )}

      {/* BaseBottomSheet de Calificación y Reseña */}
      <BaseBottomSheet
        visible={ratingModalVisible}
        onClose={() => {
          if (!submittingRating) setRatingModalVisible(false);
        }}
        title="Calificar Atención Técnica"
        subtitle={selectedServiceToRate?.providerName || 'Técnico Homologado'}
      >
        <View style={styles.modalContent}>
          <View style={styles.starPickerRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => handleSelectStar(star)}
                style={styles.starTouchTarget}
                accessibilityLabel={`${star} estrellas`}
              >
                <Ionicons
                  name={star <= ratingStars ? 'star' : 'star-outline'}
                  size={38}
                  color="#f1c40f"
                />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.ratingFeedback}>
            {RATING_LABELS[ratingStars] || ''}
          </Text>

          <TextInput
            style={styles.commentInput}
            placeholder="Escribe un comentario sobre el servicio recibido (opcional)..."
            placeholderTextColor={BaseColors.gray400}
            multiline
            numberOfLines={3}
            maxLength={MAX_REVIEW_COMMENT_LENGTH}
            value={reviewComment}
            onChangeText={setReviewComment}
            textAlignVertical="top"
          />

          <Text style={styles.charCounter}>
            {reviewComment.length}/{MAX_REVIEW_COMMENT_LENGTH} caracteres
          </Text>

          <View style={styles.modalActions}>
            <BaseButton
              title="Cancelar"
              variant="outline"
              intent="secondary"
              size="md"
              disabled={submittingRating}
              onPress={() => setRatingModalVisible(false)}
              style={{ flex: 1 }}
            />
            <BaseButton
              title="Guardar Calificación"
              variant="solid"
              intent="primary"
              size="md"
              loading={submittingRating}
              disabled={submittingRating}
              onPress={handleSendRating}
              style={{ flex: 1.5 }}
            />
          </View>
        </View>
      </BaseBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BaseColors.gray50,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  card: {
    marginBottom: 16,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
    gap: 10,
  },
  avatarIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BaseRadii.md,
    backgroundColor: BaseColors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  providerName: {
    fontSize: BaseTypography.sizes.base,
    fontWeight: BaseTypography.weights.bold,
    color: BaseColors.gray900,
    includeFontPadding: false,
  },
  serviceCategory: {
    fontSize: 12,
    color: BaseColors.gray500,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: BaseColors.gray100,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: BaseColors.gray600,
  },
  priceText: {
    fontSize: BaseTypography.sizes.sm,
    fontWeight: BaseTypography.weights.bold,
    color: BaseColors.accent,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  addressText: {
    fontSize: 12,
    color: BaseColors.gray500,
    flex: 1,
  },
  evidenceContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  evidenceLabel: {
    fontSize: 12,
    fontWeight: BaseTypography.weights.semiBold,
    color: BaseColors.gray700,
    marginBottom: 6,
  },
  evidenceImage: {
    width: '100%',
    height: 160,
    borderRadius: BaseRadii.md,
    backgroundColor: BaseColors.gray200,
  },
  ratingBox: {
    borderWidth: 1,
    borderColor: BaseColors.gray200,
    backgroundColor: BaseColors.gray50,
    borderRadius: BaseRadii.md,
    padding: 12,
    marginBottom: 14,
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingLabel: {
    fontSize: 12,
    fontWeight: BaseTypography.weights.semiBold,
    color: BaseColors.gray700,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 3,
  },
  commentBubble: {
    marginTop: 8,
    padding: 8,
    borderRadius: BaseRadii.sm,
    backgroundColor: BaseColors.white,
    borderWidth: 1,
    borderColor: BaseColors.gray200,
  },
  commentText: {
    fontSize: 12,
    color: BaseColors.gray700,
    fontStyle: 'italic',
  },
  editRatingBtn: {
    alignSelf: 'flex-end',
    marginTop: 6,
  },
  editRatingText: {
    fontSize: 11,
    fontWeight: BaseTypography.weights.bold,
    color: BaseColors.accent,
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    borderRadius: BaseRadii.md,
    paddingVertical: 10,
    marginBottom: 12,
  },
  rateButtonText: {
    fontSize: 12,
    fontWeight: BaseTypography.weights.bold,
    color: '#B45309',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 20,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: BaseColors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: BaseTypography.sizes.lg,
    fontWeight: BaseTypography.weights.bold,
    color: BaseColors.gray900,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: BaseTypography.sizes.sm,
    color: BaseColors.gray500,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalContent: {
    alignItems: 'center',
  },
  starPickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 12,
  },
  starTouchTarget: {
    padding: 4,
  },
  ratingFeedback: {
    fontSize: BaseTypography.sizes.sm,
    fontWeight: BaseTypography.weights.bold,
    color: BaseColors.gray800,
    marginBottom: 16,
  },
  commentInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: BaseColors.gray300,
    borderRadius: BaseRadii.md,
    padding: 12,
    minHeight: 80,
    fontSize: 13,
    color: BaseColors.gray900,
    backgroundColor: BaseColors.white,
  },
  charCounter: {
    fontSize: 11,
    color: BaseColors.gray400,
    alignSelf: 'flex-end',
    marginTop: 4,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
});
