import React, { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { api } from '../services/api';
import { useAppTheme } from '../context/ThemeContext';
import { useAppLanguage } from '../context/LanguageContext';

const PLAY_URL = 'market://details?id=com.chaudharysamaj.mobile';
const PLAY_WEB = 'https://play.google.com/store/apps/details?id=com.chaudharysamaj.mobile';

/** This build's Android versionCode, baked into the app at build time. */
const thisBuild = () => Number(Constants.expoConfig?.android?.versionCode) || 0;

/*
 * Asks members on an old build to update, as set in Admin → Overview → App
 * updates. Below "required" the prompt cannot be closed (for a broken build);
 * below "latest" it can. Checked once per launch; a failed check shows nothing.
 */
export function UpdatePrompt() {
  const { palette } = useAppTheme();
  const { t } = useAppLanguage();
  const [mode, setMode] = useState<'none' | 'soft' | 'force'>('none');

  useEffect(() => {
    const build = thisBuild();
    if (!build) return;
    void api.getVersionPolicy().then(({ latestVersionCode, minVersionCode }) => {
      if (minVersionCode && build < minVersionCode) setMode('force');
      else if (latestVersionCode && build < latestVersionCode) setMode('soft');
    });
  }, []);

  if (mode === 'none') return null;

  const openStore = () => {
    Linking.openURL(PLAY_URL).catch(() => Linking.openURL(PLAY_WEB).catch(() => {}));
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => mode === 'soft' && setMode('none')}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: palette.surface }]}>
          <Ionicons name="cloud-download-outline" size={40} color={palette.primary} />
          <Text style={[styles.title, { color: palette.text }]}>{t('updTitle')}</Text>
          <Text style={[styles.body, { color: palette.muted }]}>{mode === 'force' ? t('updBodyRequired') : t('updBody')}</Text>
          <Pressable accessibilityRole="button" style={[styles.primary, { backgroundColor: palette.primary }]} onPress={openStore}>
            <Text style={styles.primaryText}>{t('updButton')}</Text>
          </Pressable>
          {mode === 'soft' ? (
            <Pressable accessibilityRole="button" onPress={() => setMode('none')} hitSlop={8}>
              <Text style={[styles.later, { color: palette.muted }]}>{t('updLater')}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  card: { borderRadius: 20, padding: 24, alignItems: 'center', gap: 12 },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  primary: { alignSelf: 'stretch', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  later: { fontSize: 15, fontWeight: '700', paddingVertical: 6 },
});
