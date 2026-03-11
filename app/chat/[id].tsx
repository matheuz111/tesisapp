/**
 * app/chat/[id].tsx
 * Chat en tiempo real — Cliente ↔ Proveedor
 * Expo SDK 50+ | Firebase v10 | TypeScript estricto
 *
 * FIXES en esta versión:
 *  ✅ Sin borde azul en imágenes (burbuja imagen = contenedor transparente)
 *  ✅ Sin bloque azul al cerrar teclado en Android
 *     → La vista raíz es CHAT_BG, el color primario SOLO vive en el header
 *  ✅ Header completo visible (nombre no cortado)
 *  ✅ Burbuja vacía eliminada (imagen y texto son ramas separadas)
 */

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
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
import { auth, db } from '../../src/config/firebase';
import { useTheme } from '../../src/context/ThemeContext';

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
}

interface JobDetails {
  clientId: string;
  providerId?: string;
  clientName?: string;
  providerName?: string;
  serviceType?: string;
}

// ─────────────────────────────────────────────
// DISEÑO
// ─────────────────────────────────────────────
const CHAT_BG = '#ECE5DD';
const BUBBLE_IN = '#FFFFFF';
const BUBBLE_IN_TEXT = '#111827';
const TS_OUT = 'rgba(255,255,255,0.75)';
const TS_IN = 'rgba(0,0,0,0.45)';
const TOOLBAR_BG = '#F0F0F0';

function formatTime(ts: Timestamp | null): string {
  if (!ts) return '···';
  return new Date(ts.seconds * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = auth.currentUser;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null);

  const inputRef = useRef<TextInput>(null);

  // ── Cargar detalles ───────────────────────
  useEffect(() => {
    if (!id || !user) return;
    getDoc(doc(db, 'service_requests', id)).then((snap) => {
      if (snap.exists()) setJobDetails(snap.data() as JobDetails);
    });
  }, [id]);

  // ── Escuchar mensajes (DESC + inverted) ───
  useEffect(() => {
    if (!id || !user) return;
    const q = query(
      collection(db, 'service_requests', id, 'messages'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Message, 'id'>) })));
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  // ── Enviar texto ──────────────────────────
  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !user || !id) return;
    setInputText('');
    inputRef.current?.focus();
    try {
      await addDoc(collection(db, 'service_requests', id, 'messages'), {
        text,
        senderId: user.uid,
        createdAt: serverTimestamp(),
        type: 'text' as MessageType,
      });
    } catch {
      Alert.alert('Error', 'No se pudo enviar el mensaje.');
      setInputText(text);
    }
  }, [inputText, user, id]);

  // ── Enviar imagen ─────────────────────────
  const sendImage = useCallback(async (useCamera: boolean) => {
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
    setSending(true);
    try {
      await addDoc(collection(db, 'service_requests', id!, 'messages'), {
        mediaUrl: `data:image/jpeg;base64,${result.assets[0].base64}`,
        senderId: user!.uid,
        createdAt: serverTimestamp(),
        type: 'image' as MessageType,
      });
    } catch {
      Alert.alert('Error', 'La imagen es demasiado grande o hubo un fallo de red.');
    } finally {
      setSending(false);
    }
  }, [id, user]);

  const showAttach = useCallback(() => {
    Alert.alert('Adjuntar imagen', 'Selecciona una opción', [
      { text: 'Cámara 📷', onPress: () => sendImage(true) },
      { text: 'Galería 🖼', onPress: () => sendImage(false) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }, [sendImage]);

  // ── Render burbuja ────────────────────────
  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isMe = item.senderId === user?.uid;
    const isImage = item.type === 'image' && !!item.mediaUrl;

    if (isImage) {
      // ── Burbuja IMAGEN ──
      // Contenedor transparente → sin ningún color de fondo que "bordee" la imagen
      return (
        <View style={[styles.msgWrapper, isMe ? styles.wrapperMe : styles.wrapperOther]}>
          <View style={[styles.imageBubble, isMe ? styles.bubbleMeRadius : styles.bubbleOtherRadius]}>
            <Image source={{ uri: item.mediaUrl }} style={styles.chatImage} resizeMode="cover" />
            {/* Timestamp flotante sobre la imagen */}
            <View style={styles.imageTimeRow}>
              <Text style={styles.imageTimeText}>
                {formatTime(item.createdAt)}{isMe ? ' ✓✓' : ''}
              </Text>
            </View>
          </View>
        </View>
      );
    }

    // ── Burbuja TEXTO ──
    return (
      <View style={[styles.msgWrapper, isMe ? styles.wrapperMe : styles.wrapperOther]}>
        <View style={[
          styles.textBubble,
          isMe
            ? [styles.bubbleMeRadius, { backgroundColor: colors.primary }]
            : [styles.bubbleOtherRadius, { backgroundColor: BUBBLE_IN }],
        ]}>
          <Text style={[styles.msgText, { color: isMe ? '#fff' : BUBBLE_IN_TEXT }]}>
            {item.text}
          </Text>
          <Text style={[styles.msgTime, { color: isMe ? TS_OUT : TS_IN }]}>
            {formatTime(item.createdAt)}{isMe ? ' ✓✓' : ''}
          </Text>
        </View>
      </View>
    );
  }, [user, colors.primary]);

  // ── Datos derivados ───────────────────────
  const otherName = jobDetails
    ? (user?.uid === jobDetails.clientId ? jobDetails.providerName : jobDetails.clientName) ?? 'Usuario'
    : 'Cargando…';
  const serviceLabel = jobDetails?.serviceType
    ? `Servicio: ${jobDetails.serviceType}`
    : `ID #${id?.substring(0, 8)}`;

  // ── Offset teclado ────────────────────────
  // Android: behavior='height' no necesita offset
  // iOS: necesita insets.top + altura del contenido del header (56)
  const KAV_OFFSET = Platform.OS === 'ios' ? insets.top + 56 : 0;

  if (loading) {
    return (
      <View style={[styles.fill, { backgroundColor: CHAT_BG }]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.primary} translucent />
        <View style={[styles.fakeHeader, { backgroundColor: colors.primary, paddingTop: insets.top }]} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando mensajes…</Text>
        </View>
      </View>
    );
  }

  return (
    /**
     * FIX BLOQUE AZUL EN ANDROID:
     * La vista raíz tiene backgroundColor = CHAT_BG (beige).
     * El color primario SOLO existe en el View del header.
     * Así, cuando el KAV se contrae al cerrar el teclado,
     * el fondo visible es siempre CHAT_BG, nunca el color primario.
     */
    <View style={[styles.fill, { backgroundColor: CHAT_BG }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} translucent />

      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.avatar}>
          <Ionicons name="person" size={20} color={colors.primary} />
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{otherName}</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{serviceLabel}</Text>
        </View>

        <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* CUERPO + TECLADO */}
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={KAV_OFFSET}
      >
        <FlatList<Message>
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>Sé el primero en escribir 👋</Text>
            </View>
          }
        />

        {/* INPUT BAR */}
        <View style={[styles.toolbar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <Pressable
            onPress={showAttach}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="attach" size={24} color="#666" style={{ transform: [{ rotate: '45deg' }] }} />
          </Pressable>

          <TextInput
            ref={inputRef}
            style={styles.textInput}
            placeholder="Mensaje"
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
            blurOnSubmit={false}
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
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="send" size={18} color="#fff" style={{ marginLeft: 2 }} />
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─────────────────────────────────────────────
// ESTILOS
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#666', fontSize: 14 },

  // Usado solo en loading para dar color a la status bar area
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
  },
  headerInfo: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.82)', fontSize: 12, marginTop: 1 },

  // ── Lista ────────────────────────────────
  listContent: { paddingHorizontal: 12, paddingVertical: 10 },
  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#999', fontSize: 14 },

  // ── Burbujas comunes ─────────────────────
  msgWrapper: { marginBottom: 4, maxWidth: '78%' },
  wrapperMe: { alignSelf: 'flex-end' },
  wrapperOther: { alignSelf: 'flex-start' },
  bubbleMeRadius: { borderRadius: 18, borderBottomRightRadius: 4 },
  bubbleOtherRadius: { borderRadius: 18, borderBottomLeftRadius: 4 },

  // Burbuja de TEXTO
  textBubble: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  msgText: { fontSize: 15.5, lineHeight: 21 },
  msgTime: { fontSize: 10.5, alignSelf: 'flex-end', marginTop: 4 },

  // Burbuja de IMAGEN
  // Sin backgroundColor → sin borde de color alrededor
  imageBubble: {
    overflow: 'hidden',   // la imagen respeta el borderRadius
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  chatImage: { width: 220, height: 220 },
  // Timestamp flotante sobre la imagen con fondo semitransparente
  imageTimeRow: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    left: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.30)',
    alignItems: 'flex-end',
  },
  imageTimeText: { color: '#fff', fontSize: 10.5 },

  // ── Toolbar ──────────────────────────────
  toolbar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 8,
    backgroundColor: TOOLBAR_BG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D0D0D0',
  },
  iconBtn: { padding: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  textInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15.5,
    maxHeight: 110,
    marginHorizontal: 6,
    color: '#111',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D0D0D0',
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
});