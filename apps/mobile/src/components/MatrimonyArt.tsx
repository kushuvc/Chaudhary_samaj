import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useReduceMotion } from './Motion';
import { radius, spacing } from '../theme';

/**
 * The illustrated banner that heads Home, Matrimony, Interests and Plans.
 *
 * Drawn as SVG rather than shipped as images: four screens' worth of artwork
 * would be megabytes of PNG that still needed a set per screen density, and
 * these have to sit on a gradient that changes with the theme. Vector costs
 * the bundle nothing and stays sharp on every phone.
 *
 * The motion is deliberately slow and small — a page where things race around
 * reads as broken rather than alive, and this sits behind text people are
 * trying to read. Everything animated here is decoration over content that is
 * already laid out, so reduce-motion simply renders the scene at rest and
 * nothing is lost.
 */

export type ArtScene = 'home' | 'matches' | 'interests' | 'plans';

/** A looping 0→1→0 value, used for drifting and twinkling. */
function useLoop(duration: number, delay = 0, enabled = true) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) {
      value.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value, duration, delay, enabled]);

  return value;
}

/** A heart that drifts upward and fades, on a loop. */
function FloatingHeart({
  left,
  size,
  delay,
  duration,
  opacity = 0.5,
  enabled,
}: {
  left: string;
  size: number;
  delay: number;
  duration: number;
  opacity?: number;
  enabled: boolean;
}) {
  const progress = useLoop(duration, delay, enabled);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: left as unknown as number,
        bottom: 8,
        opacity: enabled
          ? progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, opacity, 0] })
          : opacity * 0.7,
        transform: [
          {
            translateY: enabled
              ? progress.interpolate({ inputRange: [0, 1], outputRange: [0, -46] })
              : 0,
          },
          { scale: enabled ? progress.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) : 1 },
        ],
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 21s-7.5-4.9-9.4-9A5.2 5.2 0 0 1 12 6.6 5.2 5.2 0 0 1 21.4 12c-1.9 4.1-9.4 9-9.4 9z"
          fill="#FFFFFF"
        />
      </Svg>
    </Animated.View>
  );
}

/** A dot that twinkles in and out where the scene needs a little sparkle. */
function Sparkle({ left, top, size, delay, enabled }: { left: string; top: string; size: number; delay: number; enabled: boolean }) {
  const progress = useLoop(1100, delay, enabled);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: left as unknown as number,
        top: top as unknown as number,
        opacity: enabled ? progress.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.9] }) : 0.5,
        transform: [{ scale: enabled ? progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) : 0.85 }],
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" fill="#FFFFFF" />
      </Svg>
    </Animated.View>
  );
}

/** The two interlocking rings, rocking gently. Home and Plans both use them. */
function Rings({ enabled, size = 88 }: { enabled: boolean; size?: number }) {
  const progress = useLoop(3200, 0, enabled);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        transform: [
          {
            rotate: enabled
              ? progress.interpolate({ inputRange: [0, 1], outputRange: ['-7deg', '7deg'] })
              : '0deg',
          },
        ],
      }}
    >
      <Svg width={size} height={size * 0.62} viewBox="0 0 100 62">
        <Circle cx="38" cy="31" r="22" stroke="#FFFFFF" strokeOpacity="0.85" strokeWidth="4" fill="none" />
        <Circle cx="62" cy="31" r="22" stroke="#FFD98A" strokeOpacity="0.95" strokeWidth="4" fill="none" />
        {/* The little stone, so the pair reads as rings rather than two circles. */}
        <Path d="M62 5l4 5-4 5-4-5z" fill="#FFD98A" />
      </Svg>
    </Animated.View>
  );
}

/** Two profile cards leaning together, for the Matrimony tab. */
function CoupleCards({ enabled }: { enabled: boolean }) {
  const progress = useLoop(2600, 0, enabled);

  const lean = (from: string, to: string) =>
    enabled ? progress.interpolate({ inputRange: [0, 1], outputRange: [from, to] }) : '0deg';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }} pointerEvents="none">
      <Animated.View style={{ transform: [{ rotate: lean('-6deg', '-2deg') }] }}>
        <Svg width={42} height={54} viewBox="0 0 42 54">
          <Rect x="1" y="1" width="40" height="52" rx="9" fill="#FFFFFF" fillOpacity="0.92" />
          <Circle cx="21" cy="20" r="8" fill="#7C4DDA" fillOpacity="0.75" />
          <Path d="M8 46c0-7.2 5.8-13 13-13s13 5.8 13 13z" fill="#7C4DDA" fillOpacity="0.55" />
        </Svg>
      </Animated.View>

      <Animated.View
        style={{
          marginHorizontal: -6,
          zIndex: 2,
          transform: [{ scale: enabled ? progress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }) : 1 }],
        }}
      >
        <Svg width={26} height={26} viewBox="0 0 24 24">
          <Path
            d="M12 21s-7.5-4.9-9.4-9A5.2 5.2 0 0 1 12 6.6 5.2 5.2 0 0 1 21.4 12c-1.9 4.1-9.4 9-9.4 9z"
            fill="#FF7BA9"
          />
        </Svg>
      </Animated.View>

      <Animated.View style={{ transform: [{ rotate: lean('6deg', '2deg') }] }}>
        <Svg width={42} height={54} viewBox="0 0 42 54">
          <Rect x="1" y="1" width="40" height="52" rx="9" fill="#FFFFFF" fillOpacity="0.92" />
          <Circle cx="21" cy="20" r="8" fill="#FF7BA9" fillOpacity="0.8" />
          <Path d="M8 46c0-7.2 5.8-13 13-13s13 5.8 13 13z" fill="#FF7BA9" fillOpacity="0.55" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** An envelope with a heart lifting out of it, for the Interests tab. */
function InterestEnvelope({ enabled }: { enabled: boolean }) {
  const progress = useLoop(2200, 0, enabled);

  return (
    <View pointerEvents="none" style={{ alignItems: 'center', justifyContent: 'flex-end', height: 74 }}>
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          opacity: enabled ? progress.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 0.2] }) : 0.9,
          transform: [
            { translateY: enabled ? progress.interpolate({ inputRange: [0, 1], outputRange: [16, -6] }) : 0 },
            { scale: enabled ? progress.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }) : 0.95 },
          ],
        }}
      >
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path
            d="M12 21s-7.5-4.9-9.4-9A5.2 5.2 0 0 1 12 6.6 5.2 5.2 0 0 1 21.4 12c-1.9 4.1-9.4 9-9.4 9z"
            fill="#FF7BA9"
          />
        </Svg>
      </Animated.View>

      <Svg width={76} height={52} viewBox="0 0 76 52">
        <Rect x="1" y="6" width="74" height="45" rx="8" fill="#FFFFFF" fillOpacity="0.94" />
        <Path d="M1 14L38 34 75 14" stroke="#7C4DDA" strokeOpacity="0.55" strokeWidth="3" fill="none" />
      </Svg>
    </View>
  );
}

/** A key turning in front of a burst, for the Plans tab. */
function UnlockArt({ enabled }: { enabled: boolean }) {
  const progress = useLoop(2800, 0, enabled);

  return (
    <View pointerEvents="none" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          transform: [
            { rotate: enabled ? progress.interpolate({ inputRange: [0, 1], outputRange: ['-10deg', '10deg'] }) : '0deg' },
          ],
        }}
      >
        <Svg width={72} height={72} viewBox="0 0 72 72">
          {/* An open padlock: what a plan actually does. */}
          <Rect x="18" y="32" width="36" height="30" rx="7" fill="#FFFFFF" fillOpacity="0.94" />
          <Path
            d="M26 32V22a10 10 0 0 1 20 0"
            stroke="#FFD98A"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx="36" cy="45" r="4.5" fill="#7C4DDA" fillOpacity="0.8" />
          <Rect x="34" y="46" width="4" height="9" rx="2" fill="#7C4DDA" fillOpacity="0.8" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/**
 * The gradient panel every scene sits on, plus the soft shapes behind it.
 * Static: this is the backdrop, and moving it would fight the foreground.
 */
function Backdrop() {
  return (
    <Svg style={StyleSheet.absoluteFill as any} width="100%" height="100%" viewBox="0 0 360 140" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="artGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#5B5BD6" />
          <Stop offset="0.55" stopColor="#7C4DDA" />
          <Stop offset="1" stopColor="#3D3B9E" />
        </LinearGradient>
        <LinearGradient id="artShine" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
          <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="360" height="140" fill="url(#artGrad)" />
      <Rect x="0" y="0" width="360" height="70" fill="url(#artShine)" />
      <Circle cx="330" cy="18" r="56" fill="#ffffff" fillOpacity="0.06" />
      <Circle cx="24" cy="128" r="46" fill="#ffffff" fillOpacity="0.05" />
      <Ellipse cx="120" cy="150" rx="130" ry="34" fill="#ffffff" fillOpacity="0.04" />
      <G opacity="0.08">
        <Path d="M0 96C60 76 120 112 180 94c52-16 96 8 180-8v54H0z" fill="#ffffff" />
      </G>
    </Svg>
  );
}

/**
 * Just the moving parts, for laying over a gradient that already exists.
 *
 * Home already has a hero with its own artwork and greeting; giving it a
 * second banner would say the same thing twice. This brings the one it has
 * to life instead.
 */
export function HeroMotion({ ringsRight = 18, ringsTop = 26 }: { ringsRight?: number; ringsTop?: number }) {
  const alive = !useReduceMotion();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <FloatingHeart left="16%" size={13} delay={0} duration={2800} opacity={0.4} enabled={alive} />
      <FloatingHeart left="42%" size={9} delay={1000} duration={3200} opacity={0.3} enabled={alive} />
      <FloatingHeart left="70%" size={15} delay={500} duration={3000} opacity={0.32} enabled={alive} />

      <Sparkle left="88%" top="62%" size={8} delay={300} enabled={alive} />
      <Sparkle left="10%" top="20%" size={6} delay={1100} enabled={alive} />

      <View style={{ position: 'absolute', right: ringsRight, top: ringsTop }}>
        <Rings enabled={alive} size={76} />
      </View>
    </View>
  );
}

export function MatrimonyArt({
  scene,
  title,
  subtitle,
  height = 140,
  style,
}: {
  scene: ArtScene;
  title?: string;
  subtitle?: string;
  height?: number;
  style?: ViewStyle;
}) {
  const reduced = useReduceMotion();
  const alive = !reduced;
  const styles = useMemo(() => createStyles(), []);

  const figure =
    scene === 'matches' ? <CoupleCards enabled={alive} />
    : scene === 'interests' ? <InterestEnvelope enabled={alive} />
    : scene === 'plans' ? <UnlockArt enabled={alive} />
    : <Rings enabled={alive} />;

  return (
    <View style={[styles.wrap, { height }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Backdrop />

      {/* Hearts drift up the whole width, behind the figure and the words. */}
      <FloatingHeart left="12%" size={14} delay={0} duration={2600} opacity={0.45} enabled={alive} />
      <FloatingHeart left="34%" size={10} delay={900} duration={3000} opacity={0.35} enabled={alive} />
      <FloatingHeart left="78%" size={16} delay={450} duration={2800} opacity={0.4} enabled={alive} />

      <Sparkle left="86%" top="22%" size={9} delay={200} enabled={alive} />
      <Sparkle left="8%" top="30%" size={7} delay={800} enabled={alive} />
      <Sparkle left="60%" top="14%" size={6} delay={1400} enabled={alive} />

      <View style={styles.row}>
        {title || subtitle ? (
          <View style={styles.copy}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        ) : null}
        <View style={styles.figure}>{figure}</View>
      </View>
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    wrap: {
      borderRadius: radius.lg,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    copy: { flex: 1, gap: 4 },
    title: { fontSize: 19, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },
    /* White at full strength on this gradient is harsh under a heading, and
       these two lines are read together. */
    subtitle: { fontSize: 13.5, lineHeight: 19, color: 'rgba(255,255,255,0.88)' },
    figure: { alignItems: 'center', justifyContent: 'center' },
  });
}
