import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
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

type Role = 'client' | 'provider';

export default function RegisterScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams();
  const initialRole = (Array.isArray(role) ? role[0] : role) as Role | undefined;

  const [selectedRole, setSelectedRole] = useState<Role>(initialRole || 'client');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const isProvider = selectedRole === 'provider';

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (isProvider && !phone.trim()) {
      Alert.alert('Error', 'Como proveedor, necesitas registrar tu número de teléfono.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userData: any = {
        uid: user.uid,
        full_name: name,
        name: name,
        email: email,
        role: selectedRole.toUpperCase(),
        created_at: serverTimestamp(),
      };

      if (isProvider) {
        userData.phone = phone.trim();
        userData.specialty = '';
        userData.price_range = '';
        userData.rating = 0;
        userData.total_rating = 0;
        userData.review_count = 0;
        userData.jobs_completed = 0;
        userData.is_active = false;
        userData.is_verified = false;
        userData.service_radius_km = 10;
        userData.description = '';
      } else {
        if (phone.trim()) userData.phone = phone.trim();
      }

      await setDoc(doc(db, 'users', user.uid), userData);

      Alert.alert('¡Éxito!', 'Cuenta creada correctamente. Inicia sesión para continuar.');
      router.replace('/auth/login');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        Alert.alert('Error', 'Ese correo ya está registrado.');
      } else if (error.code === 'auth/invalid-email') {
        Alert.alert('Error', 'El formato del correo no es válido.');
      } else {
        Alert.alert('Error', error.message || 'Error desconocido');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Crear Cuenta</Text>
          <Text style={styles.subtitle}>Elige cómo quieres registrarte</Text>
        </View>

        {/* ═══ SELECTOR DE ROL ═══ */}
        <View style={styles.roleSelector}>
          <TouchableOpacity
            style={[
              styles.roleCard,
              selectedRole === 'client' && styles.roleCardActive,
              selectedRole === 'client' && { borderColor: '#007bff' },
            ]}
            onPress={() => setSelectedRole('client')}
            activeOpacity={0.7}
          >
            <View style={[styles.roleIconCircle, { backgroundColor: selectedRole === 'client' ? '#E3F2FD' : '#f5f5f5' }]}>
              <Ionicons name="home-outline" size={28} color={selectedRole === 'client' ? '#007bff' : '#999'} />
            </View>
            <Text style={[styles.roleTitle, selectedRole === 'client' && { color: '#007bff' }]}>
              Cliente
            </Text>
            <Text style={styles.roleDesc}>Necesito contratar servicios</Text>
            {selectedRole === 'client' && (
              <View style={[styles.roleCheck, { backgroundColor: '#007bff' }]}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.roleCard,
              selectedRole === 'provider' && styles.roleCardActive,
              selectedRole === 'provider' && { borderColor: '#28a745' },
            ]}
            onPress={() => setSelectedRole('provider')}
            activeOpacity={0.7}
          >
            <View style={[styles.roleIconCircle, { backgroundColor: selectedRole === 'provider' ? '#E8F5E9' : '#f5f5f5' }]}>
              <Ionicons name="construct-outline" size={28} color={selectedRole === 'provider' ? '#28a745' : '#999'} />
            </View>
            <Text style={[styles.roleTitle, selectedRole === 'provider' && { color: '#28a745' }]}>
              Profesional
            </Text>
            <Text style={styles.roleDesc}>Ofrezco mis servicios</Text>
            {selectedRole === 'provider' && (
              <View style={[styles.roleCheck, { backgroundColor: '#28a745' }]}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ═══ FORMULARIO ═══ */}
        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Nombre completo"
            value={name}
            onChangeText={setName}
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
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

        {/* Teléfono — obligatorio para proveedor, opcional para cliente */}
        <View style={styles.inputContainer}>
          <Ionicons name="call-outline" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder={isProvider ? 'Teléfono (obligatorio)' : 'Teléfono (opcional)'}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Contraseña (mín 6 caracteres)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            placeholderTextColor="#999"
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {isProvider && (
          <View style={styles.providerNote}>
            <Ionicons name="information-circle-outline" size={16} color="#007bff" />
            <Text style={styles.providerNoteText}>
              Tu número será visible para los clientes que te contraten (para llamadas).
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.buttonSuccess,
            { backgroundColor: isProvider ? '#28a745' : '#007bff' },
            loading && styles.buttonDisabled,
          ]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              CREAR CUENTA COMO {isProvider ? 'PROFESIONAL' : 'CLIENTE'}
            </Text>
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
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: 60 },

  header: { alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 15, color: '#666', marginTop: 6 },

  // ── Role selector ───────────────────
  roleSelector: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  roleCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e1e1e1',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.06)',
    position: 'relative',
  },
  roleCardActive: {
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
  },
  roleIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  roleTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 4 },
  roleDesc: { fontSize: 11, color: '#888', textAlign: 'center' },
  roleCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Inputs ──────────────────────────
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 14,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#333' },

  // ── Provider note ───────────────────
  providerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  providerNoteText: { flex: 1, fontSize: 12, color: '#1565C0', lineHeight: 18 },

  // ── Button ──────────────────────────
  buttonSuccess: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: 'bold', letterSpacing: 0.5 },

  footerLink: { marginTop: 24, alignItems: 'center', paddingBottom: 40 },
  linkText: { color: '#666', fontSize: 14 },
  linkBold: { color: '#007bff', fontWeight: 'bold' },
});