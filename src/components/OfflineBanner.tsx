import { useTheme, type ThemeColors } from '../context/ThemeContext';
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '../services/networkStatus';

interface Props {
  customMessage?: string;
}

export function OfflineBanner({ customMessage }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isOnline, checkConnectivity } = useNetworkStatus();
  const [checking, setChecking] = React.useState(false);

  if (isOnline) return null;

  const handleRetry = async () => {
    setChecking(true);
    try {
      await checkConnectivity();
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline" size={18} color={colors.states.pending.fg} />
      <View style={{ flex: 1 }}>
        <Text style={styles.bannerText}>
          {customMessage || 'Sin conexión a internet · Modo de solo lectura activo'}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.retryBtn}
        onPress={handleRetry}
        disabled={checking}
        accessibilityLabel="Reintentar conexión a internet"
      >
        {checking ? (
          <ActivityIndicator size="small" color={colors.states.pending.fg} />
        ) : (
          <Text style={styles.retryText}>Reintentar</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  banner: {
    backgroundColor: colors.states.pending.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.states.pending.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    flexShrink: 1,
    alignItems: 'center',
    gap: 10,
    zIndex: 9999,
  },
  bannerText: {
    color: colors.states.pending.fg,
    fontSize: 12,
    flexShrink: 1,
    fontWeight: '700',
    lineHeight: 16,
  },
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#FDE68A',
  },
  retryText: {
    color: '#78350F',
    fontSize: 11,
    flexShrink: 1,
    fontWeight: '800',
  },
});
