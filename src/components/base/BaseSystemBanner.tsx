import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseColors, BaseRadii, BaseTypography } from './BaseTokens';

export type BannerVariant = 'accent' | 'positive' | 'warning' | 'negative' | 'neutral';

export interface BaseSystemBannerProps {
  variant?: BannerVariant;
  title: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionText?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  style?: ViewStyle;
  titleStyle?: TextStyle;
  descriptionStyle?: TextStyle;
}

const BANNER_CONFIG: Record<
  BannerVariant,
  {
    bg: string;
    border: string;
    text: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
  }
> = {
  accent: {
    bg: '#F0F9FF',
    border: '#BAE6FD',
    text: '#0C4A6E',
    description: '#0369A1',
    icon: 'information-circle',
    iconColor: BaseColors.accent,
  },
  positive: {
    bg: BaseColors.positiveLight,
    border: BaseColors.positiveBorder,
    text: '#065F46',
    description: '#047857',
    icon: 'checkmark-circle',
    iconColor: BaseColors.positive,
  },
  warning: {
    bg: BaseColors.warningLight,
    border: BaseColors.warningBorder,
    text: '#92400E',
    description: '#B45309',
    icon: 'alert-circle',
    iconColor: BaseColors.warning,
  },
  negative: {
    bg: BaseColors.negativeLight,
    border: BaseColors.negativeBorder,
    text: '#991B1B',
    description: '#B91C1C',
    icon: 'close-circle',
    iconColor: BaseColors.negative,
  },
  neutral: {
    bg: BaseColors.gray50,
    border: BaseColors.gray200,
    text: BaseColors.gray900,
    description: BaseColors.gray600,
    icon: 'notifications',
    iconColor: BaseColors.gray500,
  },
};

export const BaseSystemBanner: React.FC<BaseSystemBannerProps> = ({
  variant = 'accent',
  title,
  description,
  icon,
  actionText,
  onAction,
  onDismiss,
  style,
  titleStyle,
  descriptionStyle,
}) => {
  const config = BANNER_CONFIG[variant] || BANNER_CONFIG.accent;
  const resolvedIcon = icon || config.icon;

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
        },
        style,
      ]}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={resolvedIcon} size={20} color={config.iconColor} />
      </View>

      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: config.text }, titleStyle]}>
          {title}
        </Text>
        {Boolean(description) && (
          <Text
            style={[styles.description, { color: config.description }, descriptionStyle]}
          >
            {description}
          </Text>
        )}
        {Boolean(actionText && onAction) && (
          <TouchableOpacity
            onPress={onAction}
            style={styles.actionButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.actionText, { color: config.text }]}>
              {actionText}
            </Text>
            <Ionicons name="arrow-forward" size={12} color={config.text} />
          </TouchableOpacity>
        )}
      </View>

      {Boolean(onDismiss) && (
        <TouchableOpacity
          onPress={onDismiss}
          style={styles.dismissButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={16} color={config.description} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    borderRadius: BaseRadii.md,
    borderWidth: 1,
    padding: 12,
    alignItems: 'flex-start',
  },
  iconContainer: {
    marginRight: 10,
    marginTop: 1,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: BaseTypography.sizes.sm,
    fontWeight: BaseTypography.weights.bold,
    includeFontPadding: false,
  },
  description: {
    fontSize: BaseTypography.sizes.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
    alignSelf: 'flex-start',
  },
  actionText: {
    fontSize: BaseTypography.sizes.xs,
    fontWeight: BaseTypography.weights.bold,
    textDecorationLine: 'underline',
  },
  dismissButton: {
    marginLeft: 8,
    padding: 2,
  },
});
