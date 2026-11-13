import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BaseRadii, BaseTypography } from './BaseTokens';
import { useBaseColors, type BaseColorSet } from './useBaseColors';

export type ButtonVariant = 'solid' | 'outline' | 'minimal' | 'pill';
export type ButtonIntent = 'primary' | 'secondary' | 'positive' | 'negative' | 'warning' | 'dark';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface BaseButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  intent?: ButtonIntent;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  haptic?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const getIntentColors = (BaseColors: BaseColorSet): Record<ButtonIntent, { main: string; hover: string; light: string; textOnSolid: string }> => ({
  primary: {
    main: BaseColors.accent,
    hover: BaseColors.accentHover,
    light: BaseColors.accentLight,
    textOnSolid: BaseColors.onSolid,
  },
  dark: {
    main: BaseColors.gray900,
    hover: BaseColors.black,
    light: BaseColors.gray200,
    textOnSolid: BaseColors.onSolid,
  },
  secondary: {
    main: BaseColors.gray600,
    hover: BaseColors.gray700,
    light: BaseColors.gray100,
    textOnSolid: BaseColors.onSolid,
  },
  positive: {
    main: BaseColors.positive,
    hover: '#047857',
    light: BaseColors.positiveLight,
    textOnSolid: BaseColors.onSolid,
  },
  negative: {
    main: BaseColors.negative,
    hover: '#B91C1C',
    light: BaseColors.negativeLight,
    textOnSolid: BaseColors.onSolid,
  },
  warning: {
    main: BaseColors.warning,
    hover: '#B45309',
    light: BaseColors.warningLight,
    textOnSolid: BaseColors.onSolid,
  },
});

export const BaseButton: React.FC<BaseButtonProps> = ({
  title,
  onPress,
  variant = 'solid',
  intent = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  haptic = false,
  style,
  textStyle,
}) => {
  const BaseColors = useBaseColors();
  const styles = React.useMemo(() => createStyles(BaseColors), [BaseColors]);
  const intentColors = React.useMemo(() => getIntentColors(BaseColors), [BaseColors]);
  const currentIntent = intentColors[intent] || intentColors.primary;
  const isPill = variant === 'pill';
  const isOutline = variant === 'outline';
  const isMinimal = variant === 'minimal';

  const handlePress = () => {
    if (disabled || loading) return;
    if (haptic) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  };

  // Dimensions by size
  const getHeight = () => {
    switch (size) {
      case 'sm': return 36;
      case 'lg': return 52;
      case 'md':
      default: return 46;
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'sm': return BaseTypography.sizes.sm;
      case 'lg': return BaseTypography.sizes.md;
      case 'md':
      default: return BaseTypography.sizes.base;
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm': return 16;
      case 'lg': return 20;
      case 'md':
      default: return 18;
    }
  };

  // Background and border styling
  let backgroundColor: string = currentIntent.main;
  let borderColor: string = 'transparent';
  let borderWidth = 0;
  let textColor: string = currentIntent.textOnSolid;

  if (isOutline) {
    backgroundColor = 'transparent';
    borderColor = intent === 'secondary' ? BaseColors.gray300 : currentIntent.main;
    borderWidth = 1.5;
    textColor = intent === 'secondary' ? BaseColors.gray800 : currentIntent.main;
  } else if (isMinimal) {
    backgroundColor = 'transparent';
    borderColor = 'transparent';
    borderWidth = 0;
    textColor = intent === 'secondary' ? BaseColors.gray700 : currentIntent.main;
  } else if (isPill) {
    backgroundColor = currentIntent.main;
    textColor = currentIntent.textOnSolid;
  }

  if (disabled) {
    backgroundColor = isMinimal || isOutline ? 'transparent' : BaseColors.gray200;
    borderColor = isOutline ? BaseColors.gray200 : 'transparent';
    textColor = BaseColors.gray400;
  }

  const borderRadius = isPill ? BaseRadii.full : BaseRadii.md;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          height: getHeight(),
          backgroundColor: pressed && !disabled ? (isOutline || isMinimal ? currentIntent.light : currentIntent.hover) : backgroundColor,
          borderColor,
          borderWidth,
          borderRadius,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: pressed && !disabled ? 0.92 : 1,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      <View style={styles.contentRow}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={textColor}
            style={{ marginRight: title ? 8 : 0 }}
          />
        ) : (
          icon && iconPosition === 'left' && (
            <Ionicons
              name={icon}
              size={getIconSize()}
              color={textColor}
              style={{ marginRight: 8 }}
            />
          )
        )}

        {Boolean(title) && (
          <Text
            style={[
              styles.text,
              {
                color: textColor,
                fontSize: getFontSize(),
              },
              textStyle,
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
        )}

        {!loading && icon && iconPosition === 'right' && (
          <Ionicons
            name={icon}
            size={getIconSize()}
            color={textColor}
            style={{ marginLeft: 8 }}
          />
        )}
      </View>
    </Pressable>
  );
};

const createStyles = (BaseColors: BaseColorSet) => StyleSheet.create({
  button: {
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
  },
  contentRow: {
    flexDirection: 'row',
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: BaseTypography.weights.semiBold,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
