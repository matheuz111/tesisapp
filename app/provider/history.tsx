import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { auth, db } from '../../src/config/firebase';
import {
  BaseColors,
  BaseElevation,
  BaseRadii,
  BaseTypography,
  BaseHeader,
  BaseCard,
  BaseTag,
  BaseButton,
} from '../../src/components/base';

export default function ProviderHistoryScreen() {
  const router = useRouter();

  const [user, setUser] = useState(auth.currentUser);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const [history, setHistory] = useState<any[]>([]);
  const [stats, setStats] = useState({ rating: '0.0', jobs: 0, reviewCount: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const calculatedRating =
          userData.review_count > 0
            ? (userData.total_rating / userData.review_count).toFixed(1)
            : 'Nuevo';
        setStats({
          rating: calculatedRating,
          jobs: userData.jobs_completed || 0,
          reviewCount: userData.review_count || 0,
        });
      }

      const q = query(
        collection(db, 'service_requests'),
        where('providerId', '==', user.uid),
        where('status', 'in', ['COMPLETED', 'ARCHIVED', 'VALIDATED']),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const historyData: any[] = [];
      querySnapshot.forEach((document) => {
        historyData.push({ id: document.id, ...document.data() });
      });
      setHistory(historyData);
    } catch (error: any) {
      console.error('Error cargando dashboard:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadDashboard();
  }, [user, loadDashboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboard();
  }, [loadDashboard]);

  // Total acumulado
  const totalEarnings = history.reduce((sum, item) => {
    if (!item.price_agreed) return sum;
    const num = parseFloat(item.price_agreed.replace(/[^\d.]/g, ''));
    return sum + (isNaN(num) ? 0 : num);
  }, 0);

  const renderItem = ({ item }: { item: any }) => {
    const isArchived = item.status === 'ARCHIVED' || item.status === 'VALIDATED';

    return (
      <BaseCard variant="elevated" elevation="sm" style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.clientName} numberOfLines={1}>
              {item.clientName || 'Cliente'}
            </Text>
            <Text style={styles.serviceType}>
              {item.serviceType || item.serviceLabel || item.specialty || 'Servicio Técnico'}
            </Text>
          </View>

          <BaseTag
            label={isArchived ? 'Evaluado' : 'Por Auditar'}
            variant={isArchived ? 'positive' : 'warning'}
            size="sm"
          />
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={14} color={BaseColors.gray500} />
            <Text style={styles.metaText}>
              {item.createdAt
                ? new Date(item.createdAt.seconds * 1000).toLocaleDateString('es-PE', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Fecha no registrada'}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="cash-outline" size={14} color={BaseColors.accent} />
            <Text style={styles.priceText}>
              {item.price_agreed || 'S/ 0'}
            </Text>
          </View>
        </View>

        {isArchived && item.rating_given && (
          <View style={styles.ratingCard}>
            <View style={styles.ratingRow}>
              <Text style={styles.ratingLabel}>Calificación recibida:</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= (item.rating_given || 0) ? 'star' : 'star-outline'}
                    size={15}
                    color="#f1c40f"
                  />
                ))}
              </View>
            </View>
            {item.review_comment ? (
              <View style={styles.reviewCommentBox}>
                <Text style={styles.reviewCommentText}>
                  "{item.review_comment}"
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {item.evidence_photo && (
          <View style={styles.evidenceContainer}>
            <Text style={styles.evidenceLabel}>Tu evidencia de finalización:</Text>
            <Image source={{ uri: item.evidence_photo }} style={styles.evidenceImage} />
          </View>
        )}

        <BaseButton
          title="Ver Conversación / Chat"
          icon="chatbubble-ellipses-outline"
          variant="outline"
          intent="secondary"
          size="sm"
          fullWidth
          onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}
          style={{ marginTop: 6 }}
        />
      </BaseCard>
    );
  };

  return (
    <View style={styles.container}>
      <BaseHeader
        title="Rendimiento y Trabajos"
        subtitle="Registro de servicios atendidos por el técnico"
        showBack
        onBack={() => router.back()}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BaseColors.accent} />
        </View>
      ) : (
        <FlatList
          data={history}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[BaseColors.accent]}
            />
          }
          ListHeaderComponent={
            <View style={styles.headerContent}>
              {/* Stats Panel */}
              <BaseCard variant="elevated" elevation="sm" style={styles.statsCard}>
                <View style={styles.statBox}>
                  <View style={[styles.statIconCircle, { backgroundColor: '#FFFBEB' }]}>
                    <Ionicons name="star" size={20} color="#D97706" />
                  </View>
                  <Text style={styles.statValue}>{stats.rating}</Text>
                  <Text style={styles.statLabel}>
                    {stats.reviewCount > 0 ? `${stats.reviewCount} reseñas` : 'Reputación'}
                  </Text>
                </View>

                <View style={styles.dividerVertical} />

                <View style={styles.statBox}>
                  <View style={[styles.statIconCircle, { backgroundColor: BaseColors.accentLight }]}>
                    <Ionicons name="briefcase" size={20} color={BaseColors.accent} />
                  </View>
                  <Text style={styles.statValue}>{stats.jobs}</Text>
                  <Text style={styles.statLabel}>Servicios</Text>
                </View>

                <View style={styles.dividerVertical} />

                <View style={styles.statBox}>
                  <View style={[styles.statIconCircle, { backgroundColor: BaseColors.positiveLight }]}>
                    <Ionicons name="cash" size={20} color={BaseColors.positive} />
                  </View>
                  <Text style={[styles.statValue, { color: BaseColors.positive }]}>
                    S/ {totalEarnings.toFixed(0)}
                  </Text>
                  <Text style={styles.statLabel}>Acumulado</Text>
                </View>
              </BaseCard>

              <Text style={styles.sectionTitle}>
                Servicios Realizados ({history.length})
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="wallet-outline" size={44} color={BaseColors.gray400} />
              </View>
              <Text style={styles.emptyTitle}>Sin servicios completados aún</Text>
              <Text style={styles.emptyText}>
                Las órdenes de trabajo finalizadas y conformes con el cliente aparecerán aquí.
              </Text>
            </View>
          }
        />
      )}
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
  headerContent: {
    marginBottom: 8,
  },
  statsCard: {
    flexDirection: 'row',
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statIconCircle: {
    width: 40,
    height: 40,
    borderRadius: BaseRadii.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: BaseTypography.sizes.lg,
    fontWeight: BaseTypography.weights.bold,
    color: BaseColors.gray900,
    includeFontPadding: false,
  },
  statLabel: {
    fontSize: 11,
    color: BaseColors.gray500,
    marginTop: 2,
  },
  dividerVertical: {
    width: 1,
    height: 40,
    backgroundColor: BaseColors.gray200,
  },
  sectionTitle: {
    fontSize: BaseTypography.sizes.base,
    fontWeight: BaseTypography.weights.bold,
    color: BaseColors.gray900,
    marginBottom: 12,
  },
  card: {
    marginBottom: 14,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  clientName: {
    fontSize: BaseTypography.sizes.base,
    fontWeight: BaseTypography.weights.bold,
    color: BaseColors.gray900,
    includeFontPadding: false,
  },
  serviceType: {
    fontSize: 12,
    color: BaseColors.gray500,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: BaseColors.gray500,
  },
  priceText: {
    fontSize: 13,
    fontWeight: BaseTypography.weights.bold,
    color: BaseColors.accent,
  },
  ratingCard: {
    padding: 10,
    borderRadius: BaseRadii.sm,
    backgroundColor: BaseColors.gray100,
    marginBottom: 10,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingLabel: {
    fontSize: 12,
    fontWeight: BaseTypography.weights.medium,
    color: BaseColors.gray700,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewCommentBox: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: BaseColors.gray200,
  },
  reviewCommentText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: BaseColors.gray700,
  },
  evidenceContainer: {
    borderTopWidth: 1,
    borderTopColor: BaseColors.gray200,
    paddingTop: 10,
    marginBottom: 10,
  },
  evidenceLabel: {
    fontSize: 12,
    fontWeight: BaseTypography.weights.semiBold,
    color: BaseColors.gray700,
    marginBottom: 6,
  },
  evidenceImage: {
    width: '100%',
    height: 150,
    borderRadius: BaseRadii.md,
    backgroundColor: BaseColors.gray200,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: BaseColors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: BaseTypography.sizes.base,
    fontWeight: BaseTypography.weights.bold,
    color: BaseColors.gray900,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: BaseColors.gray500,
    textAlign: 'center',
    lineHeight: 18,
  },
});
