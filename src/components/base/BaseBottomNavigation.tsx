import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { BaseColors, BaseTypography } from './BaseTokens';
import { NotificationBadge, HintBadge } from './BaseBadge';

export interface TabItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon?: keyof typeof Ionicons.glyphMap;
  badgeCount?: number;
  hasDot?: boolean;
}

export interface BaseBottomNavigationProps {
  tabs: TabItem[];
  activeTab: string;
  onTabPress: (tabId: string) => void;
  style?: ViewStyle;
}

export const BaseBottomNavigation: React.FC<BaseBottomNavigationProps> = ({
  tabs,
  activeTab,
  onTabPress,
  style,
}) => {
  const insets = useSafeAreaInsets();

  const handlePress = (tabId: string) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // ignore
    }
    onTabPress(tabId);
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, 10),
          height: 64 + Math.max(insets.bottom, 10),
        },
        style,
      ]}
    >
      <View style={styles.tabsRow}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const currentIcon = isActive && tab.activeIcon ? tab.activeIcon : tab.icon;
          const tintColor = isActive ? BaseColors.accent : BaseColors.gray500;

          return (
            <Pressable
              key={tab.id}
              onPress={() => handlePress(tab.id)}
              style={styles.tabButton}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
            >
              {/* Active indicator bar */}
              <View
                style={[
                  styles.activeIndicator,
                  { backgroundColor: isActive ? BaseColors.accent : 'transparent' },
                ]}
              />

              <View style={styles.iconContainer}>
                <Ionicons name={currentIcon} size={22} color={tintColor} />

                {Boolean(tab.badgeCount && tab.badgeCount > 0) && (
                  <View style={styles.badgeWrapper}>
                    <NotificationBadge count={tab.badgeCount} size="sm" />
                  </View>
                )}

                {Boolean(tab.hasDot && (!tab.badgeCount || tab.badgeCount <= 0)) && (
                  <View style={styles.dotWrapper}>
                    <HintBadge status="positive" size={7} />
                  </View>
                )}
              </View>

              <Text
                style={[
                  styles.label,
                  {
                    color: tintColor,
                    fontWeight: isActive
                      ? BaseTypography.weights.bold
                      : BaseTypography.weights.medium,
                  },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: BaseColors.white,
    borderTopWidth: 1,
    borderTopColor: BaseColors.gray200,
    width: '100%',
  },
  tabsRow: {
    flexDirection: 'row',
    height: 64,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 4,
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    width: 32,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
  },
  badgeWrapper: {
    position: 'absolute',
    top: -4,
    right: -10,
  },
  dotWrapper: {
    position: 'absolute',
    top: 0,
    right: -3,
  },
  label: {
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
