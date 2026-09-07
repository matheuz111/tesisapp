/**
 * CustomAlert — Diálogo de alerta estilizado que reemplaza Alert.alert nativo.
 *
 * Respeta el tema (oscuro/claro) de la app y muestra un borde de color
 * según el tipo de mensaje:
 *   - 'error'   → rojo
 *   - 'warning' → naranja
 *   - 'success' → verde
 *   - 'info'    → azul (primary del tema)
 *   - 'confirm' → naranja (acción destructiva)
 */

import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../src/context/ThemeContext';

export type AlertType = 'error' | 'warning' | 'success' | 'info' | 'confirm';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  /** 'default' | 'cancel' | 'destructive' */
  style?: 'default' | 'cancel' | 'destructive';
}

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message?: string;
  type?: AlertType;
  buttons?: AlertButton[];
  onRequestClose?: () => void;
}

const TYPE_COLORS: Record<AlertType, string> = {
  error: '#E53935',
  warning: '#E67E22',
  success: '#43A047',
  info: '#1E88E5',
  confirm: '#E67E22',
};

const TYPE_ICONS: Record<AlertType, string> = {
  error: '✕',
  warning: '⚠',
  success: '✓',
  info: 'ℹ',
  confirm: '?',
};

export default function CustomAlert({
  visible,
  title,
  message,
  type = 'info',
  buttons,
  onRequestClose,
}: CustomAlertProps) {
  const { colors } = useTheme();

  const accentColor = TYPE_COLORS[type];
  const icon = TYPE_ICONS[type];

  const resolvedButtons: AlertButton[] =
    buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      {/* Fondo oscuro semitransparente */}
      <Pressable style={styles.backdrop} onPress={onRequestClose}>
        {/* Contenedor del diálogo — detiene la propagación del press */}
        <Pressable
          style={[
            styles.dialog,
            {
              backgroundColor: colors.card,
              borderLeftColor: accentColor,
              // Sombra suave
              shadowColor: colors.shadow,
            },
          ]}
          onPress={() => {/* no-op: evita cerrar al tocar dentro */}}
        >
          {/* Encabezado con icono de color */}
          <View style={styles.titleRow}>
            <View style={[styles.iconBadge, { backgroundColor: `${accentColor}22` }]}>
              <Text style={[styles.iconText, { color: accentColor }]}>{icon}</Text>
            </View>
            <Text style={[styles.title, { color: colors.text, flexShrink: 1 }]}>{title}</Text>
          </View>

          {/* Mensaje opcional */}
          {!!message && (
            <Text style={[styles.message, { color: colors.subtext }]}>{message}</Text>
          )}

          {/* Botones */}
          <View style={[styles.buttonRow, resolvedButtons.length === 1 && styles.buttonRowSingle]}>
            {resolvedButtons.map((btn, index) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';
              const btnColor = isDestructive ? TYPE_COLORS.error : isCancel ? colors.subtext : accentColor;

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button,
                    resolvedButtons.length > 1 && styles.buttonFlex,
                    { borderColor: btnColor, backgroundColor: isDestructive ? `${btnColor}18` : 'transparent' },
                  ]}
                  onPress={() => {
                    btn.onPress?.();
                  }}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      { color: btnColor },
                      isCancel && styles.cancelText,
                    ]}
                  >
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Hook de ayuda para usar CustomAlert con estado ────────────────────────────
// Uso:
//   const { alertProps, showAlert } = useCustomAlert();
//   showAlert({ title: 'PIN Incorrecto ❌', message: '...', type: 'error' });
//   <CustomAlert {...alertProps} />

interface ShowAlertOptions {
  title: string;
  message?: string;
  type?: AlertType;
  buttons?: AlertButton[];
}

export function useCustomAlert() {
  const [alertProps, setAlertProps] = React.useState<{
    visible: boolean;
    title: string;
    message?: string;
    type?: AlertType;
    buttons?: AlertButton[];
  }>({ visible: false, title: '' });

  const showAlert = React.useCallback((options: ShowAlertOptions) => {
    setAlertProps({ visible: true, ...options });
  }, []);

  const hideAlert = React.useCallback(() => {
    setAlertProps((prev) => ({ ...prev, visible: false }));
  }, []);

  // Envuelve los botones para que siempre cierren el modal al presionar
  const propsWithClose = React.useMemo(() => ({
    ...alertProps,
    onRequestClose: hideAlert,
    buttons: alertProps.buttons?.map((btn) => ({
      ...btn,
      onPress: () => {
        hideAlert();
        btn.onPress?.();
      },
    })) ?? [{ text: 'OK', onPress: hideAlert }],
  }), [alertProps, hideAlert]);

  return { alertProps: propsWithClose, showAlert, hideAlert };
}

// ─── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    borderLeftWidth: 5,
    padding: 22,
    paddingBottom: 18,
    // Sombra iOS
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    // Elevación Android
    elevation: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: {
    fontSize: 17,
    fontWeight: '900',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
    marginLeft: 48, // alineado con el título (debajo del icono)
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  buttonRowSingle: {
    justifyContent: 'flex-end',
  },
  buttonFlex: {
    flex: 1,
  },
  button: {
    minWidth: 80,
    height: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonText: {
    fontWeight: '800',
    fontSize: 14,
  },
  cancelText: {
    fontWeight: '600',
  },
});
