import { Ionicons } from '@expo/vector-icons';
import { useTabBarClearance } from '../../../src/components/navigation/FloatingTabBar';
import { resetToLogin } from '../../../src/navigation/resetStack';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import React, { useMemo, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { auth, db } from '../../../src/config/firebase';
import { syncUserToGoogleSheet } from '../../../src/services/googleSheetsSync';
import { useSession, type SessionProfile } from '../../../src/context/SessionContext';
import { useTheme } from '../../../src/context/ThemeContext';
import { NotificationSettings } from '../../../src/components/NotificationSettings';
import { LocationSharingSettings } from '../../../src/components/ServiceLocationSharing';
import { OperationTimeoutError, withTimeout } from '../../../src/services/async';
import { signOutWithNotifications } from '../../../utils/pushNotifications';
import {
  BaseElevation,
  BaseRadii,
  BaseTypography,
  BaseHeader,
  BaseCard,
  BaseInput,
  BaseButton,
  BaseTag,
  BaseDistrictPicker,
} from '../../../src/components/base';
import { useBaseColors, type BaseColorSet } from '../../../src/components/base/useBaseColors';

export default function UserProfile() {
  const BaseColors = useBaseColors();
  const styles = useMemo(() => createStyles(BaseColors), [BaseColors]);
  const router = useRouter();
  const tabBarClearance = useTabBarClearance();
  const { user, profile, authLoading, loading, error, fromCache, retry } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const confirming = useRef(false);
  const accountProfile = user && profile?.uid === user.uid ? profile : null;

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth/login');
  }, [user, authLoading, router]);

  const handleLogout = () => {
    if (closingRef.current || confirming.current) return;
    confirming.current = true;
    Alert.alert(
      'Cerrar sesión',
      '¿Quieres salir de esta cuenta en este dispositivo?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: () => {
            confirming.current = false;
          },
        },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            confirming.current = false;
            if (closingRef.current) return;
            closingRef.current = true;
            setClosing(true);
            try {
              await signOutWithNotifications();
              resetToLogin(router);
            } catch {
              closingRef.current = false;
              setClosing(false);
              Alert.alert('No se pudo cerrar sesión', 'Vuelve a intentarlo.');
            }
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          confirming.current = false;
        },
      }
    );
  };

  return (
    <View style={styles.container}>
      <BaseHeader
        title="Mi Perfil"
        subtitle="Configuración de cuenta y preferencias"
        showBack
        onBack={() => router.back()}
      />

      <ScrollView
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarClearance + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {(loading || authLoading || error || fromCache) && (
          <View style={styles.statusBox}>
            {(loading || authLoading) && <ActivityIndicator color={BaseColors.accent} />}
            <Text style={styles.statusText} numberOfLines={2}>
              {error ||
                (accountProfile
                  ? 'Mostrando datos locales mientras se conecta al servidor.'
                  : 'Cargando tu perfil… Puedes cerrar sesión sin esperar.')}
            </Text>
            {error && (
              <TouchableOpacity onPress={retry} style={styles.retryBtn}>
                <Text style={styles.retryText}>Reintentar carga del perfil</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {accountProfile && (
          <EditableProfile
            key={accountProfile.uid}
            profile={accountProfile}
            email={user?.email || ''}
          />
        )}

        {/* Preferencias de la aplicación */}
        <BaseCard variant="elevated" elevation="sm" style={styles.preferencesCard}>
          <Text style={styles.sectionHeading}>Ajustes y Soporte</Text>

          <View style={styles.optionRow}>
            <View style={styles.optionLeft}>
              <Ionicons
                name={theme === 'dark' ? 'moon' : 'sunny'}
                size={20}
                color={BaseColors.accent}
              />
              <Text style={styles.optionLabel}>Modo oscuro</Text>
            </View>
            <Switch
              value={theme === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ false: BaseColors.gray300, true: BaseColors.accent }}
              thumbColor={BaseColors.white}
            />
          </View>

          {user && (
            <>
              <NotificationSettings key={user.uid} />
              <LocationSharingSettings />
            </>
          )}

          <TouchableOpacity
            style={styles.helpRow}
            onPress={() => router.push('/profile/help')}
          >
            <View style={styles.optionLeft}>
              <Ionicons name="help-circle-outline" size={20} color={BaseColors.gray600} />
              <Text style={styles.optionLabel}>Centro de ayuda y soporte técnico</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={BaseColors.gray400} />
          </TouchableOpacity>
        </BaseCard>

        {/* Botón de Cerrar Sesión */}
        <View style={styles.logoutWrapper}>
          <BaseButton
            title={closing ? 'Cerrando sesión...' : 'Cerrar Sesión'}
            variant="outline"
            intent="negative"
            size="lg"
            fullWidth
            icon="log-out-outline"
            loading={closing}
            disabled={closing}
            onPress={handleLogout}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function EditableProfile({ profile, email }: { profile: SessionProfile; email: string }) {
  const BaseColors = useBaseColors();
  const styles = useMemo(() => createStyles(BaseColors), [BaseColors]);
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

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const isCurrent = () => mounted.current && auth.currentUser?.uid === profile.uid;

  const roleLabel =
    profile.role === 'CLIENT'
      ? 'Cliente Hogar'
      : profile.role === 'PROVIDER'
      ? 'Técnico Especialista'
      : profile.role === 'ADMIN'
      ? 'Administración'
      : 'Operador Central';

  const roleTagVariant =
    profile.role === 'CLIENT'
      ? 'accent'
      : profile.role === 'PROVIDER'
      ? 'positive'
      : 'neutral';

  const save = async (data: Record<string, string>, isPhoto = false) => {
    if (!isCurrent() || mutation.current) return;
    mutation.current = true;
    if (isPhoto) setUploadingPhoto(true);
    else setSaving(true);
    try {
      await withTimeout(updateDoc(doc(db, 'users', profile.uid), data), 8000);
      if (isCurrent()) {
        if (!isPhoto) {
          void syncUserToGoogleSheet({
            uid: profile.uid,
            name: data.full_name || form.fullName,
            email,
            phone: data.phone || form.phoneNumber,
            district: data.district || form.district,
            role: profile.role,
          });
        }
        Toast.show({
          type: 'success',
          text1: isPhoto ? 'Foto actualizada' : 'Perfil guardado',
          text2: 'Tus datos se actualizaron correctamente.',
        });
      }
    } catch (error) {
      if (isCurrent()) {
        Toast.show({
          type: 'error',
          text1:
            error instanceof OperationTimeoutError
              ? 'Sin confirmación del servidor'
              : 'No se pudo guardar',
          text2:
            error instanceof OperationTimeoutError
              ? 'El cambio puede sincronizarse al volver la conexión.'
              : 'Revisa tu conexión y vuelve a intentarlo.',
        });
      }
    } finally {
      mutation.current = false;
      if (isCurrent()) {
        setSaving(false);
        setUploadingPhoto(false);
      }
    }
  };

  const pick = async (camera: boolean) => {
    if (!isCurrent() || mutation.current) return;
    try {
      const permission = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso necesario', 'Permite el acceso a la cámara o galería.');
        return;
      }
      if (!isCurrent()) return;
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        quality: 0.3,
        base64: true,
        allowsEditing: true,
        aspect: [1, 1],
      };
      const result = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      const base64 = !result.canceled && result.assets?.[0]?.base64;
      if (base64 && isCurrent()) {
        await save({ profile_photo: 'data:image/jpeg;base64,' + base64 }, true);
      }
    } catch {
      if (isCurrent()) Alert.alert('No se pudo abrir la foto', 'Vuelve a intentarlo.');
    }
  };

  const choosePhoto = () =>
    Alert.alert('Foto de perfil', 'Elige una opción', [
      { text: 'Cámara', onPress: () => void pick(true) },
      { text: 'Galería', onPress: () => void pick(false) },
      { text: 'Cancelar', style: 'cancel' },
    ]);

  return (
    <>
      {/* Profile Avatar Card */}
      <BaseCard variant="elevated" elevation="sm" style={styles.avatarCard}>
        <TouchableOpacity
          onPress={choosePhoto}
          style={styles.avatarTouchable}
          disabled={uploadingPhoto || saving}
        >
          {profile.profile_photo ? (
            <Image source={{ uri: profile.profile_photo }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={44} color={BaseColors.accent} />
            </View>
          )}
          <View style={styles.cameraOverlay}>
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color={BaseColors.white} />
            ) : (
              <Ionicons name="camera" size={14} color={BaseColors.white} />
            )}
          </View>
        </TouchableOpacity>

        <Text style={styles.profileName} numberOfLines={2}>{form.fullName || email}</Text>
        <Text style={styles.profileEmail}>{email}</Text>

        <View style={styles.tagWrap}>
          <BaseTag label={roleLabel} variant={roleTagVariant as any} size="sm" />
          {profile.is_verified && (
            <BaseTag label="Verificado con DNI" variant="positive" size="sm" icon="shield-checkmark" />
          )}
        </View>
      </BaseCard>

      {/* Editable Fields Card */}
      <BaseCard variant="elevated" elevation="sm" style={styles.formCard}>
        <Text style={styles.sectionHeading}>Datos Personales</Text>

        <BaseInput
          label="Nombre y Apellido"
          placeholder="Ej: Juan Pérez"
          value={form.fullName}
          onChangeText={(val) => setForm((curr) => ({ ...curr, fullName: val }))}
          leftIcon="person-outline"
        />

        <BaseInput
          label="Teléfono Móvil"
          placeholder="Ej: 999 999 999"
          value={form.phoneNumber}
          onChangeText={(val) => setForm((curr) => ({ ...curr, phoneNumber: val }))}
          keyboardType="phone-pad"
          leftIcon="call-outline"
        />

        <BaseDistrictPicker
          label="Distrito de Residencia (Lima / Callao)"
          selectedDistrict={form.district}
          onSelectDistrict={(val) => setForm((curr) => ({ ...curr, district: val }))}
        />

        <BaseInput
          label="Número para Yape / Plin"
          placeholder="Ej: 999 999 999"
          value={form.yapeNumber}
          onChangeText={(val) => setForm((curr) => ({ ...curr, yapeNumber: val }))}
          keyboardType="phone-pad"
          leftIcon="cash-outline"
        />

        <BaseButton
          title={saving ? 'Guardando...' : 'Guardar Cambios'}
          variant="solid"
          intent="primary"
          size="md"
          fullWidth
          loading={saving}
          disabled={saving || uploadingPhoto}
          onPress={() =>
            save({
              full_name: form.fullName,
              name: form.fullName,
              phone: form.phoneNumber,
              phone_number: form.phoneNumber,
              district: form.district,
              yape_number: form.yapeNumber,
            })
          }
          icon="save-outline"
          style={{ marginTop: 8 }}
        />
      </BaseCard>
    </>
  );
}

const createStyles = (BaseColors: BaseColorSet) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BaseColors.gray50,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  statusBox: {
    padding: 14,
    borderRadius: BaseRadii.md,
    backgroundColor: BaseColors.accentLight,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  statusText: {
    fontSize: 12,
    flexShrink: 1,
    color: BaseColors.accentDark,
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 8,
  },
  retryText: {
    fontSize: 12,
    flexShrink: 1,
    fontWeight: BaseTypography.weights.bold,
    color: BaseColors.accent,
  },
  avatarCard: {
    alignItems: 'center',
    padding: 20,
    marginBottom: 16,
  },
  avatarTouchable: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: BaseColors.gray200,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: BaseColors.accentLight,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BaseColors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: BaseColors.white,
  },
  profileName: {
    fontSize: BaseTypography.sizes.lg,
    flexShrink: 1,
    fontWeight: BaseTypography.weights.bold,
    color: BaseColors.gray900,
    includeFontPadding: false,
  },
  profileEmail: {
    fontSize: 12,
    flexShrink: 1,
    color: BaseColors.gray500,
    marginTop: 2,
  },
  tagWrap: {
    flexDirection: 'row',
    flexShrink: 1,
    gap: 8,
    marginTop: 10,
  },
  formCard: {
    padding: 18,
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: BaseTypography.sizes.base,
    flexShrink: 1,
    fontWeight: BaseTypography.weights.bold,
    color: BaseColors.gray900,
    marginBottom: 14,
  },
  preferencesCard: {
    padding: 18,
    marginBottom: 20,
  },
  optionRow: {
    flexDirection: 'row',
    flexShrink: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BaseColors.gray100,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  optionLabel: {
    fontSize: BaseTypography.sizes.sm,
    flexShrink: 1,
    fontWeight: BaseTypography.weights.medium,
    color: BaseColors.gray800,
  },
  helpRow: {
    flexDirection: 'row',
    flexShrink: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: BaseColors.gray100,
    marginTop: 6,
  },
  logoutWrapper: {
    marginBottom: 20,
  },
});
