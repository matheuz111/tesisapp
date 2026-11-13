import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../src/config/firebase';
import { syncUserToGoogleSheet } from '../../src/services/googleSheetsSync';
import {
  BaseElevation,
  BaseRadii,
  BaseTypography,
  BaseButton,
  BaseInput,
  BaseCard,
  BaseTile,
  BaseSystemBanner,
  BaseDistrictPicker,
} from '../../src/components/base';
import { useBaseColors, type BaseColorSet } from '../../src/components/base/useBaseColors';

type Role = 'client' | 'provider';

export default function RegisterScreen() {
  const BaseColors = useBaseColors();
  const styles = useMemo(() => createStyles(BaseColors), [BaseColors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useLocalSearchParams();
  const initialRole = (Array.isArray(role) ? role[0] : role) as Role | undefined;

  const [selectedRole, setSelectedRole] = useState<Role>(initialRole || 'client');
  const [name, setName] = useState('');
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [district, setDistrict] = useState('');
  const [districtZone, setDistrictZone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isProvider = selectedRole === 'provider';

  // Validación estricta de correo
  const isValidEmail = (val: string) => {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val);
  };

  // Validación de teléfono peruano (9 dígitos empezando en 9)
  const isValidPeruvianPhone = (val: string) => {
    return /^9\d{8}$/.test(val);
  };

  // Validación de DNI peruano (8 dígitos numéricos)
  const isValidDNI = (val: string) => {
    return /^\d{8}$/.test(val);
  };

  // Validación de complejidad de contraseña (Mayúsculas, Minúsculas, Números, Símbolos, 8+ caracteres)
  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>_\-+=[\]\\/`~;]/.test(password);
  const isPasswordSecure = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSymbol;

  const handleRegister = async () => {
    const cleanName = name.trim();
    const cleanDni = dni.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim().replace(/\D/g, ''); // Solo números
    const cleanPassword = password.trim();
    const cleanConfirmPassword = confirmPassword.trim();

    // 1. Validación de Nombre
    if (!cleanName) {
      Alert.alert('Nombre Requerido', 'Por favor ingresa tu nombre y apellido.');
      return;
    }
    const nameParts = cleanName.split(/\s+/);
    if (nameParts.length < 2 || cleanName.length < 5) {
      Alert.alert('Nombre Incompleto', 'Por favor ingresa al menos un nombre y un apellido real (ej. Juan Pérez).');
      return;
    }
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(cleanName)) {
      Alert.alert('Nombre Inválido', 'El nombre solo debe contener letras y espacios.');
      return;
    }

    // 2. Validación de DNI
    if (isProvider) {
      if (!cleanDni) {
        Alert.alert('DNI Requerido', 'Como profesional técnico en Lima, el DNI de 8 dígitos es obligatorio para la verificación de identidad.');
        return;
      }
      if (!isValidDNI(cleanDni)) {
        Alert.alert('DNI Inválido', 'El DNI debe contener exactamente 8 dígitos numéricos.');
        return;
      }
    } else {
      if (cleanDni && !isValidDNI(cleanDni)) {
        Alert.alert('DNI Inválido', 'Si ingresas tu DNI, debe contener exactamente 8 dígitos numéricos.');
        return;
      }
    }

    // 3. Validación de Correo
    if (!cleanEmail) {
      Alert.alert('Correo Requerido', 'Por favor ingresa tu correo electrónico.');
      return;
    }
    if (!isValidEmail(cleanEmail)) {
      Alert.alert('Correo Inválido', 'Ingresa un formato de correo válido (ejemplo: nombre@dominio.com).');
      return;
    }

    // 4. Validación de Teléfono
    if (isProvider) {
      if (!cleanPhone) {
        Alert.alert('Teléfono Requerido', 'Como profesional, necesitas registrar tu número de celular para contacto.');
        return;
      }
      if (!isValidPeruvianPhone(cleanPhone)) {
        Alert.alert('Celular Inválido', 'El celular debe tener 9 dígitos y comenzar con 9 (ejemplo: 987654321).');
        return;
      }
    } else {
      if (cleanPhone && !isValidPeruvianPhone(cleanPhone)) {
        Alert.alert('Celular Inválido', 'El número de celular debe tener 9 dígitos y comenzar con 9.');
        return;
      }
    }

    // 5. Validación de Contraseña Segura
    if (!cleanPassword) {
      Alert.alert('Contraseña Requerida', 'Por favor define una contraseña para tu cuenta.');
      return;
    }
    if (!isPasswordSecure) {
      Alert.alert(
        'Contraseña Insegura',
        'Tu contraseña debe contener:\n• Mínimo 8 caracteres\n• Al menos una letra MAYÚSCULA (A-Z)\n• Al menos una letra MINÚSCULA (a-z)\n• Al menos un NÚMERO (0-9)\n• Al menos un SÍMBOLO especial (!@#$%...)'
      );
      return;
    }
    if (cleanPassword !== cleanConfirmPassword) {
      Alert.alert('Contraseñas No Coinciden', 'La contraseña y la confirmación no son iguales. Por favor revísalas.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      const user = userCredential.user;

      const userData: any = {
        uid: user.uid,
        full_name: cleanName,
        name: cleanName,
        email: cleanEmail,
        dni: cleanDni || '',
        phone: cleanPhone || '',
        district: district || 'Lima',
        zone: districtZone || 'LIMA_CENTRO',
        role: selectedRole.toUpperCase(),
        created_at: serverTimestamp(),
        is_verified: !isProvider,
      };

      if (isProvider) {
        userData.specialty = '';
        userData.price_range = '';
        userData.rating = 0;
        userData.total_rating = 0;
        userData.review_count = 0;
        userData.jobs_completed = 0;
        userData.is_active = false;
        userData.approval_status = 'PENDING_REVIEW';
        userData.service_radius_km = 10;
        userData.description = '';
      }

      await setDoc(doc(db, 'users', user.uid), userData);

      // Sincronización automática con Google Sheets en segundo plano
      void syncUserToGoogleSheet(userData);

      Alert.alert(
        '¡Registro Exitoso!',
        `Bienvenido a Maestro a Domicilio, ${cleanName}. Ahora puedes iniciar sesión con tu correo.`,
        [{ text: 'Iniciar Sesión', onPress: () => router.replace('/auth/login') }]
      );
    } catch (error: any) {
      console.error('Error en registro:', error);
      if (error.code === 'auth/email-already-in-use') {
        Alert.alert('Correo ya registrado', 'Ese correo ya tiene una cuenta activa. Intenta iniciar sesión o recuperar tu contraseña.');
      } else if (error.code === 'auth/invalid-email') {
        Alert.alert('Error', 'El formato del correo no es válido.');
      } else if (error.code === 'auth/weak-password') {
        Alert.alert('Contraseña Débil', 'Firebase requiere una contraseña de al menos 6 caracteres.');
      } else if (error.code === 'permission-denied' || error.message?.includes('permission')) {
        Alert.alert('Error de Permisos', 'La cuenta se creó pero falta configurar permisos en Firestore.');
      } else {
        Alert.alert('Error de registro', error.message || 'Error inesperado');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Crear Cuenta</Text>
          <Text style={styles.subtitle}>
            Servicios coordinados con garantía y supervisión centralizada
          </Text>
        </View>

        {/* Role Selector using BaseTiles */}
        <View style={styles.roleContainer}>
          <Text style={styles.sectionLabel}>Tipo de cuenta:</Text>
          <View style={styles.tilesRow}>
            <BaseTile
              title="Cliente"
              subtitle="Contratar servicios"
              icon="home-outline"
              iconColor={BaseColors.accent}
              selected={selectedRole === 'client'}
              onPress={() => setSelectedRole('client')}
              style={{ flex: 1 }}
            />
            <BaseTile
              title="Técnico"
              subtitle="Ofrecer labores"
              icon="construct-outline"
              iconColor={BaseColors.positive}
              selected={selectedRole === 'provider'}
              onPress={() => setSelectedRole('provider')}
              style={{ flex: 1 }}
            />
          </View>
        </View>

        {/* Form Card */}
        <BaseCard variant="elevated" elevation="sm" style={styles.card}>
          <BaseInput
            label="Nombre y Apellidos completos"
            placeholder="Ej: Juan Pérez Morales"
            value={name}
            onChangeText={setName}
            leftIcon="person-outline"
          />

          <BaseInput
            label={isProvider ? 'DNI (8 dígitos - Obligatorio)' : 'DNI (8 dígitos - Opcional)'}
            placeholder="12345678"
            value={dni}
            onChangeText={(t) => setDni(t.replace(/\D/g, '').slice(0, 8))}
            keyboardType="number-pad"
            maxLength={8}
            leftIcon="card-outline"
          />

          <BaseInput
            label="Correo electrónico"
            placeholder="ejemplo@correo.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="mail-outline"
          />

          <BaseInput
            label={isProvider ? 'Celular Perú (9 dígitos - Obligatorio)' : 'Celular (9 dígitos - Opcional)'}
            placeholder="987654321"
            value={phone}
            onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 9))}
            keyboardType="phone-pad"
            maxLength={9}
            leftIcon="call-outline"
          />

          <BaseDistrictPicker
            label="Distrito de Residencia (Lima / Callao)"
            selectedDistrict={district}
            onSelectDistrict={(name, zone) => {
              setDistrict(name);
              if (zone) setDistrictZone(zone);
            }}
            placeholder="Selecciona tu distrito..."
          />

          <BaseInput
            label="Contraseña"
            placeholder="Mayúsculas, minúsculas, números y símbolos"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            leftIcon="lock-closed-outline"
          />

          {/* Password Strength Requirement Indicators */}
          {password.length > 0 && (
            <View style={styles.passwordReqBox}>
              <Text style={styles.passwordReqTitle}>Requisitos de seguridad:</Text>
              <View style={styles.reqGrid}>
                <View style={styles.reqItem}>
                  <Ionicons
                    name={hasMinLength ? 'checkmark-circle' : 'ellipse-outline'}
                    size={13}
                    color={hasMinLength ? BaseColors.positive : BaseColors.gray400}
                  />
                  <Text style={[styles.reqText, hasMinLength && styles.reqTextActive]}>
                    8+ caracteres
                  </Text>
                </View>
                <View style={styles.reqItem}>
                  <Ionicons
                    name={hasUpperCase ? 'checkmark-circle' : 'ellipse-outline'}
                    size={13}
                    color={hasUpperCase ? BaseColors.positive : BaseColors.gray400}
                  />
                  <Text style={[styles.reqText, hasUpperCase && styles.reqTextActive]}>
                    Mayúscula (A-Z)
                  </Text>
                </View>
                <View style={styles.reqItem}>
                  <Ionicons
                    name={hasLowerCase ? 'checkmark-circle' : 'ellipse-outline'}
                    size={13}
                    color={hasLowerCase ? BaseColors.positive : BaseColors.gray400}
                  />
                  <Text style={[styles.reqText, hasLowerCase && styles.reqTextActive]}>
                    Minúscula (a-z)
                  </Text>
                </View>
                <View style={styles.reqItem}>
                  <Ionicons
                    name={hasNumber ? 'checkmark-circle' : 'ellipse-outline'}
                    size={13}
                    color={hasNumber ? BaseColors.positive : BaseColors.gray400}
                  />
                  <Text style={[styles.reqText, hasNumber && styles.reqTextActive]}>
                    Número (0-9)
                  </Text>
                </View>
                <View style={styles.reqItem}>
                  <Ionicons
                    name={hasSymbol ? 'checkmark-circle' : 'ellipse-outline'}
                    size={13}
                    color={hasSymbol ? BaseColors.positive : BaseColors.gray400}
                  />
                  <Text style={[styles.reqText, hasSymbol && styles.reqTextActive]}>
                    Símbolo (!@#$...)
                  </Text>
                </View>
              </View>
            </View>
          )}

          <BaseInput
            label="Confirmar contraseña"
            placeholder="Repite tu contraseña exactamente"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            leftIcon="shield-checkmark-outline"
          />

          {isProvider && (
            <BaseSystemBanner
              variant="positive"
              title="Validación de Identidad Técnica"
              description="Tus datos serán validados por nuestra central de operaciones para asignarte la insignia de Técnico Homologado."
              icon="shield-checkmark"
              style={{ marginBottom: 16 }}
            />
          )}

          <BaseButton
            title={`Registrarme como ${isProvider ? 'Especialista Técnico' : 'Cliente'}`}
            onPress={handleRegister}
            loading={loading}
            disabled={loading}
            variant="solid"
            intent={isProvider ? 'positive' : 'primary'}
            size="lg"
            fullWidth
            icon="checkmark-circle-outline"
          />
        </BaseCard>

        {/* Footer Link */}
        <TouchableOpacity onPress={() => router.back()} style={styles.footerLink}>
          <Text style={styles.linkText}>
            ¿Ya tienes cuenta registrada? <Text style={styles.linkBold}>Inicia sesión aquí</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (BaseColors: BaseColorSet) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BaseColors.gray50,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: BaseTypography.sizes.xl,
    flexShrink: 1,
    fontWeight: BaseTypography.weights.bold,
    color: BaseColors.gray900,
    includeFontPadding: false,
  },
  subtitle: {
    fontSize: BaseTypography.sizes.xs,
    flexShrink: 1,
    color: BaseColors.gray500,
    marginTop: 4,
    textAlign: 'center',
  },
  roleContainer: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: BaseTypography.sizes.xs,
    flexShrink: 1,
    fontWeight: BaseTypography.weights.semiBold,
    color: BaseColors.gray700,
    marginBottom: 8,
  },
  tilesRow: {
    flexDirection: 'row',
    flexShrink: 1,
    gap: 10,
  },
  card: {
    padding: 20,
    marginBottom: 20,
  },
  passwordReqBox: {
    backgroundColor: BaseColors.gray100,
    borderRadius: BaseRadii.md,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BaseColors.gray200,
  },
  passwordReqTitle: {
    fontSize: 11,
    flexShrink: 1,
    fontWeight: BaseTypography.weights.bold,
    color: BaseColors.gray700,
    marginBottom: 6,
  },
  reqGrid: {
    flexDirection: 'row',
    flexShrink: 1,
    flexWrap: 'wrap',
    gap: 8,
  },
  reqItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: '46%',
  },
  reqText: {
    fontSize: 10,
    flexShrink: 1,
    color: BaseColors.gray500,
  },
  reqTextActive: {
    color: BaseColors.positive,
    fontWeight: BaseTypography.weights.semiBold,
  },
  footerLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  linkText: {
    fontSize: BaseTypography.sizes.sm,
    flexShrink: 1,
    color: BaseColors.gray600,
  },
  linkBold: {
    color: BaseColors.accent,
    fontWeight: BaseTypography.weights.bold,
  },
});
