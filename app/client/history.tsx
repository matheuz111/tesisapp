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
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { db } from '../../src/config/firebase';
import { useSession } from '../../src/context/SessionContext';
import { useTheme } from '../../src/context/ThemeContext';
import { MAX_REVIEW_COMMENT_LENGTH, submitServiceRating } from '../../src/services/ratings';

const RATING_LABELS: Record<number, string> = {
    1: 'Muy deficiente 😞',
    2: 'Regular 😐',
    3: 'Bueno 🙂',
    4: 'Muy bueno 😊',
    5: '¡Excelente servicio! ⭐',
};

export default function ClientHistory() {
    const router = useRouter();
    const { colors } = useTheme();
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

            // Actualizar el estado local para reflejo inmediato
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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'COMPLETED': return colors.success;
            case 'ACCEPTED': return colors.primary;
            case 'PENDING': return '#f1c40f';
            case 'PENDING_ASSIGNMENT': return '#e67e22';
            case 'REQUIRES_REASSIGNMENT': return '#e67e22';
            case 'IN_PROGRESS': return colors.primary;
            case 'ARCHIVED': return colors.success;
            case 'CANCELLED':
            case 'CANCELLED_BY_CLIENT':
            case 'CANCELLED_BY_PROVIDER': return colors.danger;
            default: return colors.subtext;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'COMPLETED': return 'CULMINADO';
            case 'ACCEPTED': return 'ACEPTADO';
            case 'PENDING': return 'PENDIENTE';
            case 'PENDING_ASSIGNMENT': return 'POR ASIGNAR';
            case 'REQUIRES_REASSIGNMENT': return 'REASIGNANDO';
            case 'IN_PROGRESS': return 'EN EJECUCIÓN';
            case 'ARCHIVED': return 'FINALIZADO';
            case 'CANCELLED':
            case 'CANCELLED_BY_CLIENT':
            case 'CANCELLED_BY_PROVIDER': return 'CANCELADO';
            default: return status;
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        const isFinished = item.status === 'ARCHIVED' || item.status === 'COMPLETED';
        const hasRating = typeof item.rating_given === 'number' && item.rating_given > 0;

        return (
            <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                <View style={styles.cardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
                        <Text style={[styles.providerName, { color: colors.text }]}>
                            {item.providerName || 'Central evaluando solicitud'}
                        </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                        <Text style={[styles.badgeText, { color: getStatusColor(item.status) }]}>
                            {getStatusLabel(item.status)}
                        </Text>
                    </View>
                </View>

                <Text style={[styles.date, { color: colors.subtext }]}>
                    📅 {item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleString('es-PE', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Fecha desconocida'}
                </Text>

                <Text style={[styles.price, { color: colors.text }]}>
                    💰 {item.price_agreed || 'Pendiente de cotización'}
                </Text>

                {item.evidence_photo && (
                    <View style={[styles.evidenceContainer, { borderTopColor: colors.border }]}>
                        <Text style={[styles.evidenceLabel, { color: colors.subtext }]}>Evidencia del trabajo:</Text>
                        <Image source={{ uri: item.evidence_photo }} style={styles.evidenceImage} />
                    </View>
                )}

                {/* Sección de Calificación y Reseña */}
                {isFinished && (
                    hasRating ? (
                        <View style={[styles.ratingBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                            <View style={styles.ratingHeader}>
                                <Text style={[styles.ratingLabel, { color: colors.subtext }]}>Tu calificación:</Text>
                                <View style={styles.starsRow}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Ionicons
                                            key={star}
                                            name={star <= item.rating_given ? 'star' : 'star-outline'}
                                            size={18}
                                            color="#f1c40f"
                                        />
                                    ))}
                                </View>
                            </View>
                            {item.review_comment ? (
                                <View style={[styles.commentBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <Text style={[styles.commentText, { color: colors.text }]}>
                                        "{item.review_comment}"
                                    </Text>
                                </View>
                            ) : null}
                            <TouchableOpacity
                                style={styles.editRatingBtn}
                                onPress={() => openRatingModal(item)}
                            >
                                <Text style={[styles.editRatingText, { color: colors.primary }]}>Modificar opinión</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={[styles.rateButton, { borderColor: colors.primary, backgroundColor: `${colors.primary}12` }]}
                            onPress={() => openRatingModal(item)}
                        >
                            <Ionicons name="star" size={17} color="#f1c40f" />
                            <Text style={[styles.rateButtonText, { color: colors.primary }]}>
                                CALIFICAR SERVICIO
                            </Text>
                        </TouchableOpacity>
                    )
                )}

                <View style={styles.actionsContainer}>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.primary }]}
                        onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}
                    >
                        <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
                        <Text style={[styles.actionText, { color: colors.primary }]}>VER CHAT</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.primary }]}
                        onPress={() => router.push('/client/home')}
                    >
                        <Ionicons name="reload" size={18} color="#fff" />
                        <Text style={[styles.actionText, { color: '#fff' }]}>REPETIR</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.card }]}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.text }]}>Historial de Servicios</Text>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
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
                            <View style={[styles.iconCircle, { backgroundColor: colors.input }]}>
                                <Ionicons name="document-text-outline" size={50} color={colors.subtext} />
                            </View>
                            <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin servicios aún</Text>
                            <Text style={[styles.emptyText, { color: colors.subtext }]}>Tus solicitudes finalizadas aparecerán aquí.</Text>
                        </View>
                    }
                />
            )}

            {/* Modal de Calificación y Reseña */}
            <Modal
                visible={ratingModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => {
                    if (!submittingRating) setRatingModalVisible(false);
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Calificar Atención</Text>
                        <Text style={[styles.modalSubtitle, { color: colors.subtext }]}>
                            {selectedServiceToRate?.providerName || 'Técnico de Maestro a Domicilio'}
                        </Text>
                        <Text style={[styles.serviceBadge, { color: colors.primary, backgroundColor: `${colors.primary}15` }]}>
                            {selectedServiceToRate?.serviceLabel || selectedServiceToRate?.specialty || 'Servicio'}
                        </Text>

                        {/* Estrellas interactivas */}
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
                                        size={36}
                                        color="#f1c40f"
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={[styles.ratingFeedback, { color: colors.subtext }]}>
                            {RATING_LABELS[ratingStars] || ''}
                        </Text>

                        {/* Campo de comentario de reseña */}
                        <View style={styles.commentInputContainer}>
                            <TextInput
                                style={[
                                    styles.commentInput,
                                    { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
                                ]}
                                placeholder="Cuéntanos tu experiencia (opcional)..."
                                placeholderTextColor={colors.subtext}
                                multiline
                                numberOfLines={3}
                                maxLength={MAX_REVIEW_COMMENT_LENGTH}
                                value={reviewComment}
                                onChangeText={setReviewComment}
                                textAlignVertical="top"
                            />
                            <Text style={[styles.charCounter, { color: colors.subtext }]}>
                                {reviewComment.length}/{MAX_REVIEW_COMMENT_LENGTH}
                            </Text>
                        </View>

                        {/* Acciones */}
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}
                                onPress={() => setRatingModalVisible(false)}
                                disabled={submittingRating}
                            >
                                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancelar</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                                onPress={handleSendRating}
                                disabled={submittingRating}
                            >
                                {submittingRating ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={[styles.modalBtnText, { color: '#fff' }]}>Guardar</Text>
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
    container: { flex: 1, paddingTop: 50 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
    backButton: { marginRight: 15, padding: 5, borderRadius: 10 },
    title: { fontSize: 24, fontWeight: 'bold' },

    listContent: { paddingHorizontal: 20, paddingBottom: 40 },

    card: { borderRadius: 20, padding: 20, marginBottom: 20, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },

    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    providerName: { fontSize: 18, fontWeight: 'bold' },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },

    badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
    badgeText: { fontSize: 11, fontWeight: 'bold' },

    date: { fontSize: 14, marginBottom: 5 },
    price: { fontSize: 16, fontWeight: 'bold', marginBottom: 15 },

    evidenceContainer: { marginTop: 10, borderTopWidth: 1, paddingTop: 15, marginBottom: 15 },
    evidenceLabel: { fontSize: 12, marginBottom: 8, fontWeight: '600' },
    evidenceImage: { width: '100%', height: 180, borderRadius: 12, backgroundColor: '#eee', resizeMode: 'cover' },

    ratingBox: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 14 },
    ratingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    ratingLabel: { fontSize: 13, fontWeight: '600' },
    starsRow: { flexDirection: 'row', gap: 3 },
    commentBubble: { marginTop: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
    commentText: { fontSize: 13, fontStyle: 'italic', lineHeight: 18 },
    editRatingBtn: { alignSelf: 'flex-end', marginTop: 6, paddingVertical: 4 },
    editRatingText: { fontSize: 12, fontWeight: '700' },

    rateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1.5,
        borderRadius: 14,
        paddingVertical: 12,
        marginBottom: 14,
    },
    rateButtonText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

    actionsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5, gap: 10 },
    actionButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 12, borderRadius: 12 },
    actionText: { fontWeight: 'bold', marginLeft: 8, fontSize: 13, letterSpacing: 0.5 },

    emptyState: { alignItems: 'center', marginTop: 80 },
    iconCircle: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
    emptyText: { fontSize: 16, textAlign: 'center', paddingHorizontal: 40 },

    // Estilos del Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 420,
        borderRadius: 22,
        borderWidth: 1,
        padding: 22,
        alignItems: 'center',
    },
    modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
    modalSubtitle: { fontSize: 14, marginBottom: 8 },
    serviceBadge: {
        fontSize: 11,
        fontWeight: '700',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 16,
    },
    starPickerRow: { flexDirection: 'row', gap: 10, marginVertical: 8 },
    starTouchTarget: { padding: 4 },
    ratingFeedback: { fontSize: 13, fontWeight: '600', marginBottom: 16 },
    commentInputContainer: { width: '100%', marginBottom: 18 },
    commentInput: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        minHeight: 80,
        fontSize: 14,
    },
    charCounter: { fontSize: 11, alignSelf: 'flex-end', marginTop: 4 },
    modalActions: { flexDirection: 'row', gap: 12, width: '100%' },
    modalBtn: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalBtnText: { fontSize: 15, fontWeight: '700' },
});
