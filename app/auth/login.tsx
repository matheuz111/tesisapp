import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../src/config/firebase';

export default function LoginScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Función auxiliar para validar email
  const isValidEmail = (email: string) => {
    return /\S+@\S+\.\S+/.test(email);
  };

  const handleLogin = async () => {

    if (!email || !password) {
      Toast.show({
        type: 'error',
        text1: 'Campos vacíos',
        text2: 'Por favor ingresa tu correo y contraseña 👋'
      });
      return;
    }

    if (!isValidEmail(email)) {
      Toast.show({
        type: 'error',
        text1: 'Correo inválido',
        text2: 'El formato debe ser ejemplo@correo.com'
      });
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const userRole = userData?.role;

        Toast.show({
          type: 'success',
          text1: '¡Bienvenido!',
          text2: `Iniciando sesión como ${userRole === 'CLIENT' ? 'Cliente' : 'Proveedor'}...`
        });

        setTimeout(() => {
          if (userRole === 'CLIENT') {
            router.replace('/client/home');
          } else if (userRole === 'PROVIDER') {
            router.replace('/provider/home');
          } else {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Usuario sin rol válido' });
          }
        }, 1000);

      } else {
        Toast.show({ type: 'error', text1: 'Usuario no encontrado', text2: 'No existe registro en la base de datos.' });
      }

    } catch (error: any) {
      console.error(error);
      let msg = 'Ocurrió un error inesperado';
      // Mapeo de errores comunes de Firebase
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        msg = 'Correo o contraseña incorrectos';
      } else if (error.code === 'auth/too-many-requests') {
        msg = 'Demasiados intentos. Intenta más tarde.';
      }

      Toast.show({
        type: 'error',
        text1: 'Error de acceso',
        text2: msg
      });
    } finally {
      setLoading(false);
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
        <TouchableOpacity onPress={() => router.push(`/auth/register?role=${role || 'client'}`)} style={styles.footerLink}>
          <Text style={styles.linkText}>¿No tienes cuenta? <Text style={styles.linkBold}>Regístrate aquí</Text></Text>
        </TouchableOpacity>

        {/* LINK ONBOARDING (TUTORIAL) */}
        <TouchableOpacity onPress={() => router.push('./onboarding')} style={{ marginTop: 30 }}>
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