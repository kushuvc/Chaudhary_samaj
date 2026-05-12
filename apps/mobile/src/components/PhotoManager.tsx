import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import type { Photo } from '../screens/SignupManagePhotosScreen';

interface PhotoManagerProps {
  photos: Photo[];
  onChange: (photos: Photo[]) => void;
  editable?: boolean;
  maxPhotos?: number;
}

export function PhotoManager({ photos, onChange, editable = true, maxPhotos = 6 }: PhotoManagerProps) {
  const [uploading, setUploading] = useState<string | null>(null);

  const pickAndUpload = async () => {
    if (photos.length >= maxPhotos) return;

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
    const tempId = `temp-${Date.now()}`;
    const newPhoto: Photo = {
      id: tempId,
      uri: '',
      localUri: asset.uri,
      isPrimary: photos.length === 0,
      status: 'uploading',
    };

    const next = [...photos, newPhoto];
    onChange(next);
    setUploading(tempId);

    try {
      const remoteUrl = await api.uploadPhoto(asset.uri);
      onChange(
        next.map((p) => p.id === tempId ? { ...p, uri: remoteUrl, status: 'done' } : p)
      );
    } catch (err: any) {
      Alert.alert('Upload failed', err.message || 'Could not upload photo');
      onChange(next.filter((p) => p.id !== tempId));
    } finally {
      setUploading(null);
    }
  };

  const removePhoto = async (id: string) => {
    const photo = photos.find((p) => p.id === id);
    if (!photo) return;

    Alert.alert('Remove Photo', 'Are you sure you want to remove this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const updated = photos.filter((p) => p.id !== id);
          if (updated.length > 0 && !updated.some((p) => p.isPrimary)) {
            updated[0].isPrimary = true;
          }
          onChange(updated);
          if (photo.uri) {
            try { await api.deletePhoto(photo.uri); } catch {}
          }
        },
      },
    ]);
  };

  const setPrimary = (id: string) => {
    onChange(photos.map((p) => ({ ...p, isPrimary: p.id === id })));
  };

  return (
    <View style={styles.grid}>
      {photos.map((photo) => {
        const displayUri = photo.localUri || photo.uri;
        return (
          <View key={photo.id} style={styles.photoContainer}>
            {photo.isPrimary && (
              <View style={styles.primaryBadge}>
                <Text style={styles.primaryText}>Main</Text>
              </View>
            )}
            <View style={[styles.photoBox, photo.status === 'done' && styles.photoBoxDone]}>
              {displayUri ? (
                <Image source={{ uri: displayUri }} style={styles.photoImage} resizeMode="cover" />
              ) : (
                <View style={styles.placeholder}>
                  <Ionicons name="person" size={36} color="#CCCCCC" />
                </View>
              )}
              {photo.status === 'uploading' && (
                <View style={styles.uploadOverlay}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <Text style={styles.uploadingText}>Uploading...</Text>
                </View>
              )}
            </View>

            {editable && (
              <Pressable style={styles.removeBtn} onPress={() => removePhoto(photo.id)}>
                <Ionicons name="close" size={14} color="#FFFFFF" />
              </Pressable>
            )}

            {editable && !photo.isPrimary && photo.status === 'done' && (
              <Pressable style={styles.setPrimaryBtn} onPress={() => setPrimary(photo.id)}>
                <Text style={styles.setPrimaryText}>Set Main</Text>
              </Pressable>
            )}
          </View>
        );
      })}

      {editable && photos.length < maxPhotos && (
        <Pressable style={styles.addBtn} onPress={pickAndUpload} disabled={uploading !== null}>
          <Ionicons name="add" size={28} color="#E53935" />
          <Text style={styles.addText}>Add Photo</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoContainer: {
    width: '47%',
    aspectRatio: 0.8,
    position: 'relative',
  },
  primaryBadge: {
    position: 'absolute',
    top: -8,
    left: 8,
    backgroundColor: '#E53935',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
    zIndex: 10,
  },
  primaryText: {
    fontSize: 10,
    fontWeight: '700',
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
  placeholder: {
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
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 6,
    fontWeight: '600',
  },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  setPrimaryBtn: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    backgroundColor: 'rgba(229,57,53,0.88)',
    paddingVertical: 5,
    borderRadius: 14,
    alignItems: 'center',
  },
  setPrimaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  addBtn: {
    width: '47%',
    aspectRatio: 0.8,
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E53935',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  addText: {
    fontSize: 13,
    color: '#E53935',
    fontWeight: '600',
  },
});
