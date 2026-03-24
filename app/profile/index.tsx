import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { auth, db } from '../../src/config/firebase';
import { useTheme } from '../../src/context/ThemeContext';

export default function UserProfile() {
  const router = useRouter();
  const user = auth.currentUser;
  const { theme, toggleTheme, colors } = useTheme();
  const isDark = theme === 'dark';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFullName(data.full_name || data.name || '');
        // Leer phone de ambos campos para compatibilidad
        setPhoneNumber(data.phone || data.phone_number || '');
        setRole(data.role || 'USUARIO');
        setProfilePhoto(data.profile_photo || null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        full_name: fullName,
        name: fullName,
        phone: phoneNumber,
        phone_number: phoneNumber,
      });
      Toast.show({ type: 'success', text1: '¡Guardado!', text2: 'Perfil actualizado.' });
    } catch {
      Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo guardar.' });
    } finally {
      setSaving(false);
    }
  };

  const pickProfilePhoto = async () => {
    Alert.alert('Foto de perfil', '¿De dónde quieres cargar tu foto?', [
      {
        text: 'Cámara',
        onPress: async () => {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('Permiso denegado', 'Necesitas permitir el acceso a la cámara.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.3,
            base64: true,
            allowsEditing: true,
            aspect: [1, 1],
          });
          if (!result.canceled && result.assets?.length) {
            savePhoto(result.assets[0].base64!);
          }
        },
      },
      {
        text: 'Galería',
        onPress: async () => {
          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('Permiso denegado', 'Necesitas permitir el acceso a la galería.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.3,
            base64: true,
            allowsEditing: true,
            aspect: [1, 1],
          });
          if (!result.canceled && result.assets?.length) {
            savePhoto(result.assets[0].base64!);
          }
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const savePhoto = async (base64: string) => {
    if (!user) return;
    setUploadingPhoto(true);
    try {
      const photoUri = `data:image/jpeg;base64,${base64}`;
      await updateDoc(doc(db, 'users', user.uid), { profile_photo: photoUri });
      setProfilePhoto(photoUri);
      Toast.show({ type: 'success', text1: '¡Foto actualizada!', text2: 'Tu foto de perfil se ha guardado.' });
    } catch {
      Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo guardar la foto.' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          await auth.signOut();
          router.replace('/');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ═══ HEADER CON FOTO ═══ */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity
          onPress={pickProfilePhoto}
          style={styles.avatarTouchable}
          activeOpacity={0.8}
          disabled={uploadingPhoto}
        >
          {profilePhoto ? (
            <Image source={{ uri: profilePhoto }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={50} color="#fff" />
            </View>
          )}
          <View style={[styles.cameraOverlay, { backgroundColor: colors.primary }]}>
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="camera" size={16} color="#fff" />
            )}
          </View>
        </TouchableOpacity>

        <Text style={styles.headerName}>{fullName || user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={[styles.roleText, { color: colors.primary }]}>
            {role === 'CLIENT' ? 'CLIENTE' : 'PROFESIONAL'}
          </Text>
        </View>
      </View>

      <View style={styles.form}>
        {/* ═══ DARK MODE ═══ */}
        <View style={[styles.optionRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="moon" size={22} color={colors.text} style={{ marginRight: 10 }} />
            <Text style={[styles.labelNoMargin, { color: colors.text }]}>Modo Oscuro</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: '#767577', true: colors.primary }}
            thumbColor={isDark ? '#fff' : '#f4f3f4'}
          />
        </View>

        {/* ═══ AYUDA ═══ */}
        <TouchableOpacity
          style={[styles.optionRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push('/profile/help')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="help-circle-outline" size={22} color={colors.text} style={{ marginRight: 10 }} />
            <Text style={[styles.labelNoMargin, { color: colors.text }]}>Ayuda y Soporte</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
        </TouchableOpacity>

        {/* ═══ FORMULARIO ═══ */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Datos Personales</Text>

        <Text style={[styles.label, { color: colors.subtext }]}>Nombre Completo</Text>
        <View style={[styles.inputContainer, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Ionicons name="person-outline" size={20} color={colors.subtext} style={{ marginRight: 10 }} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Ej: Juan Pérez"
            placeholderTextColor={colors.subtext}
          />
        </View>

        <Text style={[styles.label, { color: colors.subtext }]}>Teléfono</Text>
        <View style={[styles.inputContainer, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Ionicons name="call-outline" size={20} color={colors.subtext} style={{ marginRight: 10 }} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="Ej: 999 999 999"
            placeholderTextColor={colors.subtext}
            keyboardType="phone-pad"
          />
        </View>

        <View style={[styles.phoneNote, { backgroundColor: isDark ? '#1a2e2e' : '#E3F2FD' }]}>
          <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
          <Text style={[styles.phoneNoteText, { color: colors.subtext }]}>
            Este número se usa para que clientes o técnicos puedan llamarte desde el chat.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.success }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveText}>GUARDAR CAMBIOS</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleLogout} style={[styles.logoutButton, { borderColor: colors.danger }]}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} style={{ marginRight: 8 }} />
          <Text style={{ color: colors.danger, fontWeight: 'bold' }}>CERRAR SESIÓN</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ── Header ──────────────────────────
  header: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingTop: 60,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  avatarTouchable: { position: 'relative', marginBottom: 12 },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  headerName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  roleBadge: {
    marginTop: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 20,
  },
  roleText: { fontWeight: 'bold', fontSize: 12 },

  // ── Form ────────────────────────────
  form: { padding: 20, marginTop: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 16, marginTop: 8 },
  label: { fontSize: 13, marginBottom: 5, marginLeft: 4, fontWeight: '600' },
  labelNoMargin: { fontSize: 16, fontWeight: 'bold' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 50,
    marginBottom: 16,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 16 },

  phoneNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    gap: 8,
  },
  phoneNoteText: { flex: 1, fontSize: 12, lineHeight: 18 },

  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  saveButton: {
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    elevation: 2,
  },
  saveText: { color: '#fff', fontWeight: 'bold', fontSize: 15, letterSpacing: 0.5 },
  logoutButton: {
    marginTop: 20,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 40,
  },
});