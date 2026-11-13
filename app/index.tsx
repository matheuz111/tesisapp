import { useRouter } from 'expo-router';
import { resetToLogin } from '../src/navigation/resetStack';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
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
  const pulse = useSharedValue(0.55);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }), withTiming(0.55, { duration: 700, easing: Easing.inOut(Easing.quad) })), -1);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value, transform: [{ scale: 0.94 + pulse.value * 0.06 }] }));
  useEffect(() => {
    if (authLoading || closingRef.current) return;
    if (!user) { router.replace('/auth/login'); return; }
    const home = getRoleHome(profile?.role);
    if (profile?.uid === user.uid && auth.currentUser?.uid === user.uid && home) router.replace(home);
  }, [user, profile, authLoading, router]);

  const logout = async () => {
    if (closingRef.current) return;
    closingRef.current = true; setClosing(true);
    try { await signOutWithNotifications(); resetToLogin(router); }
    catch { Alert.alert('No se pudo cerrar sesión', 'Vuelve a intentarlo.'); closingRef.current = false; setClosing(false); }
  };

  return <View style={[styles.container, { backgroundColor: colors.background }]}>
    {(loading || authLoading) && (
      <View style={styles.logoTile}>
        <Animated.Image source={require('../assets/brand/logo-icon.png')} style={[styles.logo, pulseStyle]} resizeMode="contain" accessibilityLabel="Cargando" />
      </View>
    )}
    <Text style={[styles.message, { color: colors.text }]}>{error || (loading || authLoading ? 'Cargando tu cuenta…' : 'Esta cuenta todavía no tiene un rol válido. Contacta a la central.')}</Text>
    {!(loading || authLoading) && <TouchableOpacity onPress={retry} style={styles.button}><Text style={{ color: colors.primary }}>Reintentar</Text></TouchableOpacity>}
    <TouchableOpacity onPress={logout} disabled={closing} style={styles.button}><Text style={{ color: colors.danger }}>{closing ? 'Cerrando sesión…' : 'Cerrar sesión y cambiar de cuenta'}</Text></TouchableOpacity>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  logoTile: { width: 88, height: 88, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 62, height: 60 },
  message: { textAlign: 'center', lineHeight: 22, marginVertical: 16 },
  button: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 },
});
