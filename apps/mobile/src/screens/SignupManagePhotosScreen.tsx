import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, Image } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export interface Photo {
  id: string;
  uri: string;
  isPrimary: boolean;
  status: 'pending' | 'uploading' | 'validated' | 'rejected';
}

interface SignupManagePhotosScreenProps {
  onBack: () => void;
  onComplete: (photos: Photo[]) => void;
}

export function SignupManagePhotosScreen({ onBack, onComplete }: SignupManagePhotosScreenProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  
  const [photos, setPhotos] = useState<Photo[]>([
    { id: '1', uri: '', isPrimary: true, status: 'pending' },
    { id: '2', uri: '', isPrimary: false, status: 'pending' },
  ]);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const addPhoto = () => {
    if (photos.length < 6) {
      const newPhoto: Photo = {
        id: Date.now().toString(),
        uri: '',
        isPrimary: photos.length === 0,
        status: 'pending',
      };
      setPhotos([...photos, newPhoto]);
    }
  };

  const removePhoto = (id: string) => {
    const filtered = photos.filter((p) => p.id !== id);
    if (filtered.length > 0 && !filtered.some((p) => p.isPrimary)) {
      filtered[0].isPrimary = true;
    }
    setPhotos(filtered);
  };

  const setPrimary = (id: string) => {
    setPhotos(
      photos.map((p) => ({
        ...p,
        isPrimary: p.id === id,
      }))
    );
  };

  const simulateUpload = (id: string) => {
    setPhotos(
      photos.map((p) =>
        p.id === id ? { ...p, status: 'uploading' as const } : p
      )
    );
    
    setTimeout(() => {
      setPhotos((current) =>
        current.map((p) =>
          p.id === id ? { ...p, status: 'validated' as const, uri: 'placeholder' } : p
        )
      );
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    }, 2000);
  };

  const hasUploadedPhotos = photos.some((p) => p.status === 'validated' || p.status === 'uploading');

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
          Drag photos to reorder. First photo will be displayed as your profile photo
        </Text>

        {/* Photos Grid */}
        <View style={styles.photosGrid}>
          {photos.map((photo, index) => (
            <View key={photo.id} style={styles.photoContainer}>
              {photo.isPrimary && (
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryText}>Profile Photo</Text>
                </View>
              )}
              
              <Pressable 
                style={[styles.photoBox, photo.status === 'validated' && styles.photoBoxValidated]}
                onPress={() => photo.status === 'pending' && simulateUpload(photo.id)}
              >
                {photo.status === 'pending' && (
                  <View style={styles.placeholderContent}>
                    <View style={styles.personIcon}>
                      <Ionicons name="person" size={40} color="#CCCCCC" />
                    </View>
                    <Text style={styles.underValidationText}>Under{'\n'}Validation</Text>
                  </View>
                )}
                
                {photo.status === 'uploading' && (
                  <View style={styles.uploadingContent}>
                    <Ionicons name="cloud-upload" size={32} color="#E53935" />
                    <Text style={styles.uploadingText}>Uploading...</Text>
                  </View>
                )}
                
                {photo.status === 'validated' && (
                  <View style={styles.validatedContent}>
                    <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
                    <Text style={styles.validatedText}>Validated</Text>
                  </View>
                )}
              </Pressable>

              {/* Remove button */}
              <Pressable 
                style={styles.removeButton}
                onPress={() => removePhoto(photo.id)}
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </Pressable>

              {/* Set primary button */}
              {!photo.isPrimary && photo.status === 'validated' && (
                <Pressable 
                  style={styles.setPrimaryButton}
                  onPress={() => setPrimary(photo.id)}
                >
                  <Text style={styles.setPrimaryText}>Set as Profile</Text>
                </Pressable>
              )}
            </View>
          ))}

          {/* Add Photo Button */}
          {photos.length < 6 && (
            <Pressable style={styles.addPhotoButton} onPress={addPhoto}>
              <View style={styles.addPhotoIcon}>
                <Ionicons name="add" size={32} color="#2196F3" />
              </View>
              <Text style={styles.addPhotoText}>Add Photo</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Success Toast */}
      {showSuccessToast && (
        <View style={styles.toast}>
          <View style={styles.toastIcon}>
            <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.toastText}>uploaded successfully</Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.completeButton, !hasUploadedPhotos && styles.completeButtonDisabled]}
          onPress={() => hasUploadedPhotos && onComplete(photos)}
          disabled={!hasUploadedPhotos}
        >
          <Text style={styles.completeButtonText}>
            {hasUploadedPhotos ? 'Complete' : 'Add at least one photo'}
          </Text>
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
    photoBoxValidated: {
      borderColor: '#4CAF50',
    },
    placeholderContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    personIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#E0E0E0',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    underValidationText: {
      fontSize: 12,
      color: palette.muted,
      textAlign: 'center',
      lineHeight: 18,
    },
    uploadingContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    uploadingText: {
      fontSize: 14,
      color: '#E53935',
      marginTop: 8,
      fontWeight: '500',
    },
    validatedContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    validatedText: {
      fontSize: 14,
      color: '#4CAF50',
      marginTop: 8,
      fontWeight: '500',
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
    toast: {
      position: 'absolute',
      bottom: 100,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 28,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
      gap: 10,
    },
    toastIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#E53935',
      justifyContent: 'center',
      alignItems: 'center',
    },
    toastText: {
      fontSize: 14,
      color: palette.text,
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
  });
}
