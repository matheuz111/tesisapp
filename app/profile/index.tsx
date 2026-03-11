import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { auth, db } from '../../src/config/firebase';
// IMPORTAR EL HOOK DEL TEMA
import { useTheme } from '../../src/context/ThemeContext';

export default function UserProfile() {
  const router = useRouter();
  const user = auth.currentUser;
  // USAR EL TEMA
  const { theme, toggleTheme, colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState('');

  useEffect(() => { loadUserData(); }, []);

  const loadUserData = async () => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFullName(data.full_name || '');
        setPhoneNumber(data.phone_number || '');
        setRole(data.role || 'USUARIO');
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { full_name: fullName, phone_number: phoneNumber });
      Toast.show({ type: 'success', text1: '¡Guardado!', text2: 'Perfil actualizado.' });
    } catch (error) { Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo guardar.' }); } finally { setSaving(false); }
  };

  if (loading) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>

      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person" size={50} color="#fff" />
        </View>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={[styles.roleText, { color: colors.primary }]}>{role === 'CLIENT' ? 'CLIENTE' : 'PROVEEDOR'}</Text>
        </View>
      </View>

      <View style={styles.form}>

        {/* OPCIÓN 1: MODO OSCURO */}
        <View style={[styles.optionRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="moon" size={22} color={colors.text} style={{ marginRight: 10 }} />
            <Text style={[styles.labelNoMargin, { color: colors.text }]}>Modo Oscuro</Text>
          </View>
          <Switch
            value={theme === 'dark'}
            onValueChange={toggleTheme}
            trackColor={{ false: '#767577', true: colors.primary }}
            thumbColor={theme === 'dark' ? '#fff' : '#f4f3f4'}
          />
        </View>

        {/* OPCIÓN 2: AYUDA Y SOPORTE (NUEVO) */}
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

        {/* FORMULARIO DE DATOS */}
        <Text style={[styles.label, { color: colors.subtext, marginTop: 10 }]}>Nombre Completo</Text>
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

        <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.success }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>GUARDAR CAMBIOS</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { auth.signOut(); router.replace('/'); }} style={[styles.logoutButton, { borderColor: colors.danger }]}>
          <Text style={{ color: colors.danger, fontWeight: 'bold' }}>CERRAR SESIÓN</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', paddingVertical: 40, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  avatarContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  email: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  roleBadge: { marginTop: 10, backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 20 },
  roleText: { fontWeight: 'bold', fontSize: 12 },
  form: { padding: 20, marginTop: 10 },
  label: { fontSize: 14, marginBottom: 5, marginLeft: 5, fontWeight: 'bold' },
  labelNoMargin: { fontSize: 16, fontWeight: 'bold' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 15, height: 50, marginBottom: 20, borderWidth: 1 },
  input: { flex: 1, fontSize: 16 },
  saveButton: { height: 55, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 10, elevation: 2 },
  saveText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1 },
  logoutButton: { marginTop: 30, padding: 15, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }
});