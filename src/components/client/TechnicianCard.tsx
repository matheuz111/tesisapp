import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme, type ThemeColors } from '../../context/ThemeContext';
import { SemanticColors } from '../../theme/tokens';
import { AnimatedPressable } from '../AnimatedPressable';

type Props = {
  providerName: string;
  onCall: () => void;
  onChat: () => void;
};

/** Ficha del técnico asignado con acciones rápidas de contacto (llamar a la central / abrir chat). */
export function TechnicianCard({ providerName, onCall, onChat }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
      <View style={[styles.technicianCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={styles.technicianAvatar}>
          <Ionicons name="person" size={26} color="#FFFFFF" />
        </View>
        <View style={styles.technicianInfo}>
          <Text numberOfLines={1} style={[styles.technicianName, { color: colors.text }]}>
            {providerName}
          </Text>
          <View style={styles.technicianBadgeRow}>
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={12} color={colors.success} />
              <Text style={styles.verifiedBadgeText}>Técnico Propio</Text>
            </View>
            <Text numberOfLines={1} style={[styles.ratingPill, { color: colors.subtext }]}>★ 4.9 · Homologado</Text>
          </View>
        </View>
  
        {/* Acciones de Contacto Rápido */}
        <View style={styles.technicianActions}>
          <AnimatedPressable
            style={styles.callTechnicianBtn}
            onPress={onCall}
            accessibilityLabel="Llamar a la Central"
          >
            <Ionicons name="call" size={18} color="#FFFFFF" />
          </AnimatedPressable>
  
          <AnimatedPressable
            style={[styles.chatTechnicianBtn, { borderColor: colors.border }]}
            onPress={onChat}
            accessibilityLabel="Abrir chat del servicio"
          >
            <Ionicons name="chatbubble-ellipses" size={18} color={SemanticColors.primary.main} />
          </AnimatedPressable>
        </View>
      </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  technicianCard: {
    flexDirection: 'row',
    flexShrink: 1,
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    marginVertical: 10,
  },
  technicianAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#0369A1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  technicianName: {
    fontSize: 15,
    flexShrink: 1,
    fontWeight: '800',
  },
  technicianInfo: {
    flex: 1,
    minWidth: 0, // permite que el texto se recorte en vez de pasar por debajo de los botones
  },
  technicianBadgeRow: {
    flexDirection: 'row',
    flexShrink: 1,
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 6,
    rowGap: 2,
    marginTop: 4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    flexShrink: 1,
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.states.completed.bg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    fontSize: 10,
    flexShrink: 1,
    fontWeight: '700',
    color: colors.success,
  },
  ratingPill: {
    fontSize: 11,
    flexShrink: 1,
    fontWeight: '600',
  },
  technicianActions: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 0,
  },
  callTechnicianBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#166534',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatTechnicianBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
