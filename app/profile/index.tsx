import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { auth, db } from '../../src/config/firebase';
import { useSession, type SessionProfile } from '../../src/context/SessionContext';
import { useTheme } from '../../src/context/ThemeContext';
import { NotificationSettings } from '../../src/components/NotificationSettings';
import { LocationSharingSettings } from '../../src/components/ServiceLocationSharing';
import { OperationTimeoutError, withTimeout } from '../../src/services/async';
import { signOutWithNotifications } from '../../utils/pushNotifications';

export default function UserProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, authLoading, loading, error, fromCache, retry } = useSession();
  const { theme, toggleTheme, colors } = useTheme();
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const confirming = useRef(false);
  const accountProfile = user && profile?.uid === user.uid ? profile : null;
  useEffect(() => { if (!authLoading && !user) router.replace('/auth/login'); }, [user, authLoading, router]);

  const handleLogout = () => {
    if (closingRef.current || confirming.current) return;
    confirming.current = true;
    Alert.alert('Cerrar sesión', '¿Quieres salir de esta cuenta?', [
      { text: 'Cancelar', style: 'cancel', onPress: () => { confirming.current = false; } },
      { text: 'Cerrar sesión', style: 'destructive', onPress: async () => {
        confirming.current = false;
        if (closingRef.current) return;
        closingRef.current = true; setClosing(true);
        try { await signOutWithNotifications(); router.replace('/auth/login'); }
        catch { closingRef.current = false; setClosing(false); Alert.alert('No se pudo cerrar sesión', 'Vuelve a intentarlo.'); }
      } },
    ], { cancelable: true, onDismiss: () => { confirming.current = false; } });
  };

  return <View style={[styles.container, { backgroundColor: colors.background }]}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
      {(loading || authLoading || error || fromCache) && <View style={{ padding: 20, gap: 12 }}>
        {(loading || authLoading) && <ActivityIndicator color={colors.primary} />}
        <Text style={{ color: colors.subtext, lineHeight: 21 }}>{error || (accountProfile ? 'Mostrando los datos guardados mientras se conecta.' : 'Cargando tu perfil… Puedes cerrar sesión sin esperar.')}</Text>
        {error && <TouchableOpacity onPress={retry} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primary, fontWeight: '700' }}>Reintentar carga del perfil</Text></TouchableOpacity>}
      </View>}
      {accountProfile && <EditableProfile key={accountProfile.uid} profile={accountProfile} email={user?.email || ''} />}
      <View style={{ paddingHorizontal: 20 }}>
        <View style={[styles.optionRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.labelNoMargin, { color: colors.text }]}>Modo oscuro</Text>
          <Switch value={theme === 'dark'} onValueChange={toggleTheme} trackColor={{ false: '#767577', true: colors.primary }} />
        </View>
        {user && <><NotificationSettings key={user.uid} /><LocationSharingSettings /></>}
        <TouchableOpacity style={[styles.optionRow, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push('/profile/help')}>
          <Text style={[styles.labelNoMargin, { color: colors.text }]}>Ayuda y soporte</Text><Ionicons name="chevron-forward" size={20} color={colors.subtext} />
        </TouchableOpacity>
      </View>
    </ScrollView>
    <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12), borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
      <TouchableOpacity accessibilityRole="button" onPress={handleLogout} disabled={closing} style={[styles.logoutButton, { borderColor: colors.danger, marginTop: 0, marginBottom: 0, minHeight: 50 }]}>
        {closing ? <ActivityIndicator color={colors.danger} /> : <Ionicons name="log-out-outline" size={20} color={colors.danger} />}
        <Text style={{ color: colors.danger, fontWeight: 'bold', marginLeft: 8 }}>{closing ? 'CERRANDO SESIÓN…' : 'CERRAR SESIÓN'}</Text>
      </TouchableOpacity>
    </View>
  </View>;
}

function EditableProfile({ profile, email }: { profile: SessionProfile; email: string }) {
  const { colors, theme } = useTheme();
  const [form, setForm] = useState(() => ({
    fullName: profile.full_name || profile.name || '',
    phoneNumber: profile.phone || profile.phone_number || '',
    district: profile.district || 'Lima Metropolitana',
    yapeNumber: profile.yape_number || profile.phone || '',
  }));
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const mutation = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const isCurrent = () => mounted.current && auth.currentUser?.uid === profile.uid;
  const fields = [
    { key: 'fullName', label: 'Nombre completo', icon: 'person-outline', placeholder: 'Ej: Juan Pérez' },
    { key: 'phoneNumber', label: 'Teléfono', icon: 'call-outline', placeholder: 'Ej: 999 999 999' },
    { key: 'district', label: 'Distrito (Lima / Callao)', icon: 'location-outline', placeholder: 'Ej: Comas, Los Olivos…' },
    { key: 'yapeNumber', label: 'Número para Yape / Plin', icon: 'cash-outline', placeholder: 'Ej: 999 999 999' },
  ] as const;
  const roleLabel = profile.role === 'CLIENT' ? 'CLIENTE' : profile.role === 'PROVIDER' ? 'TRABAJADOR' : profile.role === 'ADMIN' ? 'ADMINISTRACIÓN' : 'OPERADOR';

  const save = async (data: Record<string, string>, isPhoto = false) => {
    if (!isCurrent() || mutation.current) return;
    mutation.current = true;
    if (isPhoto) setUploadingPhoto(true); else setSaving(true);
    try {
      await withTimeout(updateDoc(doc(db, 'users', profile.uid), data), 8000);
      if (isCurrent()) Toast.show({ type: 'success', text1: isPhoto ? 'Foto actualizada' : 'Perfil guardado' });
    } catch (error) {
      if (isCurrent()) Toast.show({ type: 'error', text1: error instanceof OperationTimeoutError ? 'Sin confirmación del servidor' : 'No se pudo guardar', text2: error instanceof OperationTimeoutError ? 'El cambio puede sincronizarse al volver la conexión. Conservamos tus datos en pantalla.' : 'Tus datos siguen en pantalla. Revisa la conexión y vuelve a intentarlo.' });
    } finally {
      mutation.current = false;
      if (isCurrent()) { setSaving(false); setUploadingPhoto(false); }
    }
  };
  const pick = async (camera: boolean) => {
    if (!isCurrent() || mutation.current) return;
    try {
      const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { Alert.alert('Permiso necesario', 'Permite el acceso para cambiar tu foto.'); return; }
      if (!isCurrent()) return;
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.3, base64: true, allowsEditing: true, aspect: [1, 1] };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      const base64 = !result.canceled && result.assets?.[0]?.base64;
      if (base64 && isCurrent()) await save({ profile_photo: 'data:image/jpeg;base64,' + base64 }, true);
    } catch { if (isCurrent()) Alert.alert('No se pudo abrir la foto', 'Vuelve a intentarlo.'); }
  };
  const choosePhoto = () => Alert.alert('Foto de perfil', 'Elige una opción', [
    { text: 'Cámara', onPress: () => { void pick(true); } },
    { text: 'Galería', onPress: () => { void pick(false); } },
    { text: 'Cancelar', style: 'cancel' },
  ]);

  return <>
    <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: 28, paddingBottom: 28 }]}>
      <TouchableOpacity onPress={choosePhoto} style={styles.avatarTouchable} disabled={uploadingPhoto || saving}>
        {profile.profile_photo ? <Image source={{ uri: profile.profile_photo }} style={styles.avatarImage} /> : <View style={styles.avatarPlaceholder}><Ionicons name="person" size={50} color="#fff" /></View>}
        <View style={[styles.cameraOverlay, { backgroundColor: colors.primary }]}>{uploadingPhoto ? <ActivityIndicator color="#fff" /> : <Ionicons name="camera" size={16} color="#fff" />}</View>
      </TouchableOpacity>
      <Text style={styles.headerName}>{form.fullName || email}</Text>
      <View style={styles.roleBadge}><Text style={[styles.roleText, { color: colors.primary }]}>{roleLabel}</Text></View>
    </View>
    <View style={styles.form}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Datos personales</Text>
      {fields.map((field) => <View key={field.key}>
        <Text style={[styles.label, { color: colors.subtext }]}>{field.label}</Text>
        <View style={[styles.inputContainer, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Ionicons name={field.icon} size={20} color={colors.subtext} style={{ marginRight: 10 }} />
          <TextInput style={[styles.input, { color: colors.text }]} value={form[field.key]} onChangeText={(value) => setForm((current) => ({ ...current, [field.key]: value }))} placeholder={field.placeholder} placeholderTextColor={colors.subtext} keyboardType={field.key === 'phoneNumber' || field.key === 'yapeNumber' ? 'phone-pad' : 'default'} />
        </View>
      </View>)}
      <View style={[styles.phoneNote, { backgroundColor: theme === 'dark' ? '#1a2e2e' : '#E3F2FD' }]}>
        <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
        <Text style={[styles.phoneNoteText, { color: colors.subtext }]}>{profile.is_verified ? 'Cuenta verificada con DNI.' : 'Tus datos facilitan la coordinación del servicio.'}</Text>
      </View>
      <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.success }]} disabled={saving || uploadingPhoto} onPress={() => save({ full_name: form.fullName, name: form.fullName, phone: form.phoneNumber, phone_number: form.phoneNumber, district: form.district, yape_number: form.yapeNumber })}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>GUARDAR CAMBIOS</Text>}
      </TouchableOpacity>
    </View>
  </>;
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
