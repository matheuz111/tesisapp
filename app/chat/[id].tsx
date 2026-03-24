/**
 * app/chat/[id].tsx
 * Chat en tiempo real — Cliente ↔ Proveedor
 * Versión FINAL optimizada al 100%
 *
 * Optimizaciones implementadas:
 *  ✅ 1. Mensajes optimistas (Optimistic UI) — aparecen al instante
 *  ✅ 2. useMemo para paleta de colores — sin recálculos innecesarios
 *  ✅ 3. Paginación limit(50) + "Cargar anteriores"
 *  ✅ 4. Indicador "Escribiendo..." en tiempo real
 *  ✅ 5. Vista previa de imagen antes de enviar
 *  ✅ 6. Copiar mensaje con long press
 *  ✅ 7. Push notification al enviar mensaje
 *  ✅ 8. Banner cuando el chat está cerrado (ARCHIVED/CANCELLED)
 *  ✅ 9. Guard de parámetro id inválido
 *  ✅ 10. Botón de llamada funcional con Linking.openURL
 */

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Clipboard,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { auth, db } from '../../src/config/firebase';
import { useTheme } from '../../src/context/ThemeContext';
import { sendPushNotification } from '../../utils/pushNotifications';

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────
type MessageType = 'text' | 'image';

interface Message {
  id: string;
  text?: string;
  senderId: string;
  createdAt: Timestamp | null;
  type: MessageType;
  mediaUrl?: string;
  _optimistic?: boolean; // Para UI optimista
}

interface JobDetails {
  clientId: string;
  providerId?: string;
  clientName?: string;
  providerName?: string;
  serviceType?: string;
  status?: string;
  price_agreed?: string;
  // Para typing indicator
  clientTyping?: boolean;
  providerTyping?: boolean;
  // Para llamada
  clientPhone?: string;
  providerPhone?: string;
}

// ─────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────
const PAGE_SIZE = 50;
const TYPING_TIMEOUT_MS = 3000;

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function formatTime(ts: Timestamp | null): string {
  if (!ts) return '···';
  return new Date(ts.seconds * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateLabel(ts: Timestamp | null): string {
  if (!ts) return '';
  const date = new Date(ts.seconds * 1000);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Hoy';
  if (date.toDateString() === yesterday.toDateString()) return 'Ayer';
  return date.toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function getStatusConfig(status?: string) {
  switch (status) {
    case 'PENDING':
      return { label: 'Pendiente', color: '#f1c40f', icon: 'time-outline' as const };
    case 'ACCEPTED':
      return { label: 'En camino', color: '#28a745', icon: 'checkmark-circle-outline' as const };
    case 'COMPLETED':
      return { label: 'Completado', color: '#17a2b8', icon: 'checkmark-done-outline' as const };
    case 'ARCHIVED':
      return { label: 'Finalizado', color: '#6c757d', icon: 'archive-outline' as const };
    case 'CANCELLED_BY_CLIENT':
    case 'CANCELLED_BY_PROVIDER':
      return { label: 'Cancelado', color: '#dc3545', icon: 'close-circle-outline' as const };
    default:
      return { label: 'Chat', color: '#6c757d', icon: 'chatbubble-outline' as const };
  }
}

function isChatClosed(status?: string): boolean {
  return ['ARCHIVED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_PROVIDER'].includes(status || '');
}

// ─────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme === 'dark';

  // ══════ GUARD: id inválido (#9) ══════
  if (!id) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: isDark ? '#0B141A' : '#ECE5DD' }]}>
        <Ionicons name="alert-circle-outline" size={60} color={isDark ? '#8696A0' : '#999'} />
        <Text style={[styles.errorTitle, { color: isDark ? '#E9EDEF' : '#111B21' }]}>
          Chat no encontrado
        </Text>
        <Text style={[styles.errorSubtitle, { color: isDark ? '#8696A0' : '#667781' }]}>
          El enlace es inválido o la conversación fue eliminada.
        </Text>
        <TouchableOpacity
          style={[styles.errorBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={styles.errorBtnText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Auth reactiva
  const [user, setUser] = useState<User | null>(auth.currentUser);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null);
  const [attachMenuVisible, setAttachMenuVisible] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  // Preview de imagen (#5)
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imagePreviewBase64, setImagePreviewBase64] = useState<string | null>(null);
  const [otherAvatar, setOtherAvatar] = useState<string | null>(null);
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [otherUserData, setOtherUserData] = useState<any>(null);

  const inputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList>(null);
  const scrollBtnOpacity = useRef(new Animated.Value(0)).current;
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDocRef = useRef<any>(null);

  // ══════ #2: useMemo para paleta de colores ══════
  const chatColors = useMemo(() => ({
    chatBg: isDark ? '#0B141A' : '#ECE5DD',
    bubbleOutBg: isDark ? '#005C4B' : colors.primary,
    bubbleInBg: isDark ? '#1F2C34' : '#FFFFFF',
    bubbleInText: isDark ? '#E9EDEF' : '#111827',
    bubbleOutText: '#FFFFFF',
    tsOut: 'rgba(255,255,255,0.70)',
    tsIn: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
    toolbarBg: isDark ? '#1F2C34' : '#F0F0F0',
    inputBg: isDark ? '#2A3942' : '#FFFFFF',
    inputText: isDark ? '#E9EDEF' : '#111111',
    inputBorder: isDark ? '#374045' : '#D0D0D0',
    headerBg: isDark ? '#1F2C34' : colors.primary,
    mutedText: isDark ? '#8696A0' : '#667781',
    dateChipBg: isDark ? '#233138' : '#E1F0DA',
    dateChipText: isDark ? '#8696A0' : '#54656F',
    emptyCircleBg: isDark ? '#233138' : '#DCF8C6',
    scrollFabBg: isDark ? '#2A3942' : '#fff',
  }), [isDark, colors.primary]);

  // ══════ Cargar detalles del servicio (real-time) ══════
  useEffect(() => {
    if (!id || !user) return;

    const unsub = onSnapshot(doc(db, 'service_requests', id), async (snap) => {
      if (snap.exists()) {
        const data = snap.data() as JobDetails;
        setJobDetails(data);

        // #4: Detectar si el OTRO usuario está escribiendo
        const isClient = user.uid === data.clientId;
        setOtherTyping(isClient ? !!data.providerTyping : !!data.clientTyping);

        // Cargar foto del otro usuario
        const otherUserId = isClient ? data.providerId : data.clientId;
        if (otherUserId) {
          try {
            const otherDoc = await getDoc(doc(db, 'users', otherUserId));
            if (otherDoc.exists()) {
              const otherData = otherDoc.data();
              setOtherAvatar(otherData.profile_photo || null);
              setOtherUserData(otherData);
            }
          } catch { /* silencioso */ }
        }
      }
    });
    return () => unsub();
  }, [id, user]);

  // ══════ #3: Escuchar mensajes con paginación ══════
  useEffect(() => {
    if (!id || !user) return;
    const q = query(
      collection(db, 'service_requests', id, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE)
    );
    const unsub = onSnapshot(q, (snap) => {
      const newMessages = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Message, 'id'>),
      }));

      // Guardar último documento para paginación
      if (snap.docs.length > 0) {
        lastDocRef.current = snap.docs[snap.docs.length - 1];
      }
      setHasMoreMessages(snap.docs.length >= PAGE_SIZE);

      // Merge con mensajes optimistas (remover los confirmados)
      setMessages((prev) => {
        const optimistic = prev.filter((m) => m._optimistic);
        const confirmedIds = new Set(newMessages.map((m) => m.id));
        const remainingOptimistic = optimistic.filter(
          (m) => !newMessages.some((nm) => nm.text === m.text && nm.senderId === m.senderId)
        );
        return [...remainingOptimistic, ...newMessages];
      });

      setLoading(false);
    });
    return () => unsub();
  }, [id, user]);

  // ══════ #3: Cargar más mensajes (paginación) ══════
  const loadMoreMessages = useCallback(async () => {
    if (!hasMoreMessages || loadingMore || !lastDocRef.current || !id) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'service_requests', id, 'messages'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDocRef.current),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      const olderMessages = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Message, 'id'>),
      }));

      if (snap.docs.length > 0) {
        lastDocRef.current = snap.docs[snap.docs.length - 1];
      }
      setHasMoreMessages(snap.docs.length >= PAGE_SIZE);
      setMessages((prev) => [...prev, ...olderMessages]);
    } catch (error) {
      console.error('Error cargando mensajes anteriores:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMoreMessages, loadingMore, id]);

  // ── Scroll-to-bottom button animation ──────
  useEffect(() => {
    Animated.timing(scrollBtnOpacity, {
      toValue: showScrollBtn ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showScrollBtn]);

  // ══════ #4: Typing indicator — escribir al Firestore ══════
  const setTypingStatus = useCallback(async (isTyping: boolean) => {
    if (!id || !user || !jobDetails) return;
    try {
      const field = user.uid === jobDetails.clientId ? 'clientTyping' : 'providerTyping';
      await updateDoc(doc(db, 'service_requests', id), { [field]: isTyping });
    } catch {
      // Silencioso: no bloquear UX por fallo de typing indicator
    }
  }, [id, user, jobDetails]);

  const handleTextChange = useCallback((text: string) => {
    setInputText(text);

    // Debounce typing indicator
    if (text.trim().length > 0) {
      setTypingStatus(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTypingStatus(false), TYPING_TIMEOUT_MS);
    } else {
      setTypingStatus(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  }, [setTypingStatus]);

  // Cleanup typing on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setTypingStatus(false);
    };
  }, [setTypingStatus]);

  // ══════ #1: Enviar texto con UI optimista ══════
  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !user || !id) return;
    setInputText('');
    setTypingStatus(false);
    inputRef.current?.focus();

    // Mensaje optimista: aparece al instante
    const optimisticMsg: Message = {
      id: `_opt_${Date.now()}`,
      text,
      senderId: user.uid,
      createdAt: Timestamp.now(),
      type: 'text',
      _optimistic: true,
    };
    setMessages((prev) => [optimisticMsg, ...prev]);

    try {
      await addDoc(collection(db, 'service_requests', id, 'messages'), {
        text,
        senderId: user.uid,
        createdAt: serverTimestamp(),
        type: 'text' as MessageType,
      });

      // #7: Push notification al otro usuario
      sendPushToOtherUser(text);
    } catch {
      // Rollback: remover optimista y restaurar texto
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setInputText(text);
      Alert.alert('Error', 'No se pudo enviar el mensaje.');
    }
  }, [inputText, user, id, setTypingStatus]);

  // ══════ #7: Push notification helper ══════
  const sendPushToOtherUser = useCallback(async (msgText: string) => {
    if (!jobDetails || !user) return;
    try {
      const otherUserId = user.uid === jobDetails.clientId
        ? jobDetails.providerId
        : jobDetails.clientId;
      if (!otherUserId) return;

      const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
      if (otherUserDoc.exists() && otherUserDoc.data().expoPushToken) {
        const senderName = user.uid === jobDetails.clientId
          ? (jobDetails.clientName || user.email?.split('@')[0] || 'Cliente')
          : (jobDetails.providerName || user.email?.split('@')[0] || 'Técnico');

        await sendPushNotification(
          otherUserDoc.data().expoPushToken,
          `💬 ${senderName}`,
          msgText.length > 80 ? msgText.substring(0, 80) + '...' : msgText
        );
      }
    } catch {
      // Silencioso: no bloquear UX por fallo de push
    }
  }, [jobDetails, user]);

  // ══════ #5: Enviar imagen con preview ══════
  const pickImage = useCallback(async (useCamera: boolean) => {
    setAttachMenuVisible(false);
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a la cámara/galería.');
      return;
    }
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5, base64: true, allowsEditing: true, aspect: [4, 3] })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5, base64: true, allowsEditing: true, aspect: [4, 3] });

    if (result.canceled || !result.assets?.length) return;

    // Mostrar preview
    setImagePreview(result.assets[0].uri);
    setImagePreviewBase64(result.assets[0].base64 || null);
  }, []);

  const confirmSendImage = useCallback(async () => {
    if (!imagePreviewBase64 || !user || !id) return;
    setSending(true);
    setImagePreview(null);

    try {
      await addDoc(collection(db, 'service_requests', id, 'messages'), {
        mediaUrl: `data:image/jpeg;base64,${imagePreviewBase64}`,
        senderId: user.uid,
        createdAt: serverTimestamp(),
        type: 'image' as MessageType,
      });

      // Push para imagen
      sendPushToOtherUser('📷 Imagen');
    } catch {
      Alert.alert('Error', 'La imagen es demasiado grande o hubo un fallo de red.');
    } finally {
      setSending(false);
      setImagePreviewBase64(null);
    }
  }, [imagePreviewBase64, user, id, sendPushToOtherUser]);

  const cancelImagePreview = useCallback(() => {
    setImagePreview(null);
    setImagePreviewBase64(null);
  }, []);

  // ══════ #6: Copiar mensaje ══════
  const handleLongPress = useCallback(async (item: Message) => {
    if (item.type !== 'text' || !item.text) return;
    try {
      Clipboard.setString(item.text);
      Toast.show({
        type: 'success',
        text1: 'Copiado',
        text2: 'Mensaje copiado al portapapeles',
        visibilityTime: 1500,
      });
    } catch {
      // Fallback silencioso
    }
  }, []);

  // ══════ #10: Llamada funcional ══════
  const handleCall = useCallback(async () => {
    if (!jobDetails || !user) return;

    const otherUserId = user.uid === jobDetails.clientId
      ? jobDetails.providerId
      : jobDetails.clientId;
    if (!otherUserId) return;

    try {
      const otherDoc = await getDoc(doc(db, 'users', otherUserId));
      if (otherDoc.exists()) {
        const data = otherDoc.data();
        const phone = data.phone || data.phone_number;
        if (phone) {
          Linking.openURL(`tel:${phone}`);
          return;
        }
      }
      Alert.alert(
        'Sin número registrado',
        'El otro usuario no ha registrado su número de teléfono en su perfil.',
        [{ text: 'Entendido' }]
      );
    } catch {
      Alert.alert('Error', 'No se pudo obtener la información de contacto.');
    }
  }, [jobDetails, user]);

  // ── Detectar si necesita separador de fecha ─
  const needsDateSeparator = useCallback((index: number): string | null => {
    const current = messages[index];
    const next = messages[index + 1];

    if (!current?.createdAt) return null;
    if (!next) return formatDateLabel(current.createdAt);

    const currentDate = new Date(current.createdAt.seconds * 1000).toDateString();
    const nextDate = next.createdAt
      ? new Date(next.createdAt.seconds * 1000).toDateString()
      : null;

    if (currentDate !== nextDate) return formatDateLabel(current.createdAt);
    return null;
  }, [messages]);

  // ── Render burbuja ─────────────────────────
  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
    const isMe = item.senderId === user?.uid;
    const isImage = item.type === 'image' && !!item.mediaUrl;
    const dateSeparator = needsDateSeparator(index);
    const isOptimistic = item._optimistic;

    return (
      <View>
        {dateSeparator && (
          <View style={styles.dateSeparatorRow}>
            <View style={[styles.dateSeparatorPill, { backgroundColor: chatColors.dateChipBg }]}>
              <Text style={[styles.dateSeparatorText, { color: chatColors.dateChipText }]}>
                {dateSeparator}
              </Text>
            </View>
          </View>
        )}

        {isImage ? (
          <View style={[styles.msgWrapper, isMe ? styles.wrapperMe : styles.wrapperOther]}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setViewImageUrl(item.mediaUrl || null)}
              style={[styles.imageBubble, isMe ? styles.bubbleMeRadius : styles.bubbleOtherRadius]}
            >
              <Image source={{ uri: item.mediaUrl }} style={styles.chatImage} resizeMode="cover" />
              <View style={styles.imageTimeRow}>
                <Text style={styles.imageTimeText}>
                  {formatTime(item.createdAt)}{isMe ? ' ✓✓' : ''}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <Pressable
            onLongPress={() => handleLongPress(item)}
            delayLongPress={400}
            style={[styles.msgWrapper, isMe ? styles.wrapperMe : styles.wrapperOther]}
          >
            <View style={[
              styles.textBubble,
              isMe
                ? [styles.bubbleMeRadius, { backgroundColor: chatColors.bubbleOutBg }]
                : [styles.bubbleOtherRadius, { backgroundColor: chatColors.bubbleInBg }],
              isOptimistic && { opacity: 0.7 },
            ]}>
              <Text style={[styles.msgText, { color: isMe ? chatColors.bubbleOutText : chatColors.bubbleInText }]}>
                {item.text}
              </Text>
              <Text style={[styles.msgTime, { color: isMe ? chatColors.tsOut : chatColors.tsIn }]}>
                {isOptimistic ? '⏳' : formatTime(item.createdAt)}{isMe && !isOptimistic ? ' ✓✓' : ''}
              </Text>
            </View>
          </Pressable>
        )}
      </View>
    );
  }, [user, chatColors, needsDateSeparator, handleLongPress]);

  // ── Datos derivados ────────────────────────
  const otherName = jobDetails
    ? (user?.uid === jobDetails.clientId ? jobDetails.providerName : jobDetails.clientName) ?? 'Usuario'
    : 'Cargando…';
  const statusConfig = getStatusConfig(jobDetails?.status);
  const chatClosed = isChatClosed(jobDetails?.status);

  // ── Offset teclado ─────────────────────────
  const KAV_OFFSET = Platform.OS === 'ios' ? insets.top + 56 : 0;

  // ── Loading state ──────────────────────────
  if (loading) {
    return (
      <View style={[styles.fill, { backgroundColor: chatColors.chatBg }]}>
        <StatusBar barStyle="light-content" backgroundColor={chatColors.headerBg} translucent />
        <View style={[styles.fakeHeader, { backgroundColor: chatColors.headerBg, paddingTop: insets.top }]} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: chatColors.mutedText }]}>
            Cargando mensajes…
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: chatColors.chatBg }]}>
      <StatusBar barStyle="light-content" backgroundColor={chatColors.headerBg} translucent />

      {/* ═══════════ HEADER ═══════════ */}
      <View style={[styles.header, { backgroundColor: chatColors.headerBg, paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Volver atrás"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.avatar}
          onPress={() => { if (otherAvatar) setViewImageUrl(otherAvatar); }}
          activeOpacity={otherAvatar ? 0.7 : 1}
        >
          {otherAvatar ? (
            <Image source={{ uri: otherAvatar }} style={styles.avatarImg} />
          ) : (
            <Ionicons name="person" size={20} color={colors.primary} />
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerInfo} onPress={() => setShowProfileCard(true)} activeOpacity={0.7}>
          <Text style={styles.headerTitle} numberOfLines={1}>{otherName}</Text>
          <View style={styles.headerStatusRow}>
            {/* #4: Typing indicator en header */}
            {otherTyping ? (
              <Text style={styles.headerTyping}>escribiendo...</Text>
            ) : (
              <>
                <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
                <Text style={styles.headerSub} numberOfLines={1}>
                  {statusConfig.label}
                  {jobDetails?.price_agreed ? ` · ${jobDetails.price_agreed}` : ''}
                </Text>
              </>
            )}
          </View>
        </TouchableOpacity>

        {/* #10: Botón de llamada funcional */}
        <TouchableOpacity
          onPress={handleCall}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Realizar llamada"
          accessibilityRole="button"
          style={styles.headerAction}
        >
          <Ionicons name="call-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ═══════════ CUERPO + TECLADO ═══════════ */}
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={KAV_OFFSET}
      >
        <View style={styles.fill}>
          <FlatList<Message>
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            inverted
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onScroll={(e) => {
              const offset = e.nativeEvent.contentOffset.y;
              setShowScrollBtn(offset > 300);
            }}
            scrollEventThrottle={100}
            // #3: Paginación — cargar más al llegar al final
            onEndReached={loadMoreMessages}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.loadingMoreWrap}>
                  <ActivityIndicator size="small" color={chatColors.mutedText} />
                  <Text style={[styles.loadingMoreText, { color: chatColors.mutedText }]}>
                    Cargando anteriores...
                  </Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <View style={[styles.emptyIconCircle, { backgroundColor: chatColors.emptyCircleBg }]}>
                  <Ionicons name="chatbubbles-outline" size={40} color={chatColors.mutedText} />
                </View>
                <Text style={[styles.emptyTitle, { color: isDark ? '#E9EDEF' : '#111B21' }]}>
                  ¡Inicia la conversación!
                </Text>
                <Text style={[styles.emptySubtitle, { color: chatColors.mutedText }]}>
                  Coordina los detalles del servicio{'\n'}directamente con {otherName}
                </Text>
              </View>
            }
          />

          {/* Scroll-to-bottom FAB */}
          <Animated.View
            pointerEvents={showScrollBtn ? 'auto' : 'none'}
            style={[styles.scrollFab, { opacity: scrollBtnOpacity, backgroundColor: chatColors.scrollFabBg }]}
          >
            <TouchableOpacity
              onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
              accessibilityLabel="Ir al final"
            >
              <Ionicons name="chevron-down" size={22} color={isDark ? '#E9EDEF' : '#54656F'} />
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* ═══════════ #8: BANNER CHAT CERRADO ═══════════ */}
        {chatClosed && (
          <View style={[styles.closedBanner, { backgroundColor: isDark ? '#1A2C36' : '#FFF3CD' }]}>
            <Ionicons
              name={jobDetails?.status === 'ARCHIVED' ? 'archive-outline' : 'close-circle-outline'}
              size={16}
              color={isDark ? '#8696A0' : '#856404'}
            />
            <Text style={[styles.closedBannerText, { color: isDark ? '#8696A0' : '#856404' }]}>
              {jobDetails?.status === 'ARCHIVED'
                ? 'Este chat pertenece a un servicio finalizado.'
                : 'Este servicio fue cancelado. El chat es de solo lectura.'}
            </Text>
          </View>
        )}

        {/* ═══════════ INPUT BAR ═══════════ */}
        {!chatClosed ? (
          <View style={[styles.toolbar, { backgroundColor: chatColors.toolbarBg, paddingBottom: Math.max(insets.bottom, 8), borderTopColor: chatColors.inputBorder }]}>
            <Pressable
              onPress={() => setAttachMenuVisible(true)}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
              accessibilityLabel="Adjuntar archivo"
              accessibilityRole="button"
            >
              <Ionicons name="add-circle-outline" size={26} color={chatColors.mutedText} />
            </Pressable>

            <TextInput
              ref={inputRef}
              style={[styles.textInput, {
                backgroundColor: chatColors.inputBg,
                color: chatColors.inputText,
                borderColor: chatColors.inputBorder,
              }]}
              placeholder="Escribe un mensaje..."
              placeholderTextColor={chatColors.mutedText}
              value={inputText}
              onChangeText={handleTextChange}
              multiline
              maxLength={2000}
              blurOnSubmit={false}
              accessibilityLabel="Campo de mensaje"
            />

            <Pressable
              onPress={sendMessage}
              disabled={sending || !inputText.trim()}
              style={({ pressed }) => [
                styles.sendBtn,
                { backgroundColor: colors.primary },
                (!inputText.trim() || sending) && styles.sendBtnDisabled,
                pressed && { opacity: 0.75 },
              ]}
              accessibilityLabel="Enviar mensaje"
              accessibilityRole="button"
            >
              {sending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Ionicons name="send" size={18} color="#fff" style={{ marginLeft: 2 }} />
              }
            </Pressable>
          </View>
        ) : (
          <View style={[styles.closedToolbar, { backgroundColor: chatColors.toolbarBg, paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Ionicons name="lock-closed-outline" size={16} color={chatColors.mutedText} />
            <Text style={[styles.closedToolbarText, { color: chatColors.mutedText }]}>
              No puedes enviar mensajes en este chat
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* ═══════════ MODAL DE ADJUNTOS ═══════════ */}
      <Modal
        visible={attachMenuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAttachMenuVisible(false)}
      >
        <Pressable style={styles.attachOverlay} onPress={() => setAttachMenuVisible(false)}>
          <View style={[styles.attachSheet, { backgroundColor: isDark ? '#1F2C34' : '#fff' }]}>
            <View style={[styles.attachHandle, { backgroundColor: chatColors.inputBorder }]} />
            <Text style={[styles.attachTitle, { color: isDark ? '#E9EDEF' : '#111B21' }]}>
              Enviar archivo
            </Text>

            <View style={styles.attachGrid}>
              <TouchableOpacity
                style={styles.attachOption}
                onPress={() => pickImage(true)}
                accessibilityLabel="Tomar foto con cámara"
              >
                <View style={[styles.attachIconCircle, { backgroundColor: '#007AFF' }]}>
                  <Ionicons name="camera" size={26} color="#fff" />
                </View>
                <Text style={[styles.attachLabel, { color: isDark ? '#E9EDEF' : '#111B21' }]}>
                  Cámara
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.attachOption}
                onPress={() => pickImage(false)}
                accessibilityLabel="Seleccionar de galería"
              >
                <View style={[styles.attachIconCircle, { backgroundColor: '#34C759' }]}>
                  <Ionicons name="images" size={26} color="#fff" />
                </View>
                <Text style={[styles.attachLabel, { color: isDark ? '#E9EDEF' : '#111B21' }]}>
                  Galería
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ═══════════ #5: MODAL PREVIEW DE IMAGEN ═══════════ */}
      <Modal
        visible={!!imagePreview}
        transparent
        animationType="fade"
        onRequestClose={cancelImagePreview}
      >
        <View style={[styles.previewOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.95)' : 'rgba(0,0,0,0.9)' }]}>
          {/* Header del preview */}
          <View style={[styles.previewHeader, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity onPress={cancelImagePreview} accessibilityLabel="Cancelar envío">
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.previewHeaderTitle}>Vista previa</Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Imagen */}
          {imagePreview && (
            <View style={styles.previewImageContainer}>
              <Image
                source={{ uri: imagePreview }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            </View>
          )}

          {/* Botón enviar */}
          <View style={[styles.previewFooter, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <TouchableOpacity
              style={[styles.previewSendBtn, { backgroundColor: colors.primary }]}
              onPress={confirmSendImage}
              disabled={sending}
              accessibilityLabel="Confirmar envío de imagen"
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.previewSendText}>Enviar imagen</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════ MODAL FULLSCREEN IMAGE VIEWER ═══════════ */}
      <Modal
        visible={!!viewImageUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setViewImageUrl(null)}
      >
        <View style={styles.imageViewerOverlay}>
          <TouchableOpacity
            style={[styles.imageViewerClose, { top: insets.top + 10 }]}
            onPress={() => setViewImageUrl(null)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {viewImageUrl && (
            <Image
              source={{ uri: viewImageUrl }}
              style={{
                width: require('react-native').Dimensions.get('window').width,
                height: require('react-native').Dimensions.get('window').height * 0.8,
              }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* ═══════════ MODAL PROFILE CARD ═══════════ */}
      <Modal
        visible={showProfileCard}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProfileCard(false)}
      >
        <Pressable style={styles.profileCardOverlay} onPress={() => setShowProfileCard(false)}>
          <View style={[styles.profileCard, { backgroundColor: isDark ? '#1F2C34' : '#fff' }]}>
            <View style={[styles.profileCardHandle, { backgroundColor: isDark ? '#4a5568' : '#ccc' }]} />

            {/* Avatar grande */}
            <View style={styles.profileCardAvatarWrap}>
              {otherAvatar ? (
                <Image source={{ uri: otherAvatar }} style={styles.profileCardAvatar} />
              ) : (
                <View style={[styles.profileCardAvatarPlaceholder, { backgroundColor: isDark ? '#2A3942' : '#E3F2FD' }]}>
                  <Ionicons name="person" size={50} color={isDark ? '#8696A0' : colors.primary} />
                </View>
              )}
            </View>

            {/* Nombre */}
            <Text style={[styles.profileCardName, { color: isDark ? '#E9EDEF' : '#111B21' }]}>
              {otherName}
            </Text>

            {/* Rol */}
            {otherUserData?.role && (
              <View style={[styles.profileCardRoleBadge, { backgroundColor: isDark ? '#2A3942' : '#E8F5E9' }]}>
                <Ionicons
                  name={otherUserData.role === 'PROVIDER' ? 'construct' : 'person'}
                  size={14}
                  color={isDark ? '#25D366' : '#2E7D32'}
                />
                <Text style={[styles.profileCardRoleText, { color: isDark ? '#25D366' : '#2E7D32' }]}>
                  {otherUserData.role === 'PROVIDER' ? 'Profesional' : 'Cliente'}
                </Text>
              </View>
            )}

            {/* Datos */}
            <View style={[styles.profileCardInfo, { backgroundColor: isDark ? '#0d1418' : '#F8F9FA' }]}>
              {otherUserData?.specialty && (
                <View style={styles.profileCardRow}>
                  <Ionicons name="briefcase-outline" size={18} color={isDark ? '#8696A0' : '#666'} />
                  <Text style={[styles.profileCardRowText, { color: isDark ? '#E9EDEF' : '#333' }]}>
                    {otherUserData.specialty}
                  </Text>
                </View>
              )}
              {(otherUserData?.phone || otherUserData?.phone_number) && (
                <View style={styles.profileCardRow}>
                  <Ionicons name="call-outline" size={18} color={isDark ? '#8696A0' : '#666'} />
                  <Text style={[styles.profileCardRowText, { color: isDark ? '#E9EDEF' : '#333' }]}>
                    {otherUserData.phone || otherUserData.phone_number}
                  </Text>
                </View>
              )}
              {otherUserData?.email && (
                <View style={styles.profileCardRow}>
                  <Ionicons name="mail-outline" size={18} color={isDark ? '#8696A0' : '#666'} />
                  <Text style={[styles.profileCardRowText, { color: isDark ? '#E9EDEF' : '#333' }]}>
                    {otherUserData.email}
                  </Text>
                </View>
              )}
              {otherUserData?.total_rating != null && otherUserData?.review_count > 0 && (
                <View style={styles.profileCardRow}>
                  <Ionicons name="star" size={18} color="#f1c40f" />
                  <Text style={[styles.profileCardRowText, { color: isDark ? '#E9EDEF' : '#333' }]}>
                    {(otherUserData.total_rating / otherUserData.review_count).toFixed(1)} ({otherUserData.review_count} reseñas)
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.profileCardCallBtn, { backgroundColor: colors.primary }]}
              onPress={() => { setShowProfileCard(false); handleCall(); }}
            >
              <Ionicons name="call" size={20} color="#fff" />
              <Text style={styles.profileCardCallText}>Llamar</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────
// ESTILOS
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14 },

  // ── Error state (#9) ───────────────────
  errorTitle: { fontSize: 20, fontWeight: '700', marginTop: 16 },
  errorSubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, paddingHorizontal: 40 },
  errorBtn: { marginTop: 24, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 },
  errorBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  fakeHeader: { width: '100%' },

  // ── Header ──────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  headerInfo: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  headerSub: { color: 'rgba(255,255,255,0.82)', fontSize: 12 },
  headerTyping: { color: '#25D366', fontSize: 12, fontWeight: '600', fontStyle: 'italic' },
  headerAction: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Date separators ─────────────────────
  dateSeparatorRow: { alignItems: 'center', marginVertical: 12 },
  dateSeparatorPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  dateSeparatorText: { fontSize: 12, fontWeight: '600' },

  // ── Lista ──────────────────────────────
  listContent: { paddingHorizontal: 12, paddingVertical: 10 },

  // ── Loading more (pagination) ──────────
  loadingMoreWrap: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, gap: 8 },
  loadingMoreText: { fontSize: 13 },

  // ── Empty state ────────────────────────
  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // ── Burbujas comunes ───────────────────
  msgWrapper: { marginBottom: 4, maxWidth: '78%' },
  wrapperMe: { alignSelf: 'flex-end' },
  wrapperOther: { alignSelf: 'flex-start' },
  bubbleMeRadius: { borderRadius: 18, borderBottomRightRadius: 4 },
  bubbleOtherRadius: { borderRadius: 18, borderBottomLeftRadius: 4 },

  textBubble: {
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  msgText: { fontSize: 15.5, lineHeight: 21 },
  msgTime: { fontSize: 10.5, alignSelf: 'flex-end', marginTop: 4 },

  imageBubble: {
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  chatImage: { width: 220, height: 220 },
  imageTimeRow: {
    position: 'absolute', bottom: 0, right: 0, left: 0,
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.30)',
    alignItems: 'flex-end',
  },
  imageTimeText: { color: '#fff', fontSize: 10.5 },

  // ── Scroll FAB ────────────────────────
  scrollFab: {
    position: 'absolute', bottom: 8, right: 12,
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },

  // ── #8: Closed banner ─────────────────
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  closedBannerText: { fontSize: 12, fontWeight: '500', flex: 1 },

  // ── Toolbar ───────────────────────────
  toolbar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  closedToolbar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  closedToolbarText: { fontSize: 14, fontWeight: '500' },
  iconBtn: { padding: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  textInput: {
    flex: 1, borderRadius: 22,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10,
    fontSize: 15.5, maxHeight: 110,
    marginHorizontal: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  sendBtnDisabled: { opacity: 0.45 },

  // ── Attach modal ──────────────────────
  attachOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  attachSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  attachHandle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 20,
  },
  attachTitle: { fontSize: 17, fontWeight: '700', marginBottom: 20 },
  attachGrid: { flexDirection: 'row', justifyContent: 'flex-start', gap: 30 },
  attachOption: { alignItems: 'center' },
  attachIconCircle: {
    width: 58, height: 58, borderRadius: 29,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  attachLabel: { fontSize: 13, fontWeight: '500' },

  // ── #5: Image preview modal ───────────
  previewOverlay: { flex: 1 },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  previewHeaderTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  previewImageContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  previewImage: { width: '100%', height: '100%', borderRadius: 12 },
  previewFooter: { paddingHorizontal: 20, paddingTop: 12 },
  previewSendBtn: {
    flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center',
    paddingVertical: 16, borderRadius: 14,
    elevation: 3,
  },
  previewSendText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Fullscreen image viewer ────────────
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerClose: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImage: { width: '100%', height: '100%' },
  imageViewerScrollContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ── Profile card modal ────────────────
  profileCardOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  profileCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    alignItems: 'center',
    elevation: 20,
  },
  profileCardHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 20,
  },
  profileCardAvatarWrap: { marginBottom: 14 },
  profileCardAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  profileCardAvatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCardName: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  profileCardRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 18,
  },
  profileCardRoleText: { fontSize: 13, fontWeight: '600' },
  profileCardInfo: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
  },
  profileCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  profileCardRowText: { fontSize: 15, fontWeight: '500' },
  profileCardCallBtn: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    elevation: 3,
    marginBottom: 10,
  },
  profileCardCallText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});