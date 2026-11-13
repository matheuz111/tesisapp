import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme, type ThemeColors } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, TouchTarget, DisplayPin, Typography } from '../theme/tokens';
import { AnimatedPressable } from './AnimatedPressable';

interface Props {
  pin: string;
  onChangePin: (pin: string) => void;
  onSubmitPin: () => void;
  verifying?: boolean;
  lockoutSeconds?: number;
  attemptsRemaining?: number;
}

export function TechnicianPinKeypad({
  pin,
  onChangePin,
  onSubmitPin,
  verifying = false,
  lockoutSeconds = 0,
  attemptsRemaining = 3,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isLocked = lockoutSeconds > 0;

  const handleKeyPress = (num: string) => {
    if (isLocked || verifying) return;
    if (pin.length < 4) {
      const newPin = pin + num;
      onChangePin(newPin);
      if (newPin.length === 4) {
        // Auto validate or trigger
      }
    }
  };

  const handleBackspace = () => {
    if (isLocked || verifying) return;
    if (pin.length > 0) {
      onChangePin(pin.slice(0, -1));
    }
  };

  const handleClear = () => {
    if (isLocked || verifying) return;
    onChangePin('');
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <View style={styles.container}>
      {/* Indicador de 4 dígitos */}
      <View style={styles.digitsDisplayRow}>
        {[0, 1, 2, 3].map((index) => {
          const char = pin[index] || '';
          const isFilled = Boolean(char);
          return (
            <View
              key={index}
              style={[
                styles.digitBox,
                isFilled && styles.digitBoxFilled,
                isLocked && styles.digitBoxLocked,
              ]}
            >
              <Text style={styles.digitText}>{char || '·'}</Text>
            </View>
          );
        })}
      </View>

      {/* Alerta de bloqueo o intentos */}
      {isLocked ? (
        <View style={styles.lockoutBadge}>
          <Ionicons name="lock-closed" size={16} color={colors.danger} />
          <Text style={styles.lockoutText}>
            Bloqueado por seguridad: reintenta en {lockoutSeconds}s
          </Text>
        </View>
      ) : attemptsRemaining < 3 ? (
        <Text style={styles.attemptsText}>
          PIN incorrecto. Intento {3 - attemptsRemaining} de 3. Verifica con el cliente el código mostrado en su app.
        </Text>
      ) : null}

      {/* Teclado numérico de 72px */}
      <View style={styles.keypadGrid}>
        {digits.map((digit) => (
          <AnimatedPressable
            key={digit}
            accessibilityLabel={`Dígito ${digit}`}
            disabled={isLocked || verifying}
            onPress={() => handleKeyPress(digit)}
            scaleTo={0.92}
            style={[
              styles.keyBtn,
              (isLocked || verifying) && styles.keyBtnDisabled,
            ]}
          >
            <Text style={styles.keyText}>{digit}</Text>
          </AnimatedPressable>
        ))}

        {/* Fila inferior: Borrar todo, 0, Backspace */}
        <AnimatedPressable
          accessibilityLabel="Limpiar PIN"
          disabled={isLocked || verifying || pin.length === 0}
          onPress={handleClear}
          scaleTo={0.92}
          style={[styles.keyBtn, styles.actionKeyBtn]}
        >
          <Text style={styles.actionKeyText}>C</Text>
        </AnimatedPressable>

        <AnimatedPressable
          accessibilityLabel="Dígito 0"
          disabled={isLocked || verifying}
          onPress={() => handleKeyPress('0')}
          scaleTo={0.92}
          style={[
            styles.keyBtn,
            (isLocked || verifying) && styles.keyBtnDisabled,
          ]}
        >
          <Text style={styles.keyText}>0</Text>
        </AnimatedPressable>

        <AnimatedPressable
          accessibilityLabel="Borrar último dígito"
          disabled={isLocked || verifying || pin.length === 0}
          onPress={handleBackspace}
          scaleTo={0.92}
          style={[styles.keyBtn, styles.actionKeyBtn]}
        >
          <Ionicons name="backspace-outline" size={26} color={colors.subtext} />
        </AnimatedPressable>
      </View>

      {/* Botón de envío */}
      <AnimatedPressable
        style={[
          styles.submitBtn,
          {
            backgroundColor:
              pin.length === 4 && !isLocked && !verifying
                ? SemanticColors.primary.main
                : colors.textMuted,
          },
        ]}
        disabled={pin.length !== 4 || isLocked || verifying}
        onPress={onSubmitPin}
        scaleTo={0.97}
        hapticFeedback="medium"
      >
        {verifying ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
            <Text style={styles.submitBtnText}>Validar Llegada con PIN</Text>
          </>
        )}
      </AnimatedPressable>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 12,
  },
  digitsDisplayRow: {
    flexDirection: 'row',
    flexShrink: 1,
    gap: 12,
    marginBottom: 12,
  },
  digitBox: {
    width: 58,
    height: 64,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  digitBoxFilled: {
    borderColor: SemanticColors.primary.main,
    backgroundColor: colors.primarySoft,
  },
  digitBoxLocked: {
    borderColor: '#EF4444',
    backgroundColor: colors.states.danger.bg,
  },
  digitText: {
    fontSize: DisplayPin.mobile.fontSize,
    flexShrink: 1,
    lineHeight: DisplayPin.mobile.lineHeight,
    fontFamily: Typography.fontFamily.mono,
    fontWeight: '700',
    color: colors.text,
  },
  lockoutBadge: {
    flexDirection: 'row',
    flexShrink: 1,
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.states.danger.bg,
    marginBottom: 10,
  },
  lockoutText: {
    color: colors.danger,
    fontSize: 12,
    flexShrink: 1,
    fontWeight: '700',
  },
  attemptsText: {
    color: colors.states.pending.fg,
    fontSize: 12,
    flexShrink: 1,
    fontWeight: '600',
    marginBottom: 8,
  },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 256, // 3 x 72px + 2 x 12px gap = 240px aprox
    gap: 12,
  },
  keyBtn: {
    width: TouchTarget.pinKeySize, // 72px
    height: TouchTarget.pinKeySize, // 72px
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  keyBtnDisabled: {
    opacity: 0.4,
    backgroundColor: colors.input,
  },
  keyText: {
    fontSize: 26,
    flexShrink: 1,
    fontWeight: '700',
    fontFamily: Typography.fontFamily.mono,
    color: colors.text,
  },
  actionKeyBtn: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  actionKeyText: {
    fontSize: 20,
    flexShrink: 1,
    fontWeight: '800',
    color: colors.subtext,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: TouchTarget.mobileMin,
    width: '100%',
    maxWidth: 320,
    borderRadius: 12,
    marginTop: 18,
    paddingHorizontal: 16,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    flexShrink: 1,
    fontWeight: '800',
  },
});
