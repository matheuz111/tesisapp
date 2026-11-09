import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseColors, BaseRadii, BaseTypography, BaseElevation } from './BaseTokens';
import { BaseButton } from './BaseButton';

export interface BaseMessageCardProps {
  title: string;
  description: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  onDismiss?: () => void;
  style?: ViewStyle;
}

export const BaseMessageCard: React.FC<BaseMessageCardProps> = ({
  title,
  description,
  icon = 'information-circle',
  iconColor = BaseColors.accent,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  onDismiss,
  style,
}) => {
  return (
    <View style={[styles.card, BaseElevation.sm, style]}>
      {onDismiss && (
        <TouchableOpacity
          onPress={onDismiss}
          style={styles.dismissButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Cerrar aviso"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={18} color={BaseColors.gray400} />
        </TouchableOpacity>
      )}

      <View style={styles.headerRow}>
        <View style={[styles.iconContainer, { backgroundColor: BaseColors.accentLight }]}>
          <Ionicons name={icon} size={22} color={iconColor} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>

      {(primaryActionLabel || secondaryActionLabel) && (
        <View style={styles.actionRow}>
          {secondaryActionLabel && onSecondaryAction && (
            <BaseButton
              title={secondaryActionLabel}
              onPress={onSecondaryAction}
              variant="minimal"
              intent="secondary"
              size="sm"
            />
          )}
          {primaryActionLabel && onPrimaryAction && (
            <BaseButton
              title={primaryActionLabel}
              onPress={onPrimaryAction}
              variant="solid"
              intent="primary"
              size="sm"
            />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: BaseColors.white,
    borderRadius: BaseRadii.lg,
    borderWidth: 1,
    borderColor: BaseColors.gray200,
    padding: 16,
    position: 'relative',
  },
  dismissButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
    padding: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: BaseRadii.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    paddingRight: 24,
  },
  title: {
    fontSize: BaseTypography.sizes.base,
    fontWeight: BaseTypography.weights.bold,
    color: BaseColors.gray900,
    includeFontPadding: false,
  },
  description: {
    fontSize: BaseTypography.sizes.xs,
    color: BaseColors.gray600,
    marginTop: 4,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
});
