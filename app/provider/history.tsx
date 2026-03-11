import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../src/config/firebase';
import { useTheme } from '../../src/context/ThemeContext';

export default function ProviderHistoryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const user = auth.currentUser;

  const [history, setHistory] = useState<any[]>([]);
  const [stats, setStats] = useState({ rating: '0.0', jobs: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    if (!user) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const calculatedRating = userData.review_count > 0
          ? (userData.total_rating / userData.review_count).toFixed(1)
          : 'Nuevo';
        setStats({
          rating: calculatedRating,
          jobs: userData.jobs_completed || 0
        });
      }

      const q = query(
        collection(db, 'service_requests'),
        where('providerId', '==', user.uid),
        where('status', 'in', ['COMPLETED', 'ARCHIVED']),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const historyData: any[] = [];

      querySnapshot.forEach((document) => {
        historyData.push({ id: document.id, ...document.data() });
      });

      setHistory(historyData);
    } catch (error: any) {
      console.error("Error cargando dashboard:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isArchived = item.status === 'ARCHIVED';

    return (
      <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.clientName, { color: colors.text }]}>{item.clientName || 'Cliente'}</Text>
          <View style={[styles.badge, isArchived ? [styles.badgeArchived, { backgroundColor: colors.success + '20' }] : [styles.badgeCompleted, { backgroundColor: '#fff3cd' }]]}>
            <Text style={[styles.badgeText, isArchived ? [styles.textArchived, { color: colors.success }] : styles.textCompleted]}>
              {isArchived ? 'EVALUADO' : 'POR EVALUAR'}
            </Text>
          </View>
        </View>

        <Text style={[styles.date, { color: colors.subtext }]}>
          📅 {item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleString('es-PE', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Fecha desconocida'}
        </Text>

        <View style={styles.footerRow}>
          <Text style={[styles.price, { color: colors.primary }]}>💰 {item.price_agreed || 'S/ 0'}</Text>

          {isArchived && item.rating_given && (
            <View style={[styles.ratingGiven, { backgroundColor: colors.background }]}>
              <Ionicons name="star" size={16} color="#f1c40f" />
              <Text style={[styles.ratingGivenText, { color: colors.text }]}>{item.rating_given}</Text>
            </View>
          )}
        </View>

        {/* EVIDENCIA FOTOGRÁFICA */}
        {item.evidence_photo && (
          <View style={[styles.evidenceContainer, { borderTopColor: colors.border }]}>
            <Text style={[styles.evidenceLabel, { color: colors.subtext }]}>Tu evidencia enviada:</Text>
            <Image source={{ uri: item.evidence_photo }} style={styles.evidenceImage} />
          </View>
        )}

        <View style={[styles.actionsContainer, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.primary }]}
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>VER HISTORIAL DE CHAT</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerGamified}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          <Ionicons name="arrow-back" size={24} color={colors.icon} />
        </TouchableOpacity>
        <View style={[styles.safeBoxBadge, { backgroundColor: colors.success + '15' }]}>
          <Ionicons name="shield-checkmark" size={22} color={colors.success} />
          <Text style={[styles.titleSafeBox, { color: colors.success }]}>Caja Fuerte & Rendimiento</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          <View style={[styles.statsPanel, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
            <View style={styles.statBox}>
              <Ionicons name="star" size={32} color="#f1c40f" />
              <Text style={[styles.statValue, { color: colors.text }]}>{stats.rating}</Text>
              <Text style={[styles.statLabel, { color: colors.subtext }]}>Reputación</Text>
            </View>
            <View style={[styles.dividerVertical, { backgroundColor: colors.border }]} />
            <View style={styles.statBox}>
              <Ionicons name="briefcase" size={32} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.text }]}>{stats.jobs}</Text>
              <Text style={[styles.statLabel, { color: colors.subtext }]}>Trabajos</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Historial de Trabajos</Text>

          <FlatList
            data={history}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="wallet-outline" size={60} color={colors.subtext} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin ingresos aún</Text>
                <Text style={[styles.emptyText, { color: colors.subtext }]}>Los trabajos que finalices aparecerán aquí.</Text>
              </View>
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 50 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  headerGamified: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  backButton: { marginRight: 15, padding: 8, borderRadius: 10, elevation: 2, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  safeBoxBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  titleSafeBox: { fontSize: 18, fontWeight: 'bold', marginLeft: 8 },

  statsPanel: { flexDirection: 'row', marginHorizontal: 20, borderRadius: 15, padding: 20, elevation: 4, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, marginBottom: 25 },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', marginTop: 5 },
  statLabel: { fontSize: 14, marginTop: 2 },
  dividerVertical: { width: 1, marginHorizontal: 15 },

  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginHorizontal: 20, marginBottom: 15 },

  listContent: { paddingHorizontal: 20, paddingBottom: 40 },

  card: { borderRadius: 15, padding: 20, marginBottom: 15, elevation: 2, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  clientName: { fontSize: 16, fontWeight: 'bold' },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: 'bold' },
  badgeArchived: {},
  textArchived: {},
  badgeCompleted: { backgroundColor: '#fff3cd' },
  textCompleted: { color: '#856404' },

  date: { fontSize: 14, marginBottom: 15 },

  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { fontSize: 16, fontWeight: 'bold' },

  ratingGiven: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  ratingGivenText: { marginLeft: 5, fontWeight: 'bold' },

  // ESTILOS DE LA EVIDENCIA
  evidenceContainer: { marginTop: 15, borderTopWidth: 1, paddingTop: 15 },
  evidenceLabel: { fontSize: 13, marginBottom: 8, fontWeight: '600' },
  evidenceImage: { width: '100%', height: 180, borderRadius: 12, backgroundColor: '#eee', resizeMode: 'cover' },

  actionsContainer: { marginTop: 15, paddingTop: 15, borderTopWidth: 1 },
  actionButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 10, borderRadius: 10 },
  actionText: { fontWeight: 'bold', marginLeft: 8, fontSize: 12, letterSpacing: 0.5 },

  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 15 },
  emptyText: { fontSize: 15, marginTop: 5 },
});