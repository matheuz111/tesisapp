import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BaseColors, BaseRadii, BaseTypography } from './BaseTokens';
import { BaseBottomSheet } from './BaseBottomSheet';
import { BaseTag } from './BaseBadge';
import { COMPLETE_DISTRICTS_CATALOG, type DistrictOption } from '../../config/operationalConfig';

export interface BaseDistrictPickerProps {
  label?: string;
  selectedDistrict: string;
  onSelectDistrict: (districtName: string, zone?: string) => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
  containerStyle?: ViewStyle;
  disabled?: boolean;
}

const ZONE_FILTERS = [
  { id: 'TODOS', label: 'Todos (50)' },
  { id: 'LIMA_CENTRO', label: 'Centro' },
  { id: 'LIMA_NORTE', label: 'Norte' },
  { id: 'LIMA_SUR', label: 'Sur' },
  { id: 'LIMA_ESTE', label: 'Este' },
  { id: 'CALLAO', label: 'Callao' },
];

export const BaseDistrictPicker: React.FC<BaseDistrictPickerProps> = ({
  label = 'Distrito (Lima / Callao)',
  selectedDistrict,
  onSelectDistrict,
  placeholder = 'Selecciona un distrito...',
  error,
  helperText,
  containerStyle,
  disabled = false,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('TODOS');

  const filteredDistricts = useMemo(() => {
    let list = COMPLETE_DISTRICTS_CATALOG;
    if (selectedZoneFilter !== 'TODOS') {
      list = list.filter((d) => d.zone === selectedZoneFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.zoneName.toLowerCase().includes(q) ||
          d.code.toLowerCase().includes(q)
      );
    }
    return list;
  }, [searchQuery, selectedZoneFilter]);

  const handleSelect = (district: DistrictOption) => {
    try {
      void Haptics.selectionAsync();
    } catch {
      // ignore
    }
    onSelectDistrict(district.name, district.zone);
    setModalVisible(false);
    setSearchQuery('');
  };

  const borderColor = error
    ? BaseColors.negative
    : modalVisible
    ? BaseColors.accent
    : BaseColors.gray300;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {Boolean(label) && (
        <Text style={[styles.label, error && { color: BaseColors.negative }]}>
          {label}
        </Text>
      )}

      {/* Selector Trigger Button */}
      <Pressable
        onPress={() => !disabled && setModalVisible(true)}
        disabled={disabled}
        style={({ pressed }) => [
          styles.triggerContainer,
          {
            borderColor,
            borderWidth: modalVisible || error ? 1.5 : 1,
            backgroundColor: disabled ? BaseColors.gray100 : pressed ? BaseColors.gray50 : BaseColors.white,
          },
        ]}
        accessibilityRole="combobox"
        accessibilityLabel={label}
        accessibilityState={{ expanded: modalVisible }}
      >
        <Ionicons
          name="location-outline"
          size={18}
          color={selectedDistrict ? BaseColors.accent : BaseColors.gray400}
          style={styles.leftIcon}
        />

        <Text
          style={[
            styles.triggerText,
            !selectedDistrict && { color: BaseColors.gray400 },
          ]}
          numberOfLines={1}
        >
          {selectedDistrict || placeholder}
        </Text>

        <View style={styles.chevronWrap}>
          <Ionicons name="chevron-down" size={18} color={BaseColors.gray500} />
        </View>
      </Pressable>

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

      {/* Modal Bottom Sheet con Buscador y Filtros */}
      <BaseBottomSheet
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setSearchQuery('');
        }}
        title="Distritos de Lima y Callao"
        subtitle="Selecciona tu distrito para coordinar tu servicio técnico"
      >
        <View style={styles.sheetContent}>
          {/* Campo de búsqueda interactivo */}
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color={BaseColors.gray400} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por distrito o zona..."
              placeholderTextColor={BaseColors.gray400}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {Boolean(searchQuery) && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={BaseColors.gray400} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filtros rápidos por zona */}
          <View style={styles.zonesFilterRow}>
            {ZONE_FILTERS.map((z) => {
              const isSelected = selectedZoneFilter === z.id;
              return (
                <TouchableOpacity
                  key={z.id}
                  onPress={() => setSelectedZoneFilter(z.id)}
                  style={[
                    styles.zoneChip,
                    isSelected && styles.zoneChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.zoneChipText,
                      isSelected && styles.zoneChipTextActive,
                    ]}
                  >
                    {z.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Lista de Distritos (50 distritos de Lima y Callao) */}
          <FlatList
            data={filteredDistricts}
            keyExtractor={(item) => item.code}
            style={styles.districtsList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isChosen =
                selectedDistrict.toLowerCase() === item.name.toLowerCase() ||
                selectedDistrict.toLowerCase() === item.code.toLowerCase();

              return (
                <TouchableOpacity
                  onPress={() => handleSelect(item)}
                  style={[
                    styles.districtItem,
                    isChosen && styles.districtItemChosen,
                  ]}
                >
                  <View style={styles.districtInfo}>
                    <Text
                      style={[
                        styles.districtName,
                        isChosen && { color: BaseColors.accent, fontWeight: '700' },
                      ]}
                    >
                      {item.name}
                    </Text>
                    <BaseTag
                      label={item.zoneName}
                      variant="neutral"
                      size="sm"
                      style={{ marginTop: 2 }}
                    />
                  </View>

                  {isChosen ? (
                    <Ionicons name="checkmark-circle" size={20} color={BaseColors.accent} />
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={BaseColors.gray300} />
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="search" size={32} color={BaseColors.gray400} />
                <Text style={styles.emptyText}>
                  No se encontraron distritos para "{searchQuery}".
                </Text>
              </View>
            }
          />
        </View>
      </BaseBottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
  },
  label: {
    fontSize: BaseTypography.sizes.xs,
    fontWeight: BaseTypography.weights.medium,
    color: BaseColors.gray700,
    marginBottom: 6,
    includeFontPadding: false,
  },
  triggerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BaseRadii.md,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  leftIcon: {
    marginRight: 10,
  },
  triggerText: {
    flex: 1,
    fontSize: BaseTypography.sizes.base,
    color: BaseColors.gray900,
    includeFontPadding: false,
  },
  chevronWrap: {
    marginLeft: 6,
  },
  helperText: {
    fontSize: 11,
    marginTop: 4,
    lineHeight: 14,
  },
  sheetContent: {
    maxHeight: 450,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BaseColors.gray100,
    borderRadius: BaseRadii.md,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BaseColors.gray200,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: BaseColors.gray900,
    marginLeft: 8,
    includeFontPadding: false,
  },
  zonesFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  zoneChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BaseRadii.full,
    backgroundColor: BaseColors.gray100,
    borderWidth: 1,
    borderColor: BaseColors.gray200,
  },
  zoneChipActive: {
    backgroundColor: BaseColors.accentLight,
    borderColor: '#BAE6FD',
  },
  zoneChipText: {
    fontSize: 11,
    color: BaseColors.gray600,
    fontWeight: BaseTypography.weights.medium,
  },
  zoneChipTextActive: {
    color: BaseColors.accent,
    fontWeight: BaseTypography.weights.bold,
  },
  districtsList: {
    maxHeight: 320,
  },
  districtItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: BaseColors.gray100,
  },
  districtItemChosen: {
    backgroundColor: '#F0F9FF',
    borderRadius: BaseRadii.md,
    paddingHorizontal: 10,
  },
  districtInfo: {
    flex: 1,
    marginRight: 10,
  },
  districtName: {
    fontSize: BaseTypography.sizes.sm,
    fontWeight: BaseTypography.weights.semiBold,
    color: BaseColors.gray900,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    fontSize: 13,
    color: BaseColors.gray500,
    marginTop: 8,
    textAlign: 'center',
  },
});
