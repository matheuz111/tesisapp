import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme, type ThemeColors } from '../../context/ThemeContext';
import { SemanticColors } from '../../theme/tokens';
import { AnimatedPressable } from '../AnimatedPressable';

export type ServiceType = 'WITH_QUOTE' | 'SIMPLE';

type Props = {
  value: ServiceType;
  onChange: (value: ServiceType) => void;
};

/** Selector de modalidad: con cotización formal o atención simple con tarifa de visita. */
export function ServiceModeSelector({ value: serviceType, onChange: setServiceType }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Modalidad del Servicio</Text>
          </View>
          <View style={styles.serviceModeGrid}>
            <AnimatedPressable
              onPress={() => setServiceType('WITH_QUOTE')}
              scaleTo={0.97}
              style={[
                styles.serviceModeCard,
                {
                  borderColor: serviceType === 'WITH_QUOTE' ? SemanticColors.primary.main : colors.border,
                  backgroundColor: serviceType === 'WITH_QUOTE' ? colors.primarySoft : colors.card,
                },
              ]}
            >
              <View style={styles.modeCardHeader}>
                <View style={[styles.modeIconCircle, { backgroundColor: serviceType === 'WITH_QUOTE' ? colors.primaryStrong : colors.input }]}>
                  <Ionicons name="document-text" size={20} color={serviceType === 'WITH_QUOTE' ? SemanticColors.primary.main : colors.subtext} />
                </View>
                {serviceType === 'WITH_QUOTE' ? (
                  <View style={styles.activeCheckPill}>
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
              <Text style={[styles.modeTitle, { color: serviceType === 'WITH_QUOTE' ? SemanticColors.primary.main : colors.text }]}>
                Con Cotización
              </Text>
              <Text style={[styles.modeSubtitle, { color: colors.subtext }]}>
                Visita técnica con presupuesto formal previo antes de asignar la cuadrilla.
              </Text>
            </AnimatedPressable>
      
            <AnimatedPressable
              onPress={() => setServiceType('SIMPLE')}
              scaleTo={0.97}
              style={[
                styles.serviceModeCard,
                {
                  borderColor: serviceType === 'SIMPLE' ? SemanticColors.primary.main : colors.border,
                  backgroundColor: serviceType === 'SIMPLE' ? colors.primarySoft : colors.card,
                },
              ]}
            >
              <View style={styles.modeCardHeader}>
                <View style={[styles.modeIconCircle, { backgroundColor: serviceType === 'SIMPLE' ? colors.primaryStrong : colors.input }]}>
                  <Ionicons name="flash" size={20} color={serviceType === 'SIMPLE' ? SemanticColors.primary.main : colors.subtext} />
                </View>
                {serviceType === 'SIMPLE' ? (
                  <View style={styles.activeCheckPill}>
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
              <Text style={[styles.modeTitle, { color: serviceType === 'SIMPLE' ? SemanticColors.primary.main : colors.text }]}>
                Atención Simple
              </Text>
              <Text style={[styles.modeSubtitle, { color: colors.subtext }]}>
                Inspección y labor directa con tarifa regulada de visita técnica.
              </Text>
            </AnimatedPressable>
          </View>
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  sectionHeaderRow: {
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    flexShrink: 1,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  serviceModeGrid: {
    flexDirection: 'row',
    flexShrink: 1,
    gap: 10,
    marginBottom: 18,
  },
  serviceModeCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  modeCardHeader: {
    flexDirection: 'row',
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modeIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCheckPill: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0369A1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTitle: {
    fontSize: 14,
    flexShrink: 1,
    fontWeight: '800',
    marginBottom: 4,
  },
  modeSubtitle: {
    fontSize: 11,
    flexShrink: 1,
    lineHeight: 15,
  },
});
