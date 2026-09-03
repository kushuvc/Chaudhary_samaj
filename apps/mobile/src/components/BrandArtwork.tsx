import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop, Ellipse } from 'react-native-svg';

type BrandArtworkProps = {
  compact?: boolean;
};

export function BrandArtwork({ compact = false }: BrandArtworkProps) {
  const height = compact ? 100 : 148;

  return (
    <View style={[styles.wrap, { height }]}>
      <Svg width="100%" height="100%" viewBox="0 0 360 150" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#5B5BD6" />
            <Stop offset="0.5" stopColor="#7C4DDA" />
            <Stop offset="1" stopColor="#3D3B9E" />
          </LinearGradient>
          <LinearGradient id="shineGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.15" />
            <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="waveGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.1" />
            <Stop offset="0.5" stopColor="#ffffff" stopOpacity="0.15" />
            <Stop offset="1" stopColor="#ffffff" stopOpacity="0.05" />
          </LinearGradient>
        </Defs>

        {/* Background */}
        <Rect x="0" y="0" width="360" height="150" rx="20" fill="url(#bgGrad)" />

        {/* Shine overlay */}
        <Rect x="0" y="0" width="360" height="75" rx="20" fill="url(#shineGrad)" />

        {/* Decorative circles */}
        <Circle cx="320" cy="20" r="55" fill="#ffffff" fillOpacity="0.07" />
        <Circle cx="340" cy="90" r="35" fill="#ffffff" fillOpacity="0.05" />
        <Circle cx="30" cy="130" r="45" fill="#ffffff" fillOpacity="0.06" />
        <Circle cx="10" cy="30" r="20" fill="#ffffff" fillOpacity="0.10" />
        <Circle cx="180" cy="-10" r="40" fill="#ffffff" fillOpacity="0.05" />

        {/* Wave bottom */}
        <Path
          d="M0 105 C 60 85, 120 125, 180 100 C 240 75, 300 115, 360 95 L360 150 L0 150 Z"
          fill="url(#waveGrad)"
        />
        <Path
          d="M0 120 C 80 100, 160 140, 240 115 C 290 100, 330 118, 360 110 L360 150 L0 150 Z"
          fill="#ffffff"
          fillOpacity="0.06"
        />

        {/* Small accent dots */}
        <Circle cx="60" cy="55" r="4" fill="#ffffff" fillOpacity="0.3" />
        <Circle cx="80" cy="40" r="2.5" fill="#ffffff" fillOpacity="0.25" />
        <Circle cx="270" cy="130" r="5" fill="#ffffff" fillOpacity="0.2" />
        <Circle cx="240" cy="35" r="3" fill="#ffffff" fillOpacity="0.2" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
  },
});
