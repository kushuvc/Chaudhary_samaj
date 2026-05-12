import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';

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

export function SignupManagePhotosScreen({ onBack, onComplete }: SignupManagePhotosScreenProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [photos, setPhotos] = useState<Photo[]>([]);

  const pickAndUpload = async () => {
    if (photos.length >= 6) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
      allowsEditing: true,
      aspect: [3, 4],
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const tempId = Date.now().toString();
    const newPhoto: Photo = {
      id: tempId,
      uri: '',
      localUri: asset.uri,
      isPrimary: photos.length === 0,
      status: 'uploading',
    };
    setPhotos((prev) => [...prev, newPhoto]);

    try {
      const remoteUrl = await api.uploadPhoto(asset.uri);
      setPhotos((prev) =>
        prev.map((p) => p.id === tempId ? { ...p, uri: remoteUrl, status: 'done' } : p)
      );
    } catch (err: any) {
      Alert.alert('Upload failed', err.message || 'Could not upload photo');
      setPhotos((prev) => prev.filter((p) => p.id !== tempId));
    }
  };

  const removePhoto = async (id: string) => {
    const photo = photos.find((p) => p.id === id);
    if (!photo) return;
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    // Ensure another photo becomes primary
    setPhotos((prev) => {
      if (prev.length > 0 && !prev.some((p) => p.isPrimary)) {
        return prev.map((p, i) => i === 0 ? { ...p, isPrimary: true } : p);
      }
      return prev;
    });
    if (photo.uri) {
      try { await api.deletePhoto(photo.uri); } catch {}
    }
  };

  const setPrimary = (id: string) => {
    setPhotos((prev) => prev.map((p) => ({ ...p, isPrimary: p.id === id })));
  };

  const hasUploadedPhotos = photos.some((p) => p.status === 'done');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Manage Photos</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <Text style={styles.subtitle}>
          Tap + to add photos. First photo will be your profile photo. Up to 6 photos.
        </Text>

        {/* Photos Grid */}
        <View style={styles.photosGrid}>
          {photos.map((photo) => {
            const displayUri = photo.localUri || photo.uri;
            return (
              <View key={photo.id} style={styles.photoContainer}>
                {photo.isPrimary && (
                  <View style={styles.primaryBadge}>
                    <Text style={styles.primaryText}>Profile Photo</Text>
                  </View>
                )}

                <View style={[styles.photoBox, photo.status === 'done' && styles.photoBoxDone]}>
                  {displayUri ? (
                    <Image source={{ uri: displayUri }} style={styles.photoImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.placeholderContent}>
                      <Ionicons name="person" size={40} color="#CCCCCC" />
                    </View>
                  )}
                  {photo.status === 'uploading' && (
                    <View style={styles.uploadOverlay}>
                      <ActivityIndicator size="large" color="#FFFFFF" />
                      <Text style={styles.uploadingText}>Uploading...</Text>
                    </View>
                  )}
                </View>

                {/* Remove button */}
                <Pressable style={styles.removeButton} onPress={() => removePhoto(photo.id)}>
                  <Ionicons name="close" size={16} color="#FFFFFF" />
                </Pressable>

                {/* Set primary button */}
                {!photo.isPrimary && photo.status === 'done' && (
                  <Pressable style={styles.setPrimaryButton} onPress={() => setPrimary(photo.id)}>
                    <Text style={styles.setPrimaryText}>Set as Profile</Text>
                  </Pressable>
                )}
              </View>
            );
          })}

          {/* Add Photo Button */}
          {photos.length < 6 && (
            <Pressable style={styles.addPhotoButton} onPress={pickAndUpload}>
              <View style={styles.addPhotoIcon}>
                <Ionicons name="add" size={32} color="#E53935" />
              </View>
              <Text style={styles.addPhotoText}>Add Photo</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.completeButton, !hasUploadedPhotos && styles.completeButtonDisabled]}
          onPress={() => hasUploadedPhotos && onComplete(photos.filter((p) => p.status === 'done'))}
          disabled={!hasUploadedPhotos}
        >
          <Text style={styles.completeButtonText}>
            {hasUploadedPhotos ? `Continue (${photos.filter(p => p.status === 'done').length} photo${photos.filter(p => p.status === 'done').length > 1 ? 's' : ''})` : 'Add at least one photo'}
          </Text>
        </Pressable>
        <Pressable style={styles.skipButton} onPress={() => onComplete([])}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 60,
      paddingBottom: 16,
      backgroundColor: '#E53935',
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    content: {
      flex: 1,
    },
    contentInner: {
      padding: 24,
    },
    subtitle: {
      fontSize: 14,
      color: palette.muted,
      marginBottom: 24,
      lineHeight: 20,
    },
    photosGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
    },
    photoContainer: {
      width: '47%',
      aspectRatio: 0.8,
      position: 'relative',
    },
    primaryBadge: {
      position: 'absolute',
      top: -10,
      left: 10,
      backgroundColor: '#E53935',
      paddingVertical: 4,
      paddingHorizontal: 12,
      borderRadius: 12,
      zIndex: 10,
    },
    primaryText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    photoBox: {
      flex: 1,
      backgroundColor: '#F5F5F5',
      borderRadius: 12,
      borderWidth: 2,
      borderColor: '#E0E0E0',
      overflow: 'hidden',
    },
    photoBoxDone: {
      borderColor: '#E53935',
    },
    photoImage: {
      width: '100%',
      height: '100%',
    },
    placeholderContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    uploadOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    uploadingText: {
      fontSize: 13,
      color: '#FFFFFF',
      marginTop: 8,
      fontWeight: '600',
    },
    removeButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    setPrimaryButton: {
      position: 'absolute',
      bottom: 8,
      left: 8,
      right: 8,
      backgroundColor: 'rgba(229,57,53,0.9)',
      paddingVertical: 6,
      borderRadius: 16,
      alignItems: 'center',
    },
    setPrimaryText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    addPhotoButton: {
      width: '47%',
      aspectRatio: 0.8,
      backgroundColor: '#F5F5F5',
      borderRadius: 12,
      borderWidth: 2,
      borderColor: '#E0E0E0',
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
    },
    addPhotoIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: '#FFFFFF',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      marginBottom: 12,
    },
    addPhotoText: {
      fontSize: 14,
      color: palette.muted,
      fontWeight: '500',
    },
    footer: {
      padding: 24,
      paddingBottom: 40,
      borderTopWidth: 1,
      borderTopColor: palette.border,
    },
    completeButton: {
      backgroundColor: '#E53935',
      borderRadius: 28,
      paddingVertical: 16,
      alignItems: 'center',
    },
    completeButtonDisabled: {
      backgroundColor: '#E0E0E0',
    },
    completeButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    skipButton: {
      alignItems: 'center',
      paddingVertical: 12,
    },
    skipText: {
      fontSize: 14,
      color: palette.muted,
    },
  });
}
