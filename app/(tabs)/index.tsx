import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BaseColors,
  BaseElevation,
  BaseRadii,
  BaseTypography,
  BaseTile,
  BaseButton,
  BaseSystemBanner,
  BaseTag,
} from '../../src/components/base';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedRole, setSelectedRole] = useState<'client' | 'provider'>('client');

  const handleContinue = () => {
    router.push(`/auth/login?role=${selectedRole}`);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Ionicons name="construct" size={28} color={BaseColors.accent} />
          </View>
          <Text style={styles.brandTitle}>MAESTRO A DOMICILIO</Text>
          <Text style={styles.brandSubtitle}>Reparamos Tu Hogar · Lima & Callao</Text>

          <View style={styles.tagRow}>
            <BaseTag label="Servicio 100% Homologado" variant="positive" size="sm" icon="shield-checkmark" />
            <BaseTag label="Garantía 30 días" variant="accent" size="sm" icon="ribbon" />
          </View>
        </View>

        {/* Question Heading */}
        <View style={styles.promptContainer}>
          <Text style={styles.promptHeading}>¿Cómo deseas ingresar hoy?</Text>
          <Text style={styles.promptDescription}>
            Selecciona tu perfil de usuario para una experiencia personalizada.
          </Text>
        </View>

        {/* Role Tiles */}
        <View style={styles.tilesContainer}>
          <BaseTile
            title="Soy Cliente"
            subtitle="Solicita gasfitería, electricidad, cerrajería o pintura para tu hogar."
            icon="home-outline"
            iconColor={BaseColors.accent}
            iconBgColor={BaseColors.accentLight}
            selected={selectedRole === 'client'}
            onPress={() => setSelectedRole('client')}
            badge="Hogar"
            style={styles.tileSpacing}
          />

          <BaseTile
            title="Soy Especialista Técnico"
            subtitle="Atiende solicitudes asignadas, valida PIN de ingreso y gestiona evidencias."
            icon="hammer-outline"
            iconColor="#059669"
            iconBgColor="#ECFDF5"
            selected={selectedRole === 'provider'}
            onPress={() => setSelectedRole('provider')}
            badge="Operativo"
            style={styles.tileSpacing}
          />
        </View>

        {/* System Value Banner */}
        <BaseSystemBanner
          variant="accent"
          title="Trazabilidad y Seguridad de Extremo a Extremo"
          description="Monitoreo GPS en tiempo real de la ruta del técnico y código PIN de 4 dígitos para tu seguridad."
          icon="shield-checkmark"
          style={styles.bannerSpacing}
        />

        {/* Continue Button */}
        <View style={styles.actionContainer}>
          <BaseButton
            title={selectedRole === 'client' ? 'Continuar como Cliente' : 'Continuar como Técnico'}
            onPress={handleContinue}
            variant="solid"
            intent="primary"
            size="lg"
            fullWidth
            icon="arrow-forward"
            iconPosition="right"
          />

          <BaseButton
            title="¿Primera vez? Ver tutorial paso a paso"
            onPress={() => router.push('/onboarding')}
            variant="minimal"
            intent="secondary"
            size="md"
            fullWidth
            style={{ marginTop: 10 }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BaseColors.gray50,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: BaseRadii.lg,
    backgroundColor: BaseColors.accentLight,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    ...BaseElevation.sm,
  },
  brandTitle: {
    fontSize: BaseTypography.sizes.xl,
    fontWeight: BaseTypography.weights.bold,
    color: BaseColors.gray900,
    letterSpacing: 0.5,
    includeFontPadding: false,
  },
  brandSubtitle: {
    fontSize: BaseTypography.sizes.sm,
    color: BaseColors.gray500,
    marginTop: 4,
    includeFontPadding: false,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  promptContainer: {
    marginBottom: 18,
  },
  promptHeading: {
    fontSize: BaseTypography.sizes.md,
    fontWeight: BaseTypography.weights.bold,
    color: BaseColors.gray900,
  },
  promptDescription: {
    fontSize: BaseTypography.sizes.xs,
    color: BaseColors.gray600,
    marginTop: 4,
    lineHeight: 18,
  },
  tilesContainer: {
    marginBottom: 20,
  },
  tileSpacing: {
    marginBottom: 12,
  },
  bannerSpacing: {
    marginBottom: 24,
  },
  actionContainer: {
    marginTop: 8,
  },
});
