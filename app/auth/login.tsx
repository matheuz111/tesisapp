import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
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
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../src/config/firebase';
import { useSession } from '../../src/context/SessionContext';
import {
  BaseColors,
  BaseElevation,
  BaseRadii,
  BaseTypography,
  BaseButton,
  BaseInput,
  BaseCard,
} from '../../src/components/base';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, authLoading } = useSession();
  const submitting = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!authLoading && user && auth.currentUser?.uid === user.uid) router.replace('/');
  }, [user, authLoading, router]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Validación estricta de correo RFC 5322
  const isValidEmail = (val: string) => {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val);
  };

  const handleLogin = async () => {
    if (submitting.current) return;
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;

    setEmailError('');
    setPasswordError('');

    if (!cleanEmail) {
      setEmailError('Ingresa tu correo electrónico');
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setEmailError('Ingresa un formato de correo válido (ej: nombre@dominio.com)');
      return;
    }

    if (!cleanPassword) {
      setPasswordError('Ingresa tu contraseña');
      return;
    }

    if (cleanPassword.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    submitting.current = true;
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      if (mounted.current && auth.currentUser?.uid === userCredential.user.uid) {
        router.replace('/');
      }
    } catch (error: any) {
      console.error('Error en login:', error);
      let msg = 'Ocurrió un error inesperado al iniciar sesión';
      if (
        error.code === 'auth/invalid-credential' ||
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-email'
      ) {
        msg = 'Correo o contraseña incorrectos.';
      } else if (error.code === 'auth/user-disabled') {
        msg = 'Esta cuenta ha sido inhabilitada por seguridad.';
      } else if (error.code === 'auth/too-many-requests') {
        msg = 'Demasiados intentos fallidos. Intenta más tarde.';
      } else if (error.code === 'auth/network-request-failed') {
        msg = 'Error de conexión. Verifica tu acceso a internet.';
      }

      Toast.show({
        type: 'error',
        text1: 'Error de acceso',
        text2: msg,
      });
    } finally {
      submitting.current = false;
      if (mounted.current) setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      Alert.alert(
        'Recuperar Contraseña',
        'Ingresa tu correo en el campo superior para enviarte el enlace de restablecimiento.'
      );
      return;
    }

    setResettingPassword(true);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      Alert.alert(
        'Correo Enviado ✉️',
        `Hemos enviado las instrucciones para restablecer tu contraseña a:\n${cleanEmail}\n\nRevisa tu bandeja de entrada o spam.`
      );
    } catch (error: any) {
      console.error('Error recuperando contraseña:', error);
      if (error.code === 'auth/user-not-found') {
        Alert.alert('Aviso', 'No existe una cuenta registrada con ese correo.');
      } else {
        Alert.alert('Error', 'No se pudo enviar el correo de recuperación. Inténtalo más tarde.');
      }
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.header}>
          <View style={styles.brandIconWrapper}>
            <Ionicons name="construct" size={28} color={BaseColors.accent} />
          </View>
          <Text style={styles.title}>Iniciar Sesión</Text>
          <Text style={styles.subtitle}>
            Accede a tu cuenta de Maestro a Domicilio
          </Text>
        </View>

        {/* Login Form Card */}
        <BaseCard variant="elevated" elevation="sm" style={styles.card}>
          <BaseInput
            label="Correo electrónico"
            placeholder="ejemplo@correo.com"
            value={email}
            onChangeText={(val) => {
              setEmail(val);
              if (emailError) setEmailError('');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="mail-outline"
            error={emailError}
          />

          <BaseInput
            label="Contraseña"
            placeholder="Tu contraseña secreta"
            value={password}
            onChangeText={(val) => {
              setPassword(val);
              if (passwordError) setPasswordError('');
            }}
            secureTextEntry
            leftIcon="lock-closed-outline"
            error={passwordError}
          />

          <TouchableOpacity
            onPress={handleForgotPassword}
            disabled={resettingPassword}
            style={styles.forgotBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.forgotText}>
              {resettingPassword ? 'Enviando enlace...' : '¿Olvidaste tu contraseña?'}
            </Text>
          </TouchableOpacity>

          <BaseButton
            title="Ingresar a la plataforma"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            variant="solid"
            intent="primary"
            size="lg"
            fullWidth
            icon="log-in-outline"
            style={{ marginTop: 8 }}
          />
        </BaseCard>

        {/* Footer Links */}
        <View style={styles.footerContainer}>
          <TouchableOpacity
            onPress={() => router.push('/auth/register')}
            style={styles.registerLink}
          >
            <Text style={styles.footerText}>
              ¿No tienes cuenta? <Text style={styles.footerBold}>Regístrate aquí</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/onboarding')}
            style={styles.tutorialLink}
          >
            <Ionicons name="help-circle-outline" size={16} color={BaseColors.gray500} />
            <Text style={styles.tutorialText}>Ver tutorial interactivo</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BaseColors.gray50,
  },
  scrollContent: {
    paddingHorizontal: 20,
    justifyContent: 'center',
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: BaseRadii.lg,
    backgroundColor: BaseColors.accentLight,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    ...BaseElevation.sm,
  },
  title: {
    fontSize: BaseTypography.sizes.xl,
    fontWeight: BaseTypography.weights.bold,
    color: BaseColors.gray900,
    includeFontPadding: false,
  },
  subtitle: {
    fontSize: BaseTypography.sizes.sm,
    color: BaseColors.gray500,
    marginTop: 4,
  },
  card: {
    padding: 20,
    marginBottom: 20,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    marginTop: -4,
  },
  forgotText: {
    fontSize: BaseTypography.sizes.xs,
    color: BaseColors.accent,
    fontWeight: BaseTypography.weights.semiBold,
  },
  footerContainer: {
    alignItems: 'center',
    gap: 16,
  },
  registerLink: {
    padding: 6,
  },
  footerText: {
    fontSize: BaseTypography.sizes.sm,
    color: BaseColors.gray600,
  },
  footerBold: {
    color: BaseColors.accent,
    fontWeight: BaseTypography.weights.bold,
  },
  tutorialLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
  },
  tutorialText: {
    fontSize: BaseTypography.sizes.xs,
    color: BaseColors.gray500,
    fontWeight: BaseTypography.weights.medium,
  },
});
