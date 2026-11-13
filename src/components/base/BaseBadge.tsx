import React from 'react';
import { StyleSheet, Text, View, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseColors, BaseRadii, BaseTypography } from './BaseTokens';
import { useBaseColors, type BaseColorSet } from './useBaseColors';

// ============================================================================
// 1. NOTIFICATION BADGE (Numerical indicator)
// ============================================================================
export interface NotificationBadgeProps {
  count?: number;
  maxCount?: number;
  color?: string;
  textColor?: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count,
  maxCount = 99,
  color: colorProp,
  textColor: textColorProp,
  size = 'md',
  style,
}) => {
  const BaseColors = useBaseColors();
  const color = colorProp ?? BaseColors.negative;
  const textColor = textColorProp ?? BaseColors.onSolid;
  const styles = React.useMemo(() => createStyles(BaseColors), [BaseColors]);
  if (count === undefined || count <= 0) return null;

  const displayCount = count > maxCount ? `${maxCount}+` : `${count}`;
  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.notificationBadge,
        {
          backgroundColor: color,
          height: isSm ? 16 : 20,
          minWidth: isSm ? 16 : 20,
          borderRadius: BaseRadii.full,
          paddingHorizontal: isSm ? 4 : 6,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.notificationText,
          {
            color: textColor,
            fontSize: isSm ? 10 : 11,
          },
        ]}
      >
        {displayCount}
      </Text>
    </View>
  );
};

// ============================================================================
// 2. HINT BADGE (Status dot / radar)
// ============================================================================
export type HintStatus = 'positive' | 'warning' | 'negative' | 'accent' | 'neutral';

export interface HintBadgeProps {
  status?: HintStatus;
  size?: number;
  showRing?: boolean;
  style?: ViewStyle;
}

const HINT_COLORS: Record<HintStatus, { dot: string; ring: string }> = {
  positive: { dot: BaseColors.positive, ring: BaseColors.positiveLight },
  warning: { dot: BaseColors.warning, ring: BaseColors.warningLight },
  negative: { dot: BaseColors.negative, ring: BaseColors.negativeLight },
  accent: { dot: BaseColors.accent, ring: BaseColors.accentLight },
  neutral: { dot: BaseColors.gray400, ring: BaseColors.gray100 },
};

export const HintBadge: React.FC<HintBadgeProps> = ({
  status = 'positive',
  size = 8,
  showRing = false,
  style,
}) => {
  const BaseColors = useBaseColors();
  const styles = React.useMemo(() => createStyles(BaseColors), [BaseColors]);
  const { dot, ring } = HINT_COLORS[status] || HINT_COLORS.neutral;

  if (showRing) {
    const ringSize = size + 6;
    return (
      <View
        style={[
          styles.hintRing,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            backgroundColor: ring,
          },
          style,
        ]}
      >
        <View
          style={[
            styles.hintDot,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: dot,
            },
          ]}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.hintDot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: dot,
        },
        style,
      ]}
    />
  );
};

// ============================================================================
// 3. BASE TAG / CHIP (Status label tag)
// ============================================================================
export type TagVariant = 'positive' | 'warning' | 'negative' | 'accent' | 'neutral';

export interface BaseTagProps {
  label: string;
  variant?: TagVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  pill?: boolean;
  size?: 'sm' | 'md';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const getTagStyles = (BaseColors: BaseColorSet): Record<TagVariant, { bg: string; text: string; border: string }> => ({
  positive: {
    bg: BaseColors.positiveLight,
    text: BaseColors.positive,
    border: BaseColors.positiveBorder,
  },
  warning: {
    bg: BaseColors.warningLight,
    text: BaseColors.warning,
    border: BaseColors.warningBorder,
  },
  negative: {
    bg: BaseColors.negativeLight,
    text: BaseColors.negative,
    border: BaseColors.negativeBorder,
  },
  accent: {
    bg: BaseColors.accentLight,
    text: BaseColors.accent,
    border: BaseColors.accentBorder,
  },
  neutral: {
    bg: BaseColors.gray100,
    text: BaseColors.gray700,
    border: BaseColors.gray200,
  },
});

export const BaseTag: React.FC<BaseTagProps> = ({
  label,
  variant = 'neutral',
  icon,
  pill = true,
  size = 'md',
  style,
  textStyle,
}) => {
  const BaseColors = useBaseColors();
  const styles = React.useMemo(() => createStyles(BaseColors), [BaseColors]);
  const tagStyles = React.useMemo(() => getTagStyles(BaseColors), [BaseColors]);
  const current = tagStyles[variant] || tagStyles.neutral;
  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.tagContainer,
        {
          backgroundColor: current.bg,
          borderColor: current.border,
          borderRadius: pill ? BaseRadii.full : BaseRadii.sm,
          paddingVertical: isSm ? 2 : 4,
          paddingHorizontal: isSm ? 6 : 10,
        },
        style,
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={isSm ? 11 : 13}
          color={current.text}
          style={{ marginRight: 4 }}
        />
      )}
      <Text
        style={[
          styles.tagText,
          {
            color: current.text,
            fontSize: isSm ? 11 : 12,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const createStyles = (BaseColors: BaseColorSet) => StyleSheet.create({
  notificationBadge: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationText: {
    fontWeight: BaseTypography.weights.bold,
    textAlign: 'center',
    includeFontPadding: false,
  },
  hintDot: {
    alignSelf: 'center',
  },
  hintRing: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagContainer: {
    flexDirection: 'row',
    flexShrink: 1,
    alignItems: 'center',
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  tagText: {
    fontWeight: BaseTypography.weights.medium,
    includeFontPadding: false,
  },
});
