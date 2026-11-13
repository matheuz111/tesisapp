import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme, type ThemeColors } from '../../context/ThemeContext';
import { SemanticColors } from '../../theme/tokens';
import { AnimatedPressable } from '../AnimatedPressable';

type Specialty = { id: string; label: string; icon: string };

type Props = {
  items: readonly Specialty[];
  selectedId: string;
  onSelect: (id: string) => void;
};

/** Grilla de especialidades técnicas (fontanería, electricidad, etc.). */
export function SpecialtyGrid({ items: SERVICES, selectedId: service, onSelect: setService }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>¿En qué área requieres apoyo?</Text>
          </View>
          <View style={styles.specialtyGrid}>
            {SERVICES.map((item) => {
              const isSelected = service === item.id;
              return (
                <AnimatedPressable
                  key={item.id}
                  onPress={() => setService(item.id)}
                  scaleTo={0.96}
                  style={[
                    styles.specialtyCard,
                    {
                      backgroundColor: isSelected ? colors.primarySoft : colors.card,
                      borderColor: isSelected ? SemanticColors.primary.main : colors.border,
                    },
                  ]}
                >
                  <View style={[styles.specialtyIconWrap, { backgroundColor: isSelected ? colors.primaryStrong : colors.background }]}>
                    <Ionicons
                      name={item.icon as any}
                      size={24}
                      color={isSelected ? SemanticColors.primary.main : colors.text}
                    />
                  </View>
                  <Text style={[styles.specialtyLabel, { color: isSelected ? SemanticColors.primary.main : colors.text }]}>
                    {item.label}
                  </Text>
                </AnimatedPressable>
              );
            })}
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
  specialtyGrid: {
    flexDirection: 'row',
    flexShrink: 1,
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  specialtyCard: {
    width: '48.5%',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 64,
  },
  specialtyIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specialtyLabel: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
});
