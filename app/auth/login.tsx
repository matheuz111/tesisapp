import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../src/config/firebase';
import { useSession } from '../../src/context/SessionContext';

export default function LoginScreen() {
  const router = useRouter();
  const { user, authLoading } = useSession();
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!authLoading && user && auth.currentUser?.uid === user.uid) router.replace('/');
  }, [user, authLoading, router]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  // Validación estricta de correo RFC 5322
  const isValidEmail = (val: string) => {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val);
  };

  const handleLogin = async () => {
    if (submitting.current) return;
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;

    if (!cleanEmail || !cleanPassword) {
      Toast.show({
        type: 'error',
        text1: 'Campos requeridos',
        text2: 'Por favor ingresa tu correo y contraseña 👋'
      });
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      Toast.show({
        type: 'error',
        text1: 'Correo inválido',
        text2: 'Ingresa un formato válido (ejemplo: nombre@dominio.com)'
      });
      return;
    }

    if (cleanPassword.length < 6) {
      Toast.show({
        type: 'error',
        text1: 'Contraseña muy corta',
        text2: 'La contraseña debe tener al menos 6 caracteres'
      });
      return;
    }

    submitting.current = true;
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      // SessionContext resolves the role from its shared listener, including cached data.
      if (mounted.current && auth.currentUser?.uid === userCredential.user.uid) router.replace('/');

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
        text2: msg
      });
    } finally {
      submitting.current = false;
      if (mounted.current) setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      Alert.alert('Recuperar Contraseña', 'Ingresa tu correo en el campo superior para enviarte el enlace de restablecimiento.');
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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>

        {/* HEADER */}
        <View style={styles.header}>
          <Ionicons name="person-circle-outline" size={80} color="#007bff" />
          <Text style={styles.title}>Bienvenido de nuevo</Text>
          <Text style={styles.subtitle}>Ingresa a tu cuenta</Text>
        </View>

        {/* INPUT EMAIL */}
        <View style={styles.inputContainer}>
          <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* INPUT PASSWORD */}
        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color="#666"
            />
          </TouchableOpacity>
        </View>

        {/* OLVIDÉ MI CONTRASEÑA */}
        <TouchableOpacity
          onPress={handleForgotPassword}
          disabled={resettingPassword}
          style={{ alignSelf: 'flex-end', marginBottom: 16 }}
        >
          <Text style={{ color: '#007bff', fontSize: 13, fontWeight: '600' }}>
            {resettingPassword ? 'Enviando correo...' : '¿Olvidaste tu contraseña?'}
          </Text>
        </TouchableOpacity>

        {/* BOTÓN LOGIN */}
        <TouchableOpacity
          style={[styles.buttonPrimary, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>INGRESAR</Text>
          )}
        </TouchableOpacity>

        {/* LINK REGISTRO */}
        <TouchableOpacity onPress={() => router.push('/auth/register')} style={styles.footerLink}>
          <Text style={styles.linkText}>¿No tienes cuenta? <Text style={styles.linkBold}>Regístrate aquí</Text></Text>
        </TouchableOpacity>

        {/* LINK ONBOARDING (TUTORIAL) */}
        <TouchableOpacity onPress={() => router.push('/onboarding')} style={{ marginTop: 30 }}>
          <Text style={{ color: '#007bff', textAlign: 'center' }}>
            ¿Nuevo aquí? <Text style={{ fontWeight: 'bold' }}>Ver Tutorial de la App</Text>
          </Text>
        </TouchableOpacity>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { flex: 1, justifyContent: 'center', padding: 24 },

  header: { alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333', marginTop: 16 },
  subtitle: { fontSize: 16, color: '#666', marginTop: 8 },

  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#e1e1e1', borderRadius: 12,
    paddingHorizontal: 16, height: 56, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#333' },

  buttonPrimary: {
    backgroundColor: '#007bff', height: 56, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginTop: 16,
    shadowColor: '#007bff', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  buttonDisabled: { backgroundColor: '#a0cfff' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },

  footerLink: { marginTop: 24, alignItems: 'center' },
  linkText: { color: '#666', fontSize: 14 },
  linkBold: { color: '#007bff', fontWeight: 'bold' },
});
