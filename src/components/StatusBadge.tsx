import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { StatusTokens, Typography } from '../theme/tokens';

export interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

interface BadgeStyleConfig {
  fg: string;
  bg: string;
  border: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const { theme } = useTheme();
  const tokens = StatusTokens[theme];

  let config: BadgeStyleConfig = tokens.pending;
  let label = 'PENDIENTE';
  let iconName: keyof typeof Ionicons.glyphMap = 'time-outline';

  switch (status) {
    case 'PENDING_ASSIGNMENT':
      config = tokens.pending;
      label = 'POR ASIGNAR';
      iconName = 'time-outline';
      break;
    case 'QUOTED':
      config = tokens.quoted;
      label = 'COTIZADO';
      iconName = 'receipt-outline';
      break;
    case 'PENDING':
      config = tokens.pending;
      label = 'ESPERANDO TÉCNICO';
      iconName = 'person-add-outline';
      break;
    case 'ACCEPTED':
      config = tokens.inTransit;
      label = 'EN CAMINO';
      iconName = 'navigate-outline';
      break;
    case 'IN_PROGRESS':
      config = tokens.inProgress;
      label = 'EN EJECUCIÓN';
      iconName = 'construct-outline';
      break;
    case 'COMPLETED':
      config = tokens.completed;
      label = 'CULMINADO';
      iconName = 'checkmark-circle-outline';
      break;
    case 'VALIDATED':
    case 'ARCHIVED':
      config = tokens.completed;
      label = 'VALIDADO';
      iconName = 'shield-checkmark-outline';
      break;
    case 'REQUIRES_REASSIGNMENT':
      config = tokens.danger;
      label = 'REASIGNAR';
      iconName = 'alert-circle-outline';
      break;
    case 'CANCELLED_BY_CLIENT':
      config = tokens.danger;
      label = 'CANCELADO POR CLIENTE';
      iconName = 'close-circle-outline';
      break;
    case 'CANCELLED_BY_PROVIDER':
      config = tokens.danger;
      label = 'CANCELADO POR TÉCNICO';
      iconName = 'close-circle-outline';
      break;
    default:
      config = tokens.pending;
      label = status;
      iconName = 'information-circle-outline';
      break;
  }

  const isSm = size === 'sm';

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Estado del servicio: ${label}`}
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          paddingVertical: isSm ? 2 : 4,
          paddingHorizontal: isSm ? 6 : 8,
        },
      ]}
    >
      <Ionicons name={iconName} size={isSm ? 12 : 14} color={config.fg} style={styles.icon} />
      <Text
        style={[
          styles.text,
          {
            color: config.fg,
            fontSize: isSm ? Typography.sizes.badge : Typography.sizes.caption,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
