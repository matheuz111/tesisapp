import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { BaseColors, BaseRadii, BaseTypography, BaseElevation } from './BaseTokens';

export type CardVariant = 'elevated' | 'outlined' | 'filled';

export interface BaseCardProps {
  children?: React.ReactNode;
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: CardVariant;
  radius?: 'md' | 'lg' | 'xl';
  elevation?: 'none' | 'sm' | 'md' | 'lg';
  onPress?: () => void;
  style?: ViewStyle;
  headerStyle?: ViewStyle;
  bodyStyle?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
  showDivider?: boolean;
}

export const BaseCard: React.FC<BaseCardProps> = ({
  children,
  title,
  subtitle,
  headerRight,
  footer,
  variant = 'elevated',
  radius = 'lg',
  elevation = 'sm',
  onPress,
  style,
  headerStyle,
  bodyStyle,
  titleStyle,
  subtitleStyle,
  showDivider = false,
}) => {
  const getRadius = () => {
    switch (radius) {
      case 'md': return BaseRadii.md;
      case 'xl': return BaseRadii.xl;
      case 'lg':
      default: return BaseRadii.lg;
    }
  };

  const getElevationStyle = () => {
    if (variant !== 'elevated') return null;
    switch (elevation) {
      case 'md': return BaseElevation.md;
      case 'lg': return BaseElevation.lg;
      case 'sm': return BaseElevation.sm;
      case 'none':
      default: return null;
    }
  };

  let bg = BaseColors.white;
  let borderColor = BaseColors.gray200;
  let borderWidth = 1;

  if (variant === 'filled') {
    bg = BaseColors.gray50;
    borderColor = 'transparent';
    borderWidth = 0;
  } else if (variant === 'outlined') {
    bg = BaseColors.white;
    borderColor = BaseColors.gray200;
    borderWidth = 1;
  }

  const hasHeader = Boolean(title || subtitle || headerRight);

  const cardContent = (
    <>
      {hasHeader && (
        <View style={[styles.header, headerStyle]}>
          <View style={styles.headerTitles}>
            {Boolean(title) && (
              <Text style={[styles.title, titleStyle]} numberOfLines={1}>
                {title}
              </Text>
            )}
            {Boolean(subtitle) && (
              <Text style={[styles.subtitle, subtitleStyle]} numberOfLines={2}>
                {subtitle}
              </Text>
            )}
          </View>
          {headerRight && <View style={styles.headerRight}>{headerRight}</View>}
        </View>
      )}

      {hasHeader && showDivider && <View style={styles.divider} />}

      {children && <View style={[styles.body, bodyStyle]}>{children}</View>}

      {footer && (
        <>
          {showDivider && <View style={styles.divider} />}
          <View style={styles.footer}>{footer}</View>
        </>
      )}
    </>
  );

  const containerStyle = [
    styles.card,
    {
      backgroundColor: bg,
      borderColor,
      borderWidth,
      borderRadius: getRadius(),
    },
    getElevationStyle(),
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          containerStyle,
          pressed && { opacity: 0.95, backgroundColor: BaseColors.gray50 },
        ]}
      >
        {cardContent}
      </Pressable>
    );
  }

  return <View style={containerStyle}>{cardContent}</View>;
};

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    fontSize: BaseTypography.sizes.md,
    fontWeight: BaseTypography.weights.bold,
    color: BaseColors.gray900,
    includeFontPadding: false,
  },
  subtitle: {
    fontSize: BaseTypography.sizes.xs,
    color: BaseColors.gray500,
    marginTop: 2,
  },
  headerRight: {
    marginLeft: 12,
  },
  divider: {
    height: 1,
    backgroundColor: BaseColors.gray200,
  },
  body: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: BaseColors.gray50,
  },
});
