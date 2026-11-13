import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BaseColors, BaseRadii, BaseTypography, BaseElevation } from './BaseTokens';
import { useBaseColors, type BaseColorSet } from './useBaseColors';

export interface BaseTileProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBgColor?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
  badge?: string;
  trailingText?: string;
  showChevron?: boolean;
  style?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
  haptic?: boolean;
}

export const BaseTile: React.FC<BaseTileProps> = ({
  title,
  subtitle,
  icon,
  iconColor = BaseColors.accent,
  iconBgColor = BaseColors.accentLight,
  selected = false,
  disabled = false,
  onPress,
  badge,
  trailingText,
  showChevron = false,
  style,
  titleStyle,
  subtitleStyle,
  haptic = false,
}) => {
  const BaseColors = useBaseColors();
  const styles = React.useMemo(() => createStyles(BaseColors), [BaseColors]);
  const handlePress = () => {
    if (disabled) return;
    if (haptic) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  };

  const borderColor = selected ? BaseColors.accent : BaseColors.gray200;
  const backgroundColor = selected ? BaseColors.accentSoft : BaseColors.white;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.tile,
        {
          borderColor,
          borderWidth: selected ? 2 : 1,
          backgroundColor: pressed && !disabled ? BaseColors.gray50 : backgroundColor,
          opacity: disabled ? 0.5 : 1,
        },
        selected && BaseElevation.sm,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
    >
      <View style={styles.leftContainer}>
        {icon && (
          <View
            style={[
              styles.iconWrapper,
              {
                backgroundColor: selected ? BaseColors.accent : iconBgColor,
              },
            ]}
          >
            <Ionicons
              name={icon}
              size={22}
              color={selected ? BaseColors.onAccent : iconColor}
            />
          </View>
        )}

        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.title,
                { color: selected ? BaseColors.accentDark : BaseColors.gray900 },
                titleStyle,
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {Boolean(badge) && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            )}
          </View>

          {Boolean(subtitle) && (
            <Text
              style={[styles.subtitle, subtitleStyle]}
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.rightContainer}>
        {Boolean(trailingText) && (
          <Text style={[styles.trailingText, selected && { color: BaseColors.accent }]}>
            {trailingText}
          </Text>
        )}

        {selected ? (
          <View style={styles.selectedIndicator}>
            <Ionicons name="checkmark-circle" size={22} color={BaseColors.accent} />
          </View>
        ) : showChevron ? (
          <Ionicons name="chevron-forward" size={18} color={BaseColors.gray400} />
        ) : null}
      </View>
    </Pressable>
  );
};

const createStyles = (BaseColors: BaseColorSet) => StyleSheet.create({
  tile: {
    borderRadius: BaseRadii.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: BaseRadii.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    flexShrink: 1,
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: BaseTypography.sizes.base,
    flexShrink: 1,
    fontWeight: BaseTypography.weights.semiBold,
    includeFontPadding: false,
  },
  subtitle: {
    fontSize: BaseTypography.sizes.xs,
    flexShrink: 1,
    color: BaseColors.gray500,
    marginTop: 2,
    lineHeight: 16,
  },
  badgeContainer: {
    backgroundColor: BaseColors.accentLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BaseRadii.sm,
  },
  badgeText: {
    fontSize: 10,
    flexShrink: 1,
    color: BaseColors.accent,
    fontWeight: BaseTypography.weights.bold,
  },
  rightContainer: {
    flexDirection: 'row',
    flexShrink: 1,
    alignItems: 'center',
    gap: 6,
  },
  trailingText: {
    fontSize: BaseTypography.sizes.sm,
    flexShrink: 1,
    fontWeight: BaseTypography.weights.semiBold,
    color: BaseColors.gray700,
  },
  selectedIndicator: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
