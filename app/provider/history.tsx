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
    TouchableOpacity,
    View,
} from 'react-native';
import { auth, db } from '../../src/config/firebase';
import { useTheme } from '../../src/context/ThemeContext';

export default function ProviderHistoryScreen() {
    const router = useRouter();
    const { colors, theme } = useTheme();
    const isDark = theme === 'dark';

    const [user, setUser] = useState(auth.currentUser);
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u));
        return () => unsub();
    }, []);

    const [history, setHistory] = useState<any[]>([]);
    const [stats, setStats] = useState({ rating: '0.0', jobs: 0, reviewCount: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (user) loadDashboard();
    }, [user]);

    const loadDashboard = async () => {
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
            console.error('Error cargando dashboard:', error.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Pull-to-refresh
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadDashboard();
    }, [user]);

    // Calcular ingresos totales
    const totalEarnings = history.reduce((sum, item) => {
        if (!item.price_agreed) return sum;
        const num = parseFloat(item.price_agreed.replace(/[^\d.]/g, ''));
        return sum + (isNaN(num) ? 0 : num);
    }, 0);

    const renderItem = ({ item }: { item: any }) => {
        const isArchived = item.status === 'ARCHIVED';

        return (
            <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.clientName, { color: colors.text }]}>
                            {item.clientName || 'Cliente'}
                        </Text>
                        {item.serviceType && (
                            <Text style={[styles.serviceType, { color: colors.subtext }]}>
                                {item.serviceType}
                            </Text>
                        )}
                    </View>
                    <View
                        style={[
                            styles.badge,
                            {
                                backgroundColor: isArchived
                                    ? (isDark ? '#1a2e1a' : colors.success + '15')
                                    : (isDark ? '#2e2a1a' : '#fff3cd'),
                            },
                        ]}
                    >
                        <Text
                            style={[
                                styles.badgeText,
                                { color: isArchived ? colors.success : '#856404' },
                            ]}
                        >
                            {isArchived ? 'EVALUADO' : 'POR EVALUAR'}
                        </Text>
                    </View>
                </View>

                <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                        <Ionicons name="calendar-outline" size={14} color={colors.subtext} />
                        <Text style={[styles.metaText, { color: colors.subtext }]}>
                            {item.createdAt
                                ? new Date(item.createdAt.seconds * 1000).toLocaleDateString('es-PE', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                })
                                : 'Fecha desconocida'}
                        </Text>
                    </View>
                    <View style={styles.metaItem}>
                        <Ionicons name="cash-outline" size={14} color={colors.primary} />
                        <Text style={[styles.metaText, { color: colors.primary, fontWeight: '700' }]}>
                            {item.price_agreed || 'S/ 0'}
                        </Text>
                    </View>
                </View>

                {isArchived && item.rating_given && (
                    <View style={[styles.ratingRow, { backgroundColor: isDark ? '#1a1a1a' : '#FFFDE7' }]}>
                        <Text style={[styles.ratingLabel, { color: colors.subtext }]}>Calificación recibida:</Text>
                        <View style={styles.starsRow}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <Ionicons
                                    key={star}
                                    name={star <= (item.rating_given || 0) ? 'star' : 'star-outline'}
                                    size={16}
                                    color="#f1c40f"
                                />
                            ))}
                        </View>
                    </View>
                )}

                {item.evidence_photo && (
                    <View style={[styles.evidenceContainer, { borderTopColor: colors.border }]}>
                        <Text style={[styles.evidenceLabel, { color: colors.subtext }]}>Tu evidencia:</Text>
                        <Image source={{ uri: item.evidence_photo }} style={styles.evidenceImage} />
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.chatButton, { borderColor: colors.primary }]}
                    onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}
                >
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
                    <Text style={[styles.chatButtonText, { color: colors.primary }]}>VER CHAT</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={[styles.backButton, { backgroundColor: colors.card, shadowColor: colors.shadow }]}
                >
                    <Ionicons name="arrow-back" size={22} color={colors.icon} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.text }]}>Rendimiento</Text>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={history}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
                    }
                    ListHeaderComponent={
                        <View style={styles.headerContent}>
                            {/* STATS PANEL */}
                            <View style={[styles.statsPanel, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                                <View style={styles.statBox}>
                                    <View style={[styles.statIconCircle, { backgroundColor: isDark ? '#2e2a1a' : '#FFFDE7' }]}>
                                        <Ionicons name="star" size={24} color="#f1c40f" />
                                    </View>
                                    <Text style={[styles.statValue, { color: colors.text }]}>{stats.rating}</Text>
                                    <Text style={[styles.statLabel, { color: colors.subtext }]}>
                                        {stats.reviewCount > 0 ? `${stats.reviewCount} reseñas` : 'Reputación'}
                                    </Text>
                                </View>

                                <View style={[styles.dividerVertical, { backgroundColor: colors.border }]} />

                                <View style={styles.statBox}>
                                    <View style={[styles.statIconCircle, { backgroundColor: isDark ? '#1a1a2e' : '#E3F2FD' }]}>
                                        <Ionicons name="briefcase" size={24} color={colors.primary} />
                                    </View>
                                    <Text style={[styles.statValue, { color: colors.text }]}>{stats.jobs}</Text>
                                    <Text style={[styles.statLabel, { color: colors.subtext }]}>Trabajos</Text>
                                </View>

                                <View style={[styles.dividerVertical, { backgroundColor: colors.border }]} />

                                <View style={styles.statBox}>
                                    <View style={[styles.statIconCircle, { backgroundColor: isDark ? '#1a2e1a' : '#E8F5E9' }]}>
                                        <Ionicons name="cash" size={24} color={colors.success} />
                                    </View>
                                    <Text style={[styles.statValue, { color: colors.success }]}>
                                        S/ {totalEarnings.toFixed(0)}
                                    </Text>
                                    <Text style={[styles.statLabel, { color: colors.subtext }]}>Ingresos</Text>
                                </View>
                            </View>

                            <Text style={[styles.sectionTitle, { color: colors.text }]}>
                                Historial ({history.length})
                            </Text>
                        </View>
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? '#1a1a2e' : '#F5F5F5' }]}>
                                <Ionicons name="wallet-outline" size={48} color={colors.subtext} />
                            </View>
                            <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin trabajos aún</Text>
                            <Text style={[styles.emptyText, { color: colors.subtext }]}>
                                Los trabajos que finalices aparecerán aquí.
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: 50 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 },
    backButton: {
        marginRight: 14,
        padding: 8,
        borderRadius: 12,
        elevation: 2,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
    },
    title: { fontSize: 22, fontWeight: '800' },

    listContent: { paddingHorizontal: 20, paddingBottom: 40 },
    headerContent: { marginBottom: 8 },

    // ── Stats Panel ───────────────────
    statsPanel: {
        flexDirection: 'row',
        borderRadius: 20,
        padding: 20,
        elevation: 3,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        marginBottom: 24,
    },
    statBox: { flex: 1, alignItems: 'center' },
    statIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    statValue: { fontSize: 20, fontWeight: '800' },
    statLabel: { fontSize: 11, marginTop: 2 },
    dividerVertical: { width: 1, marginHorizontal: 8 },

    sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 14 },

    // ── Cards ─────────────────────────
    card: {
        borderRadius: 18,
        padding: 18,
        marginBottom: 14,
        elevation: 2,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    clientName: { fontSize: 16, fontWeight: '700' },
    serviceType: { fontSize: 13, marginTop: 2 },

    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

    metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaText: { fontSize: 13 },

    ratingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        marginBottom: 12,
    },
    ratingLabel: { fontSize: 12, fontWeight: '500' },
    starsRow: { flexDirection: 'row', gap: 2 },

    evidenceContainer: { borderTopWidth: 1, paddingTop: 14, marginBottom: 12 },
    evidenceLabel: { fontSize: 12, marginBottom: 8, fontWeight: '600' },
    evidenceImage: { width: '100%', height: 160, borderRadius: 12, backgroundColor: '#eee', resizeMode: 'cover' },

    chatButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 11,
        borderRadius: 12,
        borderWidth: 1.5,
        gap: 6,
    },
    chatButtonText: { fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },

    // ── Empty state ───────────────────
    emptyState: { alignItems: 'center', marginTop: 60 },
    emptyIconCircle: {
        width: 90,
        height: 90,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
    emptyText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
});
