import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseRadii, BaseTypography } from './BaseTokens';
import { useBaseColors, type BaseColorSet } from './useBaseColors';

export interface BaseInputProps extends TextInputProps {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
}

export const BaseInput: React.FC<BaseInputProps> = ({
  label,
  helperText,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  style,
  onFocus,
  onBlur,
  secureTextEntry,
  ...props
}) => {
  const BaseColors = useBaseColors();
  const styles = React.useMemo(() => createStyles(BaseColors), [BaseColors]);
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = Boolean(secureTextEntry);
  const effectiveSecure = isPassword && !showPassword;

  const handleFocus = (e: any) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const borderColor = error
    ? BaseColors.negative
    : isFocused
    ? BaseColors.accent
    : BaseColors.gray300;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {Boolean(label) && (
        <Text style={[styles.label, error && { color: BaseColors.negative }]}>
          {label}
        </Text>
      )}

      <View
        style={[
          styles.inputContainer,
          {
            borderColor,
            borderWidth: isFocused || error ? 1.5 : 1,
            backgroundColor: props.editable === false ? BaseColors.gray100 : BaseColors.white,
          },
        ]}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={18}
            color={error ? BaseColors.negative : isFocused ? BaseColors.accent : BaseColors.gray400}
            style={styles.leftIcon}
          />
        )}

        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={BaseColors.gray400}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={effectiveSecure}
          {...props}
        />

        {isPassword ? (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.rightIconButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={BaseColors.gray500}
            />
          </TouchableOpacity>
        ) : rightIcon ? (
          <TouchableOpacity
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
            style={styles.rightIconButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={rightIcon} size={18} color={BaseColors.gray500} />
          </TouchableOpacity>
        ) : null}
      </View>

      {Boolean(error || helperText) && (
        <Text
          style={[
            styles.helperText,
            { color: error ? BaseColors.negative : BaseColors.gray500 },
          ]}
        >
          {error || helperText}
        </Text>
      )}
    </View>
  );
};

const createStyles = (BaseColors: BaseColorSet) => StyleSheet.create({
  wrapper: {
    marginBottom: 14,
  },
  label: {
    fontSize: BaseTypography.sizes.xs,
    flexShrink: 1,
    fontWeight: BaseTypography.weights.medium,
    color: BaseColors.gray700,
    marginBottom: 6,
    includeFontPadding: false,
  },
  inputContainer: {
    flexDirection: 'row',
    flexShrink: 1,
    alignItems: 'center',
    borderRadius: BaseRadii.md,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  leftIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: BaseTypography.sizes.base,
    color: BaseColors.gray900,
    paddingVertical: 10,
    includeFontPadding: false,
  },
  rightIconButton: {
    padding: 4,
    marginLeft: 6,
  },
  helperText: {
    fontSize: 11,
    flexShrink: 1,
    marginTop: 4,
    lineHeight: 14,
  },
});
