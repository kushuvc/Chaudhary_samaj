import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { InlineError } from './AppFeedback';
import { Checkbox, PrimaryButton } from './ui';
import { useAppLanguage } from '../context/LanguageContext';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { api, type VerificationSummary } from '../services/api';
import { radius, spacing } from '../theme';

/*
 * Aadhaar verification: the how-to guide, consent, the camera and the result.
 *
 * Shared by the signup step and the Verification screen. The scanned text goes
 * to the server, which checks UIDAI's signature and compares the signed name,
 * date of birth and gender with the profile; nothing from the QR is kept here.
 */

const FIELD_LABELS: Record<string, string> = {
  name: 'verifyFieldName',
  dateOfBirth: 'verifyFieldDob',
  gender: 'verifyFieldGender',
};

const GUIDE_STEPS = [
  'verifyGuideStep1',
  'verifyGuideStep2',
  'verifyGuideStep3',
  'verifyGuideStep4',
  'verifyGuideStep5',
  'verifyGuideStep6',
];

export function AadhaarVerify({
  aadhaar,
  onResult,
  guideOpenInitially = false,
}: {
  aadhaar: VerificationSummary['aadhaar'] | null;
  onResult: (summary: VerificationSummary) => void;
  guideOpenInitially?: boolean;
}) {
  const { palette } = useAppTheme();
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [guideOpen, setGuideOpen] = useState(guideOpenInitially);
  const [consent, setConsent] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  // The camera reports the same code many times a second; only the first counts.
  const handled = useRef(false);

  const startScan = async () => {
    setError(null);
    if (!permission?.granted) {
      const next = await requestPermission();
      if (!next.granted) {
        setError(t('verifyCameraDenied'));
        return;
      }
    }
    handled.current = false;
    setScanning(true);
  };

  const onScanned = async ({ data }: { data: string }) => {
    if (handled.current) return;
    handled.current = true;
    setScanning(false);
    setChecking(true);
    try {
      onResult(await api.submitAadhaarQr(data));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChecking(false);
    }
  };

  const status = aadhaar?.status || 'none';
  const mismatchText = (aadhaar?.mismatches || []).map((f) => t(FIELD_LABELS[f] || f)).join(', ');

  const guide = (
    <View style={styles.guide}>
      <Pressable
        onPress={() => setGuideOpen((v) => !v)}
        style={styles.guideHead}
        accessibilityRole="button"
        accessibilityState={{ expanded: guideOpen }}
      >
        <Ionicons name="book-outline" size={18} color={palette.primary} />
        <Text style={styles.guideTitle}>{t('verifyGuideTitle')}</Text>
        <Ionicons name={guideOpen ? 'chevron-up' : 'chevron-down'} size={18} color={palette.muted} />
      </Pressable>
      {guideOpen
        ? GUIDE_STEPS.map((key, index) => (
            <View key={key} style={styles.guideStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{t(key)}</Text>
            </View>
          ))
        : null}
    </View>
  );

  return (
    <View style={styles.wrap}>
      {error ? <InlineError message={error} /> : null}

      {checking ? (
        <View style={styles.statusRow}>
          <ActivityIndicator color={palette.primary} />
          <Text style={styles.body}>{t('verifyAadhaarChecking')}</Text>
        </View>
      ) : status === 'verified' ? (
        <StatusBlock
          icon="shield-checkmark"
          color={palette.success}
          title={t('verifyAadhaarVerified')}
          body={t('verifyAadhaarVerifiedBody')}
          styles={styles}
        />
      ) : status === 'review' ? (
        <StatusBlock
          icon="time-outline"
          color={palette.warning}
          title={t('verifyAadhaarReview')}
          body={t('verifyAadhaarReviewBody', { fields: mismatchText })}
          styles={styles}
        />
      ) : (
        <>
          {status === 'rejected' ? (
            <StatusBlock
              icon="close-circle-outline"
              color={palette.danger}
              title={t('verifyAadhaarRejected')}
              body={
                aadhaar?.reviewNote
                  ? `${t('verifyAadhaarRejectedBody')}\n${t('verifyNote', { note: aadhaar.reviewNote })}`
                  : t('verifyAadhaarRejectedBody')
              }
              styles={styles}
            />
          ) : null}
          <Text style={styles.body}>{t('verifyAadhaarIntro')}</Text>
          {guide}
          <View style={styles.privacy}>
            <Ionicons name="lock-closed-outline" size={16} color={palette.muted} />
            <Text style={styles.privacyText}>{t('verifyAadhaarPrivacy')}</Text>
          </View>
          <View style={styles.legal}>
            <Ionicons name="warning-outline" size={16} color={palette.danger} />
            <Text style={styles.legalText}>{t('verifyAadhaarLegalWarning')}</Text>
          </View>
          <Checkbox label={t('verifyAadhaarConsent')} checked={consent} onPress={() => setConsent((v) => !v)} />
          <PrimaryButton
            label={status === 'rejected' ? t('verifyAadhaarTryAgain') : t('verifyAadhaarScan')}
            icon="qr-code-outline"
            disabled={!consent}
            onPress={() => void startScan()}
          />
        </>
      )}

      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        <View style={styles.cameraPage}>
          {scanning ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={(result) => void onScanned(result)}
            />
          ) : null}
          <View style={[styles.cameraOverlay, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
            <Text style={styles.cameraHint}>{t('verifyAadhaarScanning')}</Text>
            <View style={styles.frame} />
            <Pressable onPress={() => setScanning(false)} style={styles.cancelButton} accessibilityRole="button">
              <Text style={styles.cancelText}>{t('verifyCancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatusBlock({
  icon,
  color,
  title,
  body,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  body: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.statusRow}>
      <Ionicons name={icon} size={26} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.statusTitle, { color }]}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    wrap: { gap: spacing.sm },
    body: { fontSize: 14, lineHeight: 20, color: palette.textSoft },
    guide: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: radius.sm,
      padding: spacing.sm,
      gap: spacing.sm,
      backgroundColor: palette.primarySoft,
    },
    guideHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    guideTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: palette.text },
    guideStep: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    stepNumber: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: palette.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    stepNumberText: { color: palette.onPrimary, fontSize: 12, fontWeight: '800' },
    stepText: { flex: 1, fontSize: 13.5, lineHeight: 19, color: palette.text },
    privacy: {
      flexDirection: 'row',
      gap: spacing.xs,
      backgroundColor: palette.surfaceSunken,
      borderRadius: radius.sm,
      padding: spacing.sm,
    },
    privacyText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: palette.muted },
    legal: {
      flexDirection: 'row',
      gap: spacing.xs,
      backgroundColor: palette.dangerSoft,
      borderRadius: radius.sm,
      padding: spacing.sm,
    },
    legalText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: palette.text },
    statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    statusTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
    cameraPage: { flex: 1, backgroundColor: '#000000' },
    cameraOverlay: { flex: 1, alignItems: 'center', justifyContent: 'space-between' },
    cameraHint: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'center',
      paddingHorizontal: spacing.lg,
      backgroundColor: 'rgba(0,0,0,0.45)',
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
    },
    frame: { width: 260, height: 260, borderWidth: 3, borderColor: '#FFFFFF', borderRadius: radius.md },
    cancelButton: {
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: 999,
    },
    cancelText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  });
}
