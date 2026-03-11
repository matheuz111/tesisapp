import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
// IMPORTANTE: Se añadió orderBy a la importación
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../src/config/firebase';
import { useTheme } from '../../src/context/ThemeContext';

export default function ClientHistory() {
  const router = useRouter();
  const user = auth.currentUser;
  const { colors, theme } = useTheme();

  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    if (!user) return;
    try {

      const q = query(
        collection(db, 'service_requests'),
        where('clientId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const historyData: any[] = [];

      querySnapshot.forEach((doc) => {
        historyData.push({ id: doc.id, ...doc.data() });
      });

      setRequests(historyData);
    } catch (error: any) {
      // Si ves el error de índice, el console.error te lo mostrará con el link.
      console.error("Error cargando historial (Revisa los índices de Firebase):", error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return colors.success;
      case 'ACCEPTED': return colors.primary;
      case 'PENDING': return '#f1c40f';
      case 'ARCHIVED': return colors.subtext;
      case 'CANCELLED': return colors.danger;
      default: return colors.subtext;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'FINALIZADO';
      case 'ACCEPTED': return 'ACEPTADO';
      case 'PENDING': return 'PENDIENTE';
      case 'ARCHIVED': return 'FINALIZADO';
      case 'CANCELLED': return 'CANCELADO';
      default: return status;
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
          <Text style={[styles.providerName, { color: colors.text }]}>{item.providerName || 'Técnico'}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.badgeText, { color: getStatusColor(item.status) }]}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>

      <Text style={[styles.date, { color: colors.subtext }]}>
        📅 {item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleString('es-PE', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Fecha desconocida'}
      </Text>

      <Text style={[styles.price, { color: colors.text }]}>💰 {item.price_agreed || 'Precio a convenir'}</Text>

      {/* Evidencia Fotográfica */}
      {item.evidence_photo && (
        <View style={[styles.evidenceContainer, { borderTopColor: colors.border }]}>
          <Text style={[styles.evidenceLabel, { color: colors.subtext }]}>Evidencia del trabajo:</Text>
          <Image source={{ uri: item.evidence_photo }} style={styles.evidenceImage} />
        </View>
      )}

      {/* SISTEMA DE ESTRELLAS REALES */}
      {item.status === 'ARCHIVED' && (
        <View style={styles.ratingBox}>
          <Text style={[styles.ratingLabel, { color: colors.subtext }]}>Tu calificación:</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= (item.rating_given || 0) ? "star" : "star-outline"}
                size={18}
                color="#f1c40f"
              />
            ))}
          </View>
        </View>
      )}

      {/* BOTONES DE ACCIÓN MEJORADOS (UX) */}
      <View style={styles.actionsContainer}>
        {/* Botón para ver el historial de Chat */}
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.primary }]}
          onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.primary }]}>VER CHAT</Text>
        </TouchableOpacity>

        {/* Botón Volver a Pedir */}
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/client/map')}
        >
          <Ionicons name="reload" size={18} color="#fff" />
          <Text style={[styles.actionText, { color: '#fff' }]}>REPETIR</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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

  ratingBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingVertical: 5 },
  ratingLabel: { fontSize: 14, fontWeight: '500' },
  starsRow: { flexDirection: 'row', gap: 2 },

  // NUEVOS ESTILOS PARA LOS BOTONES DIVIDIDOS
  actionsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5, gap: 10 },
  actionButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 12, borderRadius: 12 },
  actionText: { fontWeight: 'bold', marginLeft: 8, fontSize: 13, letterSpacing: 0.5 },

  emptyState: { alignItems: 'center', marginTop: 80 },
  iconCircle: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
  emptyText: { fontSize: 16, textAlign: 'center', paddingHorizontal: 40 },
});