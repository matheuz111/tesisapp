/** Chat del servicio: mensajes recientes en vivo e historial paginado. */

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  addDoc,
  setDoc,
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
import * as Clipboard from 'expo-clipboard';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { auth, db } from '../../src/config/firebase';
import { useTheme } from '../../src/context/ThemeContext';
import { useSession } from '../../src/context/SessionContext';
import { queueDemoPushNotification as sendDemoPushNotification } from '../../src/services/demoPushService';

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
  notificationTokens?: {
    client?: string[];
    provider?: string[];
  };
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
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const { user } = useSession();
  const router = useRouter();
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme === 'dark';

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
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
  const [scrollBtnOpacity] = useState(() => new Animated.Value(0));
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDocRef = useRef<any>(null);
  const loadedHistoryRef = useRef(false);
  const pagingRef = useRef(false);
  const typingSentRef = useRef(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // ══════ LISTENER DE TECLADO RESPONSIVE ══════
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ══════ #2: useMemo para paleta de colores (Estilo WhatsApp) ══════
  const chatColors = useMemo(() => ({
    chatBg: isDark ? '#0B141A' : '#EFEAE2',
    bubbleOutBg: isDark ? '#005C4B' : '#008069',
    bubbleInBg: isDark ? '#1F2C34' : '#FFFFFF',
    bubbleInText: isDark ? '#E9EDEF' : '#111827',
    bubbleOutText: '#FFFFFF',
    tsOut: 'rgba(255,255,255,0.70)',
    tsIn: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
    toolbarBg: 'transparent',
    inputBg: isDark ? '#1F2C34' : '#FFFFFF',
    inputText: isDark ? '#E9EDEF' : '#111111',
    inputBorder: 'transparent',
    headerBg: isDark ? '#1F2C34' : '#008069',
    mutedText: isDark ? '#8696A0' : '#667781',
    dateChipBg: isDark ? '#233138' : '#E1F0DA',
    dateChipText: isDark ? '#8696A0' : '#54656F',
    emptyCircleBg: isDark ? '#233138' : '#DCF8C6',
    scrollFabBg: isDark ? '#2A3942' : '#fff',
  }), [isDark]);

  // Cada suscripción pertenece a una cuenta y se invalida al cambiar de servicio.
  useEffect(() => {
    setMessages([]); setJobDetails(null); setOtherUserData(null); setOtherAvatar(null);
    setInputText(''); setOtherTyping(false); setImagePreview(null); setImagePreviewBase64(null);
    setChatError(null); setLoading(Boolean(id && user)); setLoadingMore(false);
    lastDocRef.current = null; loadedHistoryRef.current = false; pagingRef.current = false;
    if (!id || !user) return;
    let active = true;
    const timeout = setTimeout(() => {
      if (active) { setLoading(false); setChatError('La conexión está tardando. Puedes volver o intentar de nuevo.'); }
    }, 10000);
    const unsubscribe = onSnapshot(doc(db, 'service_requests', id), (snap) => {
      if (!active || auth.currentUser?.uid !== user.uid) return;
      clearTimeout(timeout);
      if (!snap.exists()) { setLoading(false); setChatError('La conversación ya no está disponible.'); return; }
      const data = snap.data() as JobDetails;
      if (data.clientId !== user.uid && data.providerId !== user.uid) {
        setLoading(false); setChatError('No tienes acceso a esta conversación.'); return;
      }
      setJobDetails(data);
      setChatError(null);
      setOtherTyping(user.uid === data.clientId ? !!data.providerTyping : !!data.clientTyping);
    }, (error) => {
      if (!active || auth.currentUser?.uid !== user.uid) return;
      clearTimeout(timeout); setLoading(false);
      console.warn('No se pudo consultar la conversación:', error.message);
      setChatError('No se pudo abrir la conversación. Revisa tu conexión.');
    });
    return () => { active = false; clearTimeout(timeout); unsubscribe(); };
  }, [id, user, retryAttempt]);

  const otherUserId = user?.uid === jobDetails?.clientId ? jobDetails?.providerId : jobDetails?.clientId;
  useEffect(() => {
    setOtherUserData(null); setOtherAvatar(null);
    if (!otherUserId || !user) return;
    let active = true;
    // Cambiar "escribiendo" o el estado del servicio no vuelve a leer el perfil.
    const unsubscribe = onSnapshot(doc(db, 'users', otherUserId), (snapshot) => {
      if (!active || auth.currentUser?.uid !== user.uid) return;
      const data = snapshot.data();
      setOtherUserData(data || null); setOtherAvatar(data?.profile_photo || null);
    }, () => { /* Los mensajes siguen disponibles aunque el perfil no tenga acceso. */ });
    return () => { active = false; unsubscribe(); };
  }, [otherUserId, user]);

  useEffect(() => {
    if (!id || !user) return;
    let active = true;
    const timeout = setTimeout(() => {
      if (active) { setLoading(false); setChatError('No se pudieron cargar los mensajes todavía. Vuelve a intentar.'); }
    }, 10000);
    const unsubscribe = onSnapshot(query(collection(db, 'service_requests', id, 'messages'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE)), (snap) => {
      if (!active || auth.currentUser?.uid !== user.uid) return;
      clearTimeout(timeout);
      const recent = snap.docs.map((d) => ({ id: d.id, ...(d.data({ serverTimestamps: 'estimate' }) as Omit<Message, 'id'>) }));
      if (!loadedHistoryRef.current) {
        lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
        setHasMoreMessages(snap.docs.length >= PAGE_SIZE);
      }
      const recentIds = new Set(recent.map((message) => message.id));
      const oldest = recent[recent.length - 1]?.createdAt?.toMillis() ?? Infinity;
      setMessages((previous) => {
        const retained = previous.filter((message) => !recentIds.has(message.id) && (message._optimistic || (message.createdAt?.toMillis() ?? Infinity) < oldest));
        return [...recent, ...retained].sort((a, b) => (b.createdAt?.toMillis() ?? Infinity) - (a.createdAt?.toMillis() ?? Infinity));
      });
      setLoading(false);
    }, (error) => {
      if (!active || auth.currentUser?.uid !== user.uid) return;
      clearTimeout(timeout); setLoading(false);
      console.warn('No se pudieron cargar los mensajes:', error.message);
      setChatError('No se pudieron cargar los mensajes. Revisa tu conexión.');
    });
    return () => { active = false; clearTimeout(timeout); unsubscribe(); };
  }, [id, user, retryAttempt]);

  const loadMoreMessages = useCallback(async () => {
    if (!hasMoreMessages || pagingRef.current || !lastDocRef.current || !id || !user) return;
    const accountId = user.uid;
    pagingRef.current = true; setLoadingMore(true);
    try {
      const snap = await getDocs(query(collection(db, 'service_requests', id, 'messages'), orderBy('createdAt', 'desc'), startAfter(lastDocRef.current), limit(PAGE_SIZE)));
      if (auth.currentUser?.uid !== accountId) return;
      const older = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Message, 'id'>) }));
      loadedHistoryRef.current = true;
      if (snap.docs.length > 0) lastDocRef.current = snap.docs[snap.docs.length - 1];
      setHasMoreMessages(snap.docs.length >= PAGE_SIZE);
      setMessages((previous) => {
        const ids = new Set(previous.map((message) => message.id));
        return [...previous, ...older.filter((message) => !ids.has(message.id))];
      });
    } catch (error) {
      if (auth.currentUser?.uid === accountId) Toast.show({ type: 'error', text1: 'No se cargaron los mensajes anteriores', text2: 'Vuelve a deslizar para intentar de nuevo.' });
      console.warn('No se pudieron cargar mensajes anteriores:', error);
    } finally {
      if (auth.currentUser?.uid === accountId) { pagingRef.current = false; setLoadingMore(false); }
    }
  }, [hasMoreMessages, id, user]);

  // ── Scroll-to-bottom button animation ──────
  useEffect(() => {
    Animated.timing(scrollBtnOpacity, {
      toValue: showScrollBtn ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showScrollBtn, scrollBtnOpacity]);

  // ══════ #4: Typing indicator — escribir al Firestore ══════
  const typingField = !jobDetails || !user ? null : user.uid === jobDetails.clientId ? 'clientTyping' : 'providerTyping';
  const setTypingStatus = useCallback(async (isTyping: boolean) => {
    if (!id || !user || !typingField || auth.currentUser?.uid !== user.uid || typingSentRef.current === isTyping) return;
    typingSentRef.current = isTyping;
    try {
      await updateDoc(doc(db, 'service_requests', id), { [typingField]: isTyping });
    } catch {
      // Silencioso: no bloquear UX por fallo de typing indicator
    }
  }, [id, user, typingField]);

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
    if (!text || !user || !id || !jobDetails || isChatClosed(jobDetails.status) || auth.currentUser?.uid !== user.uid) return;
    setInputText('');
    setTypingStatus(false);
    inputRef.current?.focus();

    // Mensaje optimista: aparece al instante
    const messageRef = doc(collection(db, 'service_requests', id, 'messages'));
    const optimisticMsg: Message = {
      id: messageRef.id,
      text,
      senderId: user.uid,
      createdAt: Timestamp.now(),
      type: 'text',
      _optimistic: true,
    };
    setMessages((prev) => [optimisticMsg, ...prev]);

    try {
      await setDoc(messageRef, {
        text,
        senderId: user.uid,
        createdAt: serverTimestamp(),
        type: 'text' as MessageType,
      });

      if (auth.currentUser?.uid !== user.uid) return;
      // Notificar al otro participante (modo demo-direct)
      const isClient = user.uid === jobDetails?.clientId;
      const targetTokens = isClient
        ? jobDetails?.notificationTokens?.provider
        : jobDetails?.notificationTokens?.client;
      const senderName = isClient
        ? jobDetails?.clientName || 'Cliente'
        : jobDetails?.providerName || 'Técnico';

      if (targetTokens && targetTokens.length > 0) {
        sendDemoPushNotification(
          targetTokens,
          `💬 ${senderName}`,
          text,
          {
            requestId: id,
            screen: 'chat',
            type: 'NEW_MESSAGE',
            recipientId: isClient ? jobDetails?.providerId : jobDetails?.clientId,
          }
        ).catch(() => {});
      }
    } catch {
      if (auth.currentUser?.uid !== user.uid) return;
      // Rollback: remover optimista y restaurar texto
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setInputText(text);
      Alert.alert('Error', 'No se pudo enviar el mensaje.');
    }
  }, [inputText, user, id, jobDetails, setTypingStatus]);

  // ══════ #5: Enviar imagen con preview y compresión óptima ══════
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
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.35, base64: true, allowsEditing: true, aspect: [4, 3] })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.35, base64: true, allowsEditing: true, aspect: [4, 3] });

    if (result.canceled || !result.assets?.length) return;

    // Mostrar preview
    setImagePreview(result.assets[0].uri);
    setImagePreviewBase64(result.assets[0].base64 || null);
  }, []);

  const confirmSendImage = useCallback(async () => {
    if (!imagePreviewBase64 || !user || !id || !jobDetails || isChatClosed(jobDetails.status) || auth.currentUser?.uid !== user.uid) return;
    
    // Validación estricta de tamaño de imagen para no sobrepasar límite de 1MB de Firestore
    if (imagePreviewBase64.length > 800000) {
      Alert.alert('Imagen muy pesada', 'Por favor selecciona una foto de menor resolución.');
      return;
    }

    setSending(true);
    setImagePreview(null);

    try {
      await addDoc(collection(db, 'service_requests', id, 'messages'), {
        mediaUrl: `data:image/jpeg;base64,${imagePreviewBase64}`,
        senderId: user.uid,
        createdAt: serverTimestamp(),
        type: 'image' as MessageType,
      });

      // Notificar al otro participante (modo demo-direct)
      const isClient = user.uid === jobDetails?.clientId;
      const targetTokens = isClient
        ? jobDetails?.notificationTokens?.provider
        : jobDetails?.notificationTokens?.client;
      const senderName = isClient
        ? jobDetails?.clientName || 'Cliente'
        : jobDetails?.providerName || 'Técnico';

      if (targetTokens && targetTokens.length > 0) {
        sendDemoPushNotification(
          targetTokens,
          `💬 ${senderName}`,
          '📷 Imagen',
          {
            requestId: id,
            screen: 'chat',
            type: 'NEW_MESSAGE',
            recipientId: isClient ? jobDetails?.providerId : jobDetails?.clientId,
          }
        ).catch(() => {});
      }
    } catch {
      Alert.alert('Error', 'La imagen no pudo enviarse. Revisa tu conexión a internet.');
    }
    setSending(false);
    setImagePreviewBase64(null);
  }, [imagePreviewBase64, user, id, jobDetails]);

  const cancelImagePreview = useCallback(() => {
    setImagePreview(null);
    setImagePreviewBase64(null);
  }, []);

  // ══════ #6: Copiar mensaje ══════
  const handleLongPress = useCallback(async (item: Message) => {
    if (item.type !== 'text' || !item.text) return;
    try {
      await Clipboard.setStringAsync(item.text);
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

  // ══════ #11: Copiar Yape / Plin ══════
  const handleCopyYape = useCallback(async () => {
    const yapeNum = otherUserData?.yape_number || otherUserData?.phone || otherUserData?.phone_number;
    if (!yapeNum) {
      Alert.alert('Sin número de Yape', 'El usuario aún no ha configurado su número de Yape/Plin.');
      return;
    }
    await Clipboard.setStringAsync(yapeNum);
    Toast.show({
      type: 'success',
      text1: 'Yape / Plin copiado',
      text2: `Número ${yapeNum} copiado al portapapeles 📲`,
      visibilityTime: 2500,
    });
  }, [otherUserData]);

  // ══════ #12: WhatsApp directo ══════
  const handleOpenWhatsApp = useCallback(() => {
    const phone = otherUserData?.phone || otherUserData?.phone_number;
    if (!phone) {
      Alert.alert('Sin número', 'No hay número de WhatsApp registrado.');
      return;
    }
    const cleanPhone = phone.replace(/[^\d]/g, '');
    const fullPhone = cleanPhone.startsWith('51') ? cleanPhone : `51${cleanPhone}`;
    const url = `https://wa.me/${fullPhone}?text=Hola,%20te%20contacto%20desde%20Maestro%20a%20Domicilio`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'No se pudo abrir WhatsApp.'));
  }, [otherUserData]);

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

  // ── Loading state ──────────────────────────
  if (loading && id && user) {
    return (
      <View style={[styles.fill, { backgroundColor: chatColors.chatBg }]}>
        <StatusBar barStyle="light-content" backgroundColor={chatColors.headerBg} translucent />
        <View style={[styles.fakeHeader, { backgroundColor: chatColors.headerBg, paddingTop: insets.top }]} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: chatColors.mutedText }]}>
            Cargando mensajes…
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 16 }}><Text style={{ color: colors.primary }}>Volver</Text></TouchableOpacity>
        </View>
      </View>
    );
  }

  // ══════ GUARD: id inválido (#9) ══════
  if (!id || !user || chatError) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: isDark ? '#0B141A' : '#ECE5DD' }]}>
        <Ionicons name="alert-circle-outline" size={60} color={isDark ? '#8696A0' : '#999'} />
        <Text style={[styles.errorTitle, { color: isDark ? '#E9EDEF' : '#111B21' }]}>
          {chatError ? 'No se pudo abrir el chat' : 'Chat no encontrado'}
        </Text>
        <Text style={[styles.errorSubtitle, { color: isDark ? '#8696A0' : '#667781' }]}>
          {chatError || 'El enlace es inválido o la conversación fue eliminada.'}
        </Text>
        <TouchableOpacity
          style={[styles.errorBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={styles.errorBtnText}>Volver</Text>
        </TouchableOpacity>
        {chatError ? <TouchableOpacity style={{ padding: 16 }} onPress={() => setRetryAttempt((value) => value + 1)}><Text style={{ color: colors.primary }}>Volver a intentar</Text></TouchableOpacity> : null}
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: chatColors.chatBg }]}>
      <StatusBar barStyle="light-content" backgroundColor={chatColors.headerBg} translucent />

      {/* ═══════════ HEADER ═══════════ */}
      <View style={[styles.header, { backgroundColor: chatColors.headerBg, paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 0) }]}>
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

        {/* Acceso Rápido: Yape / Plin */}
        {(otherUserData?.yape_number || otherUserData?.phone) && (
          <TouchableOpacity
            onPress={handleCopyYape}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Copiar número de Yape/Plin"
            style={[styles.headerQuickAction, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
          >
            <Ionicons name="cash" size={18} color="#fff" />
            <Text style={styles.headerQuickText}>Yape</Text>
          </TouchableOpacity>
        )}

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
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 45 : 0}
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
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            onScrollBeginDrag={Keyboard.dismiss}
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

        {/* ═══════════ INPUT BAR (ESTILO WHATSAPP) ═══════════ */}
        {!chatClosed ? (
          <Animated.View style={[
            styles.toolbar, 
            { 
              paddingBottom: keyboardVisible ? (Platform.OS === 'android' ? 8 : 4) : Math.max(insets.bottom, 8), 
            }
          ]}>
            {/* Cápsula flotante con adjunto + input + cámara */}
            <View style={[styles.inputCapsule, { backgroundColor: chatColors.inputBg }]}>
              <Pressable
                onPress={() => setAttachMenuVisible(true)}
                style={({ pressed }) => [styles.capsuleIconBtn, pressed && { opacity: 0.6 }]}
                accessibilityLabel="Adjuntar archivo"
                accessibilityRole="button"
              >
                <Ionicons name="attach" size={24} color={chatColors.mutedText} style={{ transform: [{ rotate: '-45deg' }] }} />
              </Pressable>

              <TextInput
                ref={inputRef}
                style={[styles.textInput, { color: chatColors.inputText }]}
                placeholder="Mensaje"
                placeholderTextColor={chatColors.mutedText}
                value={inputText}
                onChangeText={handleTextChange}
                onFocus={() => {
                  setTimeout(() => {
                    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
                  }, 120);
                }}
                multiline
                maxLength={2000}
                blurOnSubmit={false}
                accessibilityLabel="Campo de mensaje"
              />

              <Pressable
                onPress={() => pickImage(true)}
                style={({ pressed }) => [styles.capsuleIconBtn, pressed && { opacity: 0.6 }]}
                accessibilityLabel="Tomar foto con cámara"
              >
                <Ionicons name="camera" size={22} color={chatColors.mutedText} />
              </Pressable>
            </View>

            {/* Botón flotante circular de enviar */}
            <Pressable
              onPress={sendMessage}
              disabled={sending || !inputText.trim()}
              style={({ pressed }) => [
                styles.sendBtn,
                { backgroundColor: isDark ? '#00A884' : '#008069' },
                (!inputText.trim() || sending) && styles.sendBtnDisabled,
                pressed && { opacity: 0.8 },
              ]}
              accessibilityLabel="Enviar mensaje"
              accessibilityRole="button"
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="send" size={19} color="#fff" style={{ marginLeft: 2 }} />
              )}
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View style={[
            styles.closedToolbar, 
            { 
              backgroundColor: isDark ? '#1F2C34' : '#E1F0DA', 
              paddingBottom: Math.max(insets.bottom, 12),
            }
          ]}>
            <Ionicons name="lock-closed-outline" size={16} color={chatColors.mutedText} />
            <Text style={[styles.closedToolbarText, { color: chatColors.mutedText }]}>
              No puedes enviar mensajes en este chat
            </Text>
          </Animated.View>
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
                width: Dimensions.get('window').width,
                height: Dimensions.get('window').height * 0.8,
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

            {/* Botones de acción rápida */}
            <View style={styles.profileCardActionRow}>
              {(otherUserData?.yape_number || otherUserData?.phone || otherUserData?.phone_number) && (
                <TouchableOpacity
                  style={[styles.profileCardSecondaryBtn, { backgroundColor: '#742284' }]}
                  onPress={handleCopyYape}
                >
                  <Ionicons name="cash" size={18} color="#fff" />
                  <Text style={styles.profileCardBtnText}>Yape / Plin</Text>
                </TouchableOpacity>
              )}

              {(otherUserData?.phone || otherUserData?.phone_number) && (
                <TouchableOpacity
                  style={[styles.profileCardSecondaryBtn, { backgroundColor: '#25D366' }]}
                  onPress={handleOpenWhatsApp}
                >
                  <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                  <Text style={styles.profileCardBtnText}>WhatsApp</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[styles.profileCardCallBtn, { backgroundColor: colors.primary }]}
              onPress={() => { setShowProfileCard(false); handleCall(); }}
            >
              <Ionicons name="call" size={20} color="#fff" />
              <Text style={styles.profileCardCallText}>Llamar por Teléfono</Text>
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
    gap: 8,
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
  headerQuickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  headerQuickText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  headerAction: {
    width: 38, height: 38, borderRadius: 19,
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

  // ── Toolbar Estilo WhatsApp ─────────────
  toolbar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 6,
    backgroundColor: 'transparent',
  },
  inputCapsule: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 25,
    paddingHorizontal: 6,
    paddingVertical: Platform.OS === 'ios' ? 6 : 2,
    minHeight: 48,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  capsuleIconBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    maxHeight: 120,
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  sendBtnDisabled: { opacity: 0.5 },
  closedToolbar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    marginHorizontal: 12,
    borderRadius: 16,
    gap: 8,
    elevation: 1,
  },
  closedToolbarText: { fontSize: 14, fontWeight: '500' },

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
  profileCardActionRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginBottom: 10,
  },
  profileCardSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    gap: 6,
    elevation: 2,
  },
  profileCardBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
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
