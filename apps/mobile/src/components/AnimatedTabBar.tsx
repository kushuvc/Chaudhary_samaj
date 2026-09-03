import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { GradientFill } from './ui';
import { radius } from '../theme';

/** Outline icon for the resting state, solid for the active state. */
export const TAB_ICONS: Record<string, { idle: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap }> = {
  Home: { idle: 'home-outline', active: 'home' },
  Matrimony: { idle: 'heart-outline', active: 'heart' },
  Interests: { idle: 'mail-outline', active: 'mail' },
  Messages: { idle: 'chatbubble-outline', active: 'chatbubble' },
  Subscriptions: { idle: 'card-outline', active: 'card' },
  Profile: { idle: 'person-outline', active: 'person' },
  Settings: { idle: 'settings-outline', active: 'settings' },
};

function TabItem({
  routeName,
  label,
  focused,
  onPress,
  onLongPress,
  palette,
}: {
  routeName: string;
  label: string;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  palette: ThemePalette;
}) {
  const styles = useMemo(() => createStyles(palette), [palette]);
  const icons = TAB_ICONS[routeName] ?? { idle: 'ellipse-outline', active: 'ellipse' };

  // Drives the whole active treatment: lift, glow opacity, label emphasis.
  const activeAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;
  // Separate press feedback so a tap still reacts on the already-active tab.
  const pressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(activeAnim, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 90,
    }).start();
  }, [focused, activeAnim]);

  const lift = activeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const pressScale = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] });
  const activeScale = activeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={styles.tabItem}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() =>
        Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true, friction: 6, tension: 220 }).start()
      }
      onPressOut={() =>
        Animated.spring(pressAnim, { toValue: 0, useNativeDriver: true, friction: 6, tension: 220 }).start()
      }
    >
      <Animated.View
        style={[
          styles.iconWrap,
          { transform: [{ translateY: lift }, { scale: Animated.multiply(activeScale, pressScale) }] },
        ]}
      >
        {/* Gradient glow sits behind the icon and fades in with focus. */}
        <Animated.View style={[styles.glow, { opacity: activeAnim }]}>
          <GradientFill colors={palette.gradient} borderRadius={radius.pill} />
        </Animated.View>

        <Ionicons
          name={focused ? icons.active : icons.idle}
          size={21}
          color={focused ? '#FFFFFF' : palette.muted}
        />
      </Animated.View>

      <Animated.Text
        numberOfLines={1}
        style={[
          styles.label,
          {
            color: focused ? palette.primary : palette.muted,
            opacity: activeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }),
          },
        ]}
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
}

export function AnimatedTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { palette, resolvedTheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View
      style={[
        styles.bar,
        {
          paddingBottom: Math.max(insets.bottom, 10),
          shadowOpacity: resolvedTheme === 'dark' ? 0.3 : 0.1,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : options.title ?? route.name;
        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TabItem
            key={route.key}
            routeName={route.name}
            label={String(label)}
            focused={focused}
            onPress={onPress}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            palette={palette}
          />
        );
      })}
    </View>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor: palette.tabBg,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      borderTopWidth: 1,
      borderTopColor: palette.border,
      // Room for the active pill's lift and scale so it is not clipped by the
      // bar's top edge or its rounded corners on the first/last tab.
      paddingTop: 13,
      paddingHorizontal: 6,
      shadowColor: '#1A1B4B',
      shadowRadius: 16,
      shadowOffset: { width: 0, height: -6 },
      elevation: 12,
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 3,
      paddingHorizontal: 2,
    },
    iconWrap: {
      width: 38,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
    },
    glow: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: radius.pill,
      // Lifts the active icon off the bar rather than sitting flat on it.
      shadowColor: palette.primary,
      shadowOpacity: 0.5,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: Platform.OS === 'android' ? 6 : 0,
    },
    label: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.1,
    },
  });
}
