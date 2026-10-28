import React, { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, type ThemePalette } from '../context/ThemeContext';
import { Callout, Field, Input, PrimaryButton, StepScaffold, TextButton } from '../components/ui';
import { api } from '../services/api';
import { useAppLanguage } from '../context/LanguageContext';
import { suggestEmail } from '../utils/emailTypo';

// The public site, not the API host: these pages must open the same for
// someone who has not signed up yet.
const TERMS_URL = 'https://www.chaudharysamaj.com/terms';
const PRIVACY_URL = 'https://www.chaudharysamaj.com/privacy-policy';

const openLegal = (url: string) => {
  Linking.openURL(url).catch(() => {});
};

export interface BasicDetailsData {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  agreeToTerms: boolean;
}

interface SignupBasicDetailsScreenProps {
  /** Details already given (Back, or a resumed signup), shown again. */
  initial?: BasicDetailsData;
  /**
   * An address whose code was already entered and is still accepted by the
   * server, lower-cased. Continuing with it skips the code instead of sending
   * another one.
   */
  verifiedEmail?: string | null;
  onBack: () => void;
  onSubmit: (data: BasicDetailsData) => Promise<void> | void;
  /** Called when the entered phone already belongs to an account. */
  onExistingAccount?: () => void;
}

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 20;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function SignupBasicDetailsScreen({ initial, verifiedEmail, onBack, onSubmit, onExistingAccount }: SignupBasicDetailsScreenProps) {
  const { t } = useAppLanguage();
  const { palette } = useAppTheme();
  const styles = createStyles(palette);

  const [fullName, setFullName] = useState(initial?.fullName || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [password, setPassword] = useState(initial?.password || '');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [agreeToTerms, setAgreeToTerms] = useState(initial?.agreeToTerms ?? false);

  const [stage, setStage] = useState<'details' | 'otp'>('details');
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mockOtpHint, setMockOtpHint] = useState('');
  // A code that never comes usually means a wrong or non-existent address;
  // after a minute on the code step, say so and point at the fix.
  const [showNoCodeHint, setShowNoCodeHint] = useState(false);
  useEffect(() => {
    setShowNoCodeHint(false);
    if (stage !== 'otp') return;
    const timer = setTimeout(() => setShowNoCodeHint(true), 60_000);
    return () => clearTimeout(timer);
  }, [stage]);

  // Back to the details with everything they typed kept, to fix the address.
  const changeEmail = () => {
    setStage('details');
    setOtp('');
    setError(null);
  };

  const passwordValid = password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX;
  // "gamil.com" is well formed, but the code would go nowhere: stop here.
  const emailSuggestion = suggestEmail(email);
  const detailsValid =
    fullName.trim().length > 0 && isValidEmail(email) && !emailSuggestion && passwordValid && phone.length === 10 && agreeToTerms;

  const handleSendOtp = async () => {
    if (!detailsValid || sending) {
      return;
    }
    // Already verified (they came back here, or resumed): no second code.
    if (verifiedEmail && email.trim().toLowerCase() === verifiedEmail) {
      setSending(true);
      try {
        await onSubmit({ fullName, email, password, phone, agreeToTerms });
      } finally {
        setSending(false);
      }
      return;
    }
    setSending(true);
    setError(null);
    try {
      // Verify by email. The phone still goes along so the server can reject a
      // number that is already registered at this step rather than after the
      // profile questions.
      const response = await api.requestOtp(email.trim(), 'signup', phone);
      if (response.debugOtp) {
        setMockOtpHint(response.debugOtp);
      }
      setStage('otp');
    } catch (err: any) {
      if (err?.code === 'PHONE_ALREADY_REGISTERED') {
        Alert.alert(
          t('errNumberRegisteredTitle'),
          t('errNumberRegisteredBody'),
          [
            { text: t('actCancel'), style: 'cancel' },
            { text: t('actLogIn'), onPress: () => onExistingAccount?.() },
          ]
        );
        return;
      }
      if (String(err?.message || '').toLowerCase().includes('already registered')) {
        Alert.alert(
          t('errEmailRegisteredTitle'),
          t('errEmailRegisteredBody'),
          [
            { text: t('actCancel'), style: 'cancel' },
            { text: t('actLogIn'), onPress: () => onExistingAccount?.() },
          ]
        );
        return;
      }
      setError(err?.message || t('suCodeSendFailed'));
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length !== 6 || loading) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.verifyOtp(email.trim(), 'signup', otp);
      await onSubmit({ fullName, email, password, phone, agreeToTerms });
    } catch (err: any) {
      setError(err?.message || t('suRegistrationFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (stage === 'otp') {
    return (
      <StepScaffold
        onBack={changeEmail}
        eyebrow={t('suVerify')}
        title={t('suEnterThe6DigitCode')}
        subtitle={t('suCodeSentTo', { email: email.trim() })}
        footer={
          <>
            <PrimaryButton
              label={t('suVerifyAndCreateAccount')}
              disabled={otp.length !== 6}
              loading={loading}
              onPress={handleVerify}
            />
            <TextButton label={sending ? t('suSendingCode') : t('phResendCode')} onPress={handleSendOtp} />
            <TextButton label={t('suWrongEmail')} onPress={changeEmail} />
          </>
        }
      >
        {mockOtpHint ? <Callout icon="flask-outline" text={t('testModeCode', { code: mockOtpHint })} /> : null}
        {showNoCodeHint ? <Callout icon="mail-unread-outline" text={t('suNoCodeHint', { email: email.trim() })} /> : null}

        <Field label={t('suOneTimePassword')} error={error}>
          <Input
            value={otp}
            onChangeText={(text) => setOtp(text.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
          />
        </Field>
      </StepScaffold>
    );
  }

  return (
    <StepScaffold
      onBack={onBack}
      eyebrow={t('suAccount')}
      title={t('suCreateYourLogin')}
      subtitle={t('suWeLlEmailYouAOne')}
      footer={
        <>
          <PrimaryButton
            label={t('suEmailMeACode')}
            icon="arrow-forward"
            disabled={!detailsValid}
            loading={sending}
            onPress={handleSendOtp}
          />
          <Text style={styles.legal}>
            {t('suTermsNotice')}
          </Text>
        </>
      }
    >
      <Field label={t('suFullName')}>
        <Input value={fullName} onChangeText={setFullName} placeholder={t('suYourName')} autoCapitalize="words" />
      </Field>

      <Field
        label={t('suEmailAddress')}
        hint={t('suUsedForAccountRecoveryAndNotifications')}
        error={emailSuggestion ? t('suEmailTypo', { suggestion: emailSuggestion }) : null}
      >
        <Input
          value={email}
          onChangeText={setEmail}
          placeholder="you@gmail.com"
          keyboardType="email-address"
          autoCapitalize="none"
          invalid={(email.length > 0 && !isValidEmail(email)) || Boolean(emailSuggestion)}
        />
      </Field>
      {emailSuggestion ? (
        <TextButton label={t('suEmailTypoFix', { suggestion: emailSuggestion })} onPress={() => setEmail(emailSuggestion)} />
      ) : null}

      <Field
        label={t('suCreatePassword')}
        hint={t('suPasswordRange', { min: PASSWORD_MIN, max: PASSWORD_MAX })}
        error={
          password.length > 0 && !passwordValid
            ? t('suPasswordRangeError', { min: PASSWORD_MIN, max: PASSWORD_MAX })
            : null
        }
      >
        <Input value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry maxLength={PASSWORD_MAX} />
      </Field>

      <Field label={t('suMobileNumber')} hint={t('suUsedForMatchesToContactYou')}>
        <Input
          value={phone}
          onChangeText={(text) => setPhone(text.replace(/\D/g, '').slice(0, 10))}
          placeholder="98xxxxxxxx"
          keyboardType="phone-pad"
          maxLength={10}
          prefix={
            <View style={styles.dialCode}>
              <Text style={styles.dialCodeText}>+91</Text>
              <View style={styles.dialDivider} />
            </View>
          }
        />
      </Field>

      <Pressable style={styles.termsRow} onPress={() => setAgreeToTerms((prev) => !prev)}>
        <View style={[styles.termsBox, agreeToTerms && styles.termsBoxChecked]}>
          {agreeToTerms ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
        </View>
        <Text style={styles.termsLabel}>
          {t('suTermsAgree')}
          {/* A nested Text with its own onPress takes the tap, so the links
              open the page without also toggling the box. */}
          <Text style={styles.termsLink} onPress={() => openLegal(TERMS_URL)} accessibilityRole="link">
            {t('suTermsConditions')}
          </Text>
          {t('suTermsAnd')}
          <Text style={styles.termsLink} onPress={() => openLegal(PRIVACY_URL)} accessibilityRole="link">
            {t('suTermsPrivacy')}
          </Text>
          {t('suTermsIncluding')}
        </Text>
      </Pressable>
      {/*
        * Spelled out under the tick rather than buried in a policy page: the
        * two terms a member most needs to know before joining are that a plan
        * is not refunded and that their number and details are seen by others.
        */}
      <View style={styles.termsPoints}>
        <View style={styles.termsPoint}>
          <Ionicons name="card-outline" size={16} color={palette.textSoft} />
          <Text style={styles.termsPointText}>{t('suTermsNoRefund')}</Text>
        </View>
        <View style={styles.termsPoint}>
          <Ionicons name="people-outline" size={16} color={palette.textSoft} />
          <Text style={styles.termsPointText}>{t('suTermsShareData')}</Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </StepScaffold>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    dialCode: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    dialCodeText: {
      fontSize: 15.5,
      fontWeight: '700',
      color: palette.textSoft,
    },
    dialDivider: {
      width: 1,
      height: 22,
      backgroundColor: palette.border,
    },
    termsRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingVertical: 2,
    },
    termsBox: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 1.5,
      borderColor: palette.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    termsBoxChecked: {
      backgroundColor: palette.primary,
      borderColor: palette.primary,
    },
    termsLabel: {
      flex: 1,
      fontSize: 13.5,
      lineHeight: 20,
      color: palette.muted,
    },
    termsPoints: {
      marginLeft: 34,
      marginTop: -4,
      gap: 8,
    },
    termsPoint: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    termsPointText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 19,
      color: palette.textSoft,
    },
    termsLink: {
      color: palette.primary,
      fontWeight: '700',
    },
    error: {
      fontSize: 13.5,
      color: palette.danger,
      fontWeight: '600',
    },
    legal: {
      fontSize: 12,
      color: palette.muted,
      textAlign: 'center',
      lineHeight: 18,
    },
  });
}
