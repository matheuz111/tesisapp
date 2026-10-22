import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth, db } from '../../src/config/firebase';
import { colors } from '../../src/theme';

export default function RegisterScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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

    // 2. Validación de DNI (opcional para clientes)
    if (cleanDni && !isValidDNI(cleanDni)) {
      Alert.alert('DNI Inválido', 'Si ingresas tu DNI, debe contener exactamente 8 dígitos numéricos.');
      return;
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

    // 4. Validación de Teléfono (opcional para clientes)
    if (cleanPhone && !isValidPeruvianPhone(cleanPhone)) {
      Alert.alert('Celular Inválido', 'El número de celular debe tener 9 dígitos y comenzar con 9.');
      return;
    }

    // 5. Validación de Contraseña Segura (Mayúsculas, Minúsculas, Números, Símbolos, 8+ caracteres)
    if (!cleanPassword) {
      Alert.alert('Contraseña Requerida', 'Por favor define una contraseña para tu cuenta.');
      return;
    }
    if (!isPasswordSecure) {
      Alert.alert(
        'Contraseña Insegura 🔒',
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

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        full_name: cleanName,
        name: cleanName,
        email: cleanEmail,
        dni: cleanDni || '',
        phone: cleanPhone || '',
        role: 'CLIENT',
        created_at: serverTimestamp(),
        is_verified: false,
      });

      // Verificación de correo obligatoria: sin verificar, no se puede iniciar sesión.
      await sendEmailVerification(user);
      await signOut(auth);

      Alert.alert(
        '¡Registro Exitoso! 🎉',
        `Bienvenido a Maestro a Domicilio, ${cleanName}.\n\nTe enviamos un correo de verificación a ${cleanEmail}. Abre el enlace de ese correo para activar tu cuenta y luego inicia sesión. Revisa también tu carpeta de spam.`,
        [{ text: 'Ir a Iniciar Sesión', onPress: () => router.replace('/auth/login') }]
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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Ionicons name="construct" size={30} color={colors.primary} />
          </View>
          <Text style={styles.title}>Crear Cuenta Segura</Text>
          <Text style={styles.subtitle}>Regístrate como cliente. Servicios coordinados y supervisados por nuestra central.</Text>
        </View>

        {/* ═══ FORMULARIO CON VALIDACIONES ═══ */}
        {/* Nombre completo */}
        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Nombre y Apellido completo"
            value={name}
            onChangeText={setName}
            placeholderTextColor="#999"
          />
        </View>

        {/* DNI */}
        <View style={styles.inputContainer}>
          <Ionicons name="card-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="DNI (8 dígitos - Opcional)"
            value={dni}
            onChangeText={(t) => setDni(t.replace(/\D/g, '').slice(0, 8))}
            keyboardType="number-pad"
            maxLength={8}
            placeholderTextColor="#999"
          />
        </View>

        {/* Correo */}
        <View style={styles.inputContainer}>
          <Ionicons name="mail-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#999"
          />
        </View>

        {/* Teléfono celular */}
        <View style={styles.inputContainer}>
          <Ionicons name="call-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Celular (9 dígitos - Opcional)"
            value={phone}
            onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 9))}
            keyboardType="phone-pad"
            maxLength={9}
            placeholderTextColor="#999"
          />
        </View>

        {/* Contraseña */}
        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Contraseña (Mayús, minús, núm, símb)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            placeholderTextColor="#999"
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* REQUISITOS DE CONTRASEÑA EN TIEMPO REAL */}
        {password.length > 0 && (
          <View style={styles.passwordReqBox}>
            <Text style={styles.passwordReqTitle}>Requisitos de contraseña segura:</Text>
            <View style={styles.reqGrid}>
              <View style={styles.reqItem}>
                <Ionicons name={hasMinLength ? "checkmark-circle" : "ellipse-outline"} size={14} color={hasMinLength ? colors.success : "#888"} />
                <Text style={[styles.reqText, hasMinLength && styles.reqTextActive]}>8+ caracteres</Text>
              </View>
              <View style={styles.reqItem}>
                <Ionicons name={hasUpperCase ? "checkmark-circle" : "ellipse-outline"} size={14} color={hasUpperCase ? colors.success : "#888"} />
                <Text style={[styles.reqText, hasUpperCase && styles.reqTextActive]}>Mayúscula (A-Z)</Text>
              </View>
              <View style={styles.reqItem}>
                <Ionicons name={hasLowerCase ? "checkmark-circle" : "ellipse-outline"} size={14} color={hasLowerCase ? colors.success : "#888"} />
                <Text style={[styles.reqText, hasLowerCase && styles.reqTextActive]}>Minúscula (a-z)</Text>
              </View>
              <View style={styles.reqItem}>
                <Ionicons name={hasNumber ? "checkmark-circle" : "ellipse-outline"} size={14} color={hasNumber ? colors.success : "#888"} />
                <Text style={[styles.reqText, hasNumber && styles.reqTextActive]}>Número (0-9)</Text>
              </View>
              <View style={styles.reqItem}>
                <Ionicons name={hasSymbol ? "checkmark-circle" : "ellipse-outline"} size={14} color={hasSymbol ? colors.success : "#888"} />
                <Text style={[styles.reqText, hasSymbol && styles.reqTextActive]}>Símbolo (!@#$...)</Text>
              </View>
            </View>
          </View>
        )}

        {/* Confirmar Contraseña */}
        <View style={styles.inputContainer}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Confirmar contraseña"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            placeholderTextColor="#999"
          />
          <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
            <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.providerNote}>
          <Ionicons name="information-circle" size={18} color={colors.primary} />
          <Text style={styles.providerNoteText}>
            ¿Eres técnico o profesional? Las cuentas de profesionales las crea la <Text style={{ fontWeight: 'bold' }}>central de operaciones</Text> tras validar tu contratación. Comunícate con la empresa para tu alta.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.buttonSuccess, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>REGISTRARME COMO CLIENTE</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.footerLink}>
          <Text style={styles.linkText}>
            ¿Ya tienes cuenta? <Text style={styles.linkBold}>Ingresa aquí</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: 60 },

  header: { alignItems: 'center', marginBottom: 24 },
  logoBadge: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.accent,
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.primary },
  subtitle: { fontSize: 15, color: colors.textMuted, marginTop: 6, textAlign: 'center' },

  // ── Inputs ──────────────────────────
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 14,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: colors.text },

  // ── Requisitos de Contraseña ────────
  passwordReqBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  passwordReqTitle: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 8 },
  reqGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reqItem: { flexDirection: 'row', alignItems: 'center', gap: 4, width: '48%' },
  reqText: { fontSize: 11, color: '#888' },
  reqTextActive: { color: colors.success, fontWeight: '700' },

  // ── Nota profesionales ──────────────
  providerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.accentLight,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  providerNoteText: { flex: 1, fontSize: 12, color: colors.primary, lineHeight: 18 },

  // ── Button ──────────────────────────
  buttonSuccess: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: colors.primary,
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: 'bold', letterSpacing: 0.5 },

  footerLink: { marginTop: 24, alignItems: 'center', paddingBottom: 40 },
  linkText: { color: colors.textMuted, fontSize: 14 },
  linkBold: { color: colors.primary, fontWeight: 'bold' },
});
