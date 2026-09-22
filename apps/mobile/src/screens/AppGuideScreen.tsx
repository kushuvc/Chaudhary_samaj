import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppLanguage } from '../context/LanguageContext';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { api } from '../services/api';
import type { GuideSection } from '../services/api';
import { radius, spacing } from '../theme';

/**
 * How the app works, explained section by section.
 *
 * The content comes from the server rather than the bundle so a section can be
 * reworded, or added for a feature that ships later, without a release. That
 * also means it needs the network — which is no different from the rest of the
 * app, so a failure gets the same retry treatment as every other screen rather
 * than a stale copy baked in at build time.
 */
export function AppGuideScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { palette } = useAppTheme();
  const { t, language } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [sections, setSections] = useState<GuideSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSections(await api.getAppGuide(language ?? 'en-IN'));
    } catch (err) {
      setError((err as Error).message || t('alertSomethingWrong'));
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  // Reloads when the language changes, because the server resolves the
  // translation rather than sending all three.
  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.page}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('guideTitle')}</Text>
            <Text style={styles.subtitle}>{t('guideSubtitle')}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('actClose')}>
            <Ionicons name="close" size={26} color={palette.muted} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={palette.primary} />
            <Text style={styles.centeredText}>{t('lblPleaseWait')}</Text>
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Ionicons name="cloud-offline-outline" size={40} color={palette.muted} />
            <Text style={styles.centeredText}>{error}</Text>
            <Pressable style={styles.retry} onPress={() => void load()}>
              <Text style={styles.retryText}>{t('retry')}</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
            showsVerticalScrollIndicator={false}
          >
            {sections.map((section, index) => (
              <View key={section.key} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.iconWrap}>
                    <Ionicons name={section.icon as any} size={22} color={palette.primary} />
                  </View>
                  {/* Numbered because the sections read as an order to learn
                      the app in, not as an unordered pile of tips. */}
                  <Text style={styles.step}>{index + 1}</Text>
                  <Text style={styles.cardTitle}>{section.title}</Text>
                </View>
                <Text style={styles.cardBody}>{section.body}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: palette.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
    },
    title: { fontSize: 24, fontWeight: '800', color: palette.text, letterSpacing: -0.4 },
    subtitle: { fontSize: 14, lineHeight: 20, color: palette.muted, marginTop: 2 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
    centeredText: { fontSize: 15, color: palette.muted, textAlign: 'center' },
    retry: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: palette.primary,
    },
    retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
    content: { padding: spacing.md, gap: spacing.md },
    card: {
      backgroundColor: palette.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: palette.border,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: palette.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    step: { fontSize: 13, fontWeight: '800', color: palette.muted },
    cardTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: palette.text },
    /* Generous leading: this is explanatory prose read in a second language
       for most members, and Devanagari and Gujarati conjuncts need the room. */
    cardBody: { fontSize: 15, lineHeight: 24, color: palette.textSoft ?? palette.text },
  });
}
