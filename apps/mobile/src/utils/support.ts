import { Alert, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';

export const SUPPORT_EMAIL = 'support@chaudharysamaj.com';
const HELP_URL = 'https://www.chaudharysamaj.com/help';

type Translate = (key: any, params?: Record<string, string | number>) => string;

const langCode = (language?: string | null) =>
  language?.startsWith('hi') ? 'hi' : language?.startsWith('gu') ? 'gu' : 'en';

/** The public help page (common questions + app guide) in the member's language. */
export function openHelpGuide(language?: string | null) {
  Linking.openURL(`${HELP_URL}?lang=${langCode(language)}`).catch(() => {});
}

/**
 * Opens a mail to support. `context` (e.g. the signup step) goes in the
 * subject so we know where they were stuck without asking. A device with no
 * mail app is told where to write instead.
 */
export async function openSupportEmail(t: Translate, language?: string | null, context?: string) {
  const version = Constants.expoConfig?.version ?? 'unknown';
  const build = Constants.expoConfig?.android?.versionCode ?? 'unknown';
  const body = [
    '',
    '',
    '---',
    'The lines below help us find the problem. Please leave them in.',
    `App version: ${version} (build ${build})`,
    `Device: ${Platform.OS} ${Platform.Version}`,
    `Language: ${language ?? 'en-IN'}`,
    context ? `Where: ${context}` : '',
  ].filter(Boolean).join('\n');
  const subject = context ? `Chaudhary Samaj — help with ${context}` : 'Chaudhary Samaj — support';
  try {
    await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  } catch {
    Alert.alert(t('helpNoMailApp'), t('helpNoMailAppBody', { email: SUPPORT_EMAIL }));
  }
}
