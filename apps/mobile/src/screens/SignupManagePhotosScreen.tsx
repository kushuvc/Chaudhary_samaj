import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, type ThemePalette } from '../context/ThemeContext';
import { PrimaryButton, SectionHeading, StepScaffold, TextButton } from '../components/ui';
import { api } from '../services/api';
import { useAppLanguage } from '../context/LanguageContext';

export interface Photo {
  id: string;
  uri: string;        // remote URL after upload
  localUri?: string;  // local URI while uploading
  isPrimary: boolean;
  status: 'uploading' | 'done' | 'error';
}

interface SignupManagePhotosScreenProps {
  onBack: () => void;
  onComplete: (photos: Photo[]) => void;
}

/* Must match MAX_PROFILE_PHOTOS on the server, which trims anything above it. */
const MAX_PHOTOS = 2;

const benefits = [
  { icon: 'eye-outline' as const, textKey: 'suPhotoBenefit1' },
  { icon: 'lock-closed-outline' as const, textKey: 'suPhotoBenefit2' },
];

export function SignupManagePhotosScreen({ onBack, onComplete }: SignupManagePhotosScreenProps) {
  const { t } = useAppLanguage();
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [photos, setPhotos] = useState<Photo[]>([]);

  const pickAndUpload = async () => {
    if (photos.length >= MAX_PHOTOS) {
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('permNeeded'), t('permPhotoLibrary'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
      allowsEditing: true,
      aspect: [3, 4],
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];
    const tempId = Date.now().toString();
    setPhotos((prev) => [
      ...prev,
      { id: tempId, uri: '', localUri: asset.uri, isPrimary: prev.length === 0, status: 'uploading' },
    ]);

    try {
      const remoteUrl = await api.uploadPhoto(asset.uri);
      setPhotos((prev) => prev.map((p) => (p.id === tempId ? { ...p, uri: remoteUrl, status: 'done' } : p)));
    } catch (err: any) {
      Alert.alert(t('phUploadFailed'), err?.message || t('suPhotoUploadFailed'));
      setPhotos((prev) => prev.filter((p) => p.id !== tempId));
    }
  };

  const removePhoto = async (id: string) => {
    const photo = photos.find((p) => p.id === id);
    if (!photo) {
      return;
    }
    setPhotos((prev) => {
      const next = prev.filter((p) => p.id !== id);
      // Keep exactly one primary photo after a removal.
      if (next.length > 0 && !next.some((p) => p.isPrimary)) {
        return next.map((p, index) => (index === 0 ? { ...p, isPrimary: true } : p));
      }
      return next;
    });
    if (photo.uri) {
      try {
        await api.deletePhoto(photo.uri);
      } catch {}
    }
  };

  const setPrimary = (id: string) => {
    setPhotos((prev) => prev.map((p) => ({ ...p, isPrimary: p.id === id })));
  };

  const uploaded = photos.filter((p) => p.status === 'done');

  return (
    <StepScaffold
      onBack={onBack}
      eyebrow={t('suPhotos')}
      title={t('suAddAPhoto')}
      subtitle={t('suProfilesWithAClearPhotoGet')}
      footer={
        <>
          <PrimaryButton
            label={uploaded.length > 0 ? t('suContinueWithPhotos', { count: uploaded.length }) : t('actAddPhoto')}
            onPress={uploaded.length > 0 ? () => onComplete(uploaded) : pickAndUpload}
          />
          <TextButton label={t('suILlDoThisLater')} onPress={() => onComplete(uploaded)} />
        </>
      }
    >
      <View style={styles.benefits}>
        {benefits.map((item) => (
          <View key={item.textKey} style={styles.benefitRow}>
            <View style={styles.benefitIcon}>
              <Ionicons name={item.icon} size={16} color={palette.primary} />
            </View>
            <Text style={styles.benefitText}>{t(item.textKey)}</Text>
          </View>
        ))}
      </View>

      <SectionHeading
        title={t('suYourPhotos')}
        caption={photos.length > 0 ? t('suTapPhotoMain') : undefined}
      />

      <View style={styles.grid}>
        {photos.map((photo) => (
          <Pressable
            key={photo.id}
            style={[styles.tile, photo.isPrimary && styles.tilePrimary]}
            onPress={() => photo.status === 'done' && setPrimary(photo.id)}
          >
            <Image source={{ uri: photo.uri || photo.localUri }} style={styles.tileImage} />

            {photo.status === 'uploading' ? (
              <View style={styles.tileOverlay}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : null}

            {photo.isPrimary && photo.status === 'done' ? (
              <View style={styles.primaryBadge}>
                <Text style={styles.primaryBadgeText}>{t('lblMainPhoto')}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityLabel={t('suRemovePhoto')}
              style={styles.removeButton}
              onPress={() => removePhoto(photo.id)}
              hitSlop={6}
            >
              <Ionicons name="close" size={14} color="#FFFFFF" />
            </Pressable>
          </Pressable>
        ))}

        {photos.length < MAX_PHOTOS ? (
          <Pressable style={styles.addTile} onPress={pickAndUpload}>
            <Ionicons name="add" size={26} color={palette.primary} />
            <Text style={styles.addTileText}>{t('suAddPhoto')}</Text>
          </Pressable>
        ) : null}
      </View>
    </StepScaffold>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    benefits: {
      gap: 12,
      backgroundColor: palette.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: palette.border,
    },
    benefitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    benefitIcon: {
      width: 32,
      height: 32,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.primarySoft,
    },
    benefitText: {
      flex: 1,
      fontSize: 13.5,
      color: palette.textSoft,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    tile: {
      width: 104,
      height: 138,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: palette.surfaceSunken,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    tilePrimary: {
      borderColor: palette.primary,
    },
    tileImage: {
      width: '100%',
      height: '100%',
    },
    tileOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(10,11,20,0.45)',
    },
    primaryBadge: {
      position: 'absolute',
      left: 8,
      bottom: 8,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: palette.primary,
    },
    primaryBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    removeButton: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(10,11,20,0.6)',
    },
    addTile: {
      width: 104,
      height: 138,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: palette.borderStrong,
      backgroundColor: palette.surface,
    },
    addTileText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: palette.primary,
    },
  });
}
