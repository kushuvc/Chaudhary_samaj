import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import type { PressableProps, ViewStyle } from 'react-native';

/**
 * Small motion helpers, built on React Native's own Animated.
 *
 * Deliberately not a new dependency: the tab bar already animates with
 * Animated, so this matches it and adds nothing to the bundle or the build.
 *
 * Every animation here is decoration over content that is already laid out —
 * nothing waits on an animation to become readable, so a dropped frame or a
 * reduce-motion setting costs the member nothing.
 */

/** True when the OS asks for reduced motion. */
export function useReduceMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => alive && setReduced(value))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);

  return reduced;
}

/**
 * Fades and lifts its children in once, on mount.
 *
 * `index` staggers a list so rows arrive in sequence rather than as one block;
 * the delay is capped so the last card in a long list is not left waiting.
 */
export function FadeInView({
  children,
  index = 0,
  duration = 320,
  offset = 14,
  style,
}: {
  children: React.ReactNode;
  index?: number;
  duration?: number;
  offset?: number;
  style?: ViewStyle | ViewStyle[];
}) {
  const reduced = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay: Math.min(index, 8) * 55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced, index, duration]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * A Pressable that dips slightly while held.
 *
 * Gives a tile the same "this is a button" feedback the tab bar has, without
 * every caller wiring its own Animated.Value.
 */
export function PressableScale({
  children,
  style,
  scaleTo = 0.96,
  ...rest
}: PressableProps & { children: React.ReactNode; style?: ViewStyle | ViewStyle[]; scaleTo?: number }) {
  const reduced = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const to = (value: number) =>
    Animated.spring(scale, { toValue: value, useNativeDriver: true, friction: 6, tension: 260 }).start();

  /*
   * How the button sits in its row belongs on the Pressable, not the inner
   * view. With flex: 1 only on the inner view, the Pressable sized itself to
   * its content and the inner view had no room to grow into — buttons that
   * were meant to share a row equally came out as narrow, collapsed boxes.
   */
  const flat = (StyleSheet.flatten(style) || {}) as ViewStyle;
  const {
    flex, flexGrow, flexShrink, flexBasis, alignSelf, width, minWidth, maxWidth,
    margin, marginHorizontal, marginVertical, marginTop, marginBottom, marginLeft, marginRight,
    position, top, bottom, left, right, zIndex,
    ...inner
  } = flat;
  const outer: ViewStyle = {
    flex, flexGrow, flexShrink, flexBasis, alignSelf, width, minWidth, maxWidth,
    margin, marginHorizontal, marginVertical, marginTop, marginBottom, marginLeft, marginRight,
    position, top, bottom, left, right, zIndex,
  };
  const fills = flex !== undefined || flexGrow !== undefined || width !== undefined;

  return (
    <Pressable
      {...rest}
      style={outer}
      onPressIn={(event) => {
        if (!reduced) to(scaleTo);
        rest.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (!reduced) to(1);
        rest.onPressOut?.(event);
      }}
    >
      <Animated.View style={[inner, fills && { flexGrow: 1 }, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/**
 * A slow, looping pulse for a single decorative accent.
 *
 * Used once per screen at most: a page where several things breathe at once
 * reads as broken rather than alive.
 */
export function Pulse({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const reduced = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, reduced]);

  if (reduced) return <View style={style}>{children}</View>;

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }],
          opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }),
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
