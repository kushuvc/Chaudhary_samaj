import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

type BrandArtworkProps = {
  compact?: boolean;
};

export function BrandArtwork({ compact = false }: BrandArtworkProps) {
  const height = compact ? 92 : 138;

  return (
    <View style={[styles.wrap, { height }]}> 
      <Svg width="100%" height="100%" viewBox="0 0 360 150" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#0f766e" />
            <Stop offset="1" stopColor="#1d4ed8" />
          </LinearGradient>
          <LinearGradient id="soft" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#ecfeff" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#dbeafe" stopOpacity="0.12" />
          </LinearGradient>
        </Defs>

        <Rect x="0" y="0" width="360" height="150" rx="20" fill="url(#bg)" />
        <Path d="M0 112 C 76 76, 136 148, 236 106 C 276 88, 318 84, 360 96 L360 150 L0 150 Z" fill="url(#soft)" />
        <Circle cx="36" cy="30" r="18" fill="#ffffff" fillOpacity="0.18" />
        <Circle cx="324" cy="24" r="12" fill="#ffffff" fillOpacity="0.28" />
        <Circle cx="306" cy="120" r="28" fill="#ffffff" fillOpacity="0.12" />
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
