import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../src/config/firebase';
import { getRoleHome, useSession } from '../src/context/SessionContext';
import { useTheme } from '../src/context/ThemeContext';
import { signOutWithNotifications } from '../utils/pushNotifications';

export default function Index() {
  const router = useRouter();
  const { user, profile, authLoading, loading, error, retry } = useSession();
  const { colors } = useTheme();
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  useEffect(() => {
    if (authLoading || closingRef.current) return;
    if (!user) { router.replace('/auth/login'); return; }
    const home = getRoleHome(profile?.role);
    if (profile?.uid === user.uid && auth.currentUser?.uid === user.uid && home) router.replace(home);
  }, [user, profile, authLoading, router]);

  const logout = async () => {
    if (closingRef.current) return;
    closingRef.current = true; setClosing(true);
    try { await signOutWithNotifications(); router.replace('/auth/login'); }
    catch { Alert.alert('No se pudo cerrar sesión', 'Vuelve a intentarlo.'); closingRef.current = false; setClosing(false); }
  };

  return <View style={[styles.container, { backgroundColor: colors.background }]}>
    {(loading || authLoading) && <ActivityIndicator size="large" color={colors.primary} />}
    <Text style={[styles.message, { color: colors.text }]}>{error || (loading || authLoading ? 'Cargando tu cuenta…' : 'Esta cuenta todavía no tiene un rol válido. Contacta a la central.')}</Text>
    {!(loading || authLoading) && <TouchableOpacity onPress={retry} style={styles.button}><Text style={{ color: colors.primary }}>Reintentar</Text></TouchableOpacity>}
    <TouchableOpacity onPress={logout} disabled={closing} style={styles.button}><Text style={{ color: colors.danger }}>{closing ? 'Cerrando sesión…' : 'Cerrar sesión y cambiar de cuenta'}</Text></TouchableOpacity>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  message: { textAlign: 'center', lineHeight: 22, marginVertical: 16 },
  button: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 },
});
