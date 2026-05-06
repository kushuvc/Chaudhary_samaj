import React, { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { useAppLanguage } from '../context/LanguageContext';
import { BrandArtwork } from '../components/BrandArtwork';

interface WelcomeScreenProps {
  onCreateProfile: () => void;
  onLogin: () => void;
}

export function WelcomeScreen({ onCreateProfile, onLogin }: WelcomeScreenProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { t } = useAppLanguage();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Hero Image Grid */}
      <View style={styles.heroContainer}>
        <View style={styles.imageGrid}>
          <View style={styles.imageRow}>
            <View style={[styles.imagePlaceholder, styles.imageSmall]} />
            <View style={[styles.imagePlaceholder, styles.imageMedium]} />
            <View style={[styles.imagePlaceholder, styles.imageSmall]} />
          </View>
          <View style={styles.imageRow}>
            <View style={[styles.imagePlaceholder, styles.imageMedium]} />
            <View style={[styles.imagePlaceholder, styles.imageLarge]} />
            <View style={[styles.imagePlaceholder, styles.imageMedium]} />
          </View>
          <View style={styles.imageRow}>
            <View style={[styles.imagePlaceholder, styles.imageSmall]} />
            <View style={[styles.imagePlaceholder, styles.imageMedium]} />
            <View style={[styles.imagePlaceholder, styles.imageSmall]} />
          </View>
        </View>
        
        {/* Curved Overlay */}
        <View style={styles.curveOverlay}>
          <BrandArtwork compact />
        </View>
      </View>

      {/* Title Section */}
      <View style={styles.titleSection}>
        <Text style={styles.brandName}>Chaudhary Samaj</Text>
        <Text style={styles.tagline}>
          No. 1 and the most trusted matrimony{'\n'}service for Chaudhary community
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionSection}>
        <Text style={styles.newUserText}>New user?</Text>
        
        <Pressable style={styles.primaryButton} onPress={onCreateProfile}>
          <Text style={styles.primaryButtonText}>Create profile</Text>
        </Pressable>

        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Already registered?</Text>
          <Pressable style={styles.loginButton} onPress={onLogin}>
            <Text style={styles.loginButtonText}>Login</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.bg,
    },
    content: {
      flexGrow: 1,
      paddingBottom: 40,
    },
    heroContainer: {
      position: 'relative',
      backgroundColor: '#E53935',
      borderBottomLeftRadius: 40,
      borderBottomRightRadius: 40,
      overflow: 'hidden',
      paddingTop: 20,
      paddingBottom: 60,
    },
    imageGrid: {
      paddingHorizontal: 12,
      gap: 8,
    },
    imageRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 8,
      justifyContent: 'center',
    },
    imagePlaceholder: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 8,
    },
    imageSmall: {
      width: 80,
      height: 80,
    },
    imageMedium: {
      width: 100,
      height: 100,
    },
    imageLarge: {
      width: 120,
      height: 120,
    },
    curveOverlay: {
      position: 'absolute',
      bottom: -30,
      alignSelf: 'center',
      width: 80,
      height: 80,
      backgroundColor: palette.bg,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
    },
    titleSection: {
      alignItems: 'center',
      marginTop: 50,
      paddingHorizontal: 24,
    },
    brandName: {
      fontSize: 24,
      fontWeight: '700',
      color: palette.text,
      marginBottom: 12,
    },
    tagline: {
      fontSize: 14,
      color: palette.muted,
      textAlign: 'center',
      lineHeight: 20,
    },
    actionSection: {
      marginTop: 40,
      paddingHorizontal: 24,
    },
    newUserText: {
      fontSize: 14,
      color: palette.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    primaryButton: {
      backgroundColor: '#E53935',
      borderRadius: 28,
      paddingVertical: 16,
      alignItems: 'center',
      shadowColor: '#E53935',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    dividerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 24,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: palette.border,
    },
    dividerText: {
      marginHorizontal: 16,
      fontSize: 14,
      color: palette.muted,
    },
    loginRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    loginText: {
      fontSize: 14,
      color: palette.text,
    },
    loginButton: {
      borderWidth: 1.5,
      borderColor: '#E53935',
      borderRadius: 20,
      paddingVertical: 8,
      paddingHorizontal: 24,
    },
    loginButtonText: {
      color: '#E53935',
      fontSize: 14,
      fontWeight: '600',
    },
  });
}
