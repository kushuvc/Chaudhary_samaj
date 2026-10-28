import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/*
 * Signup progress kept on the phone until the account exists.
 *
 * The answers used to live only in memory, so leaving the app mid-signup (to
 * read the code in Gmail, answer WhatsApp, or Android closing it in the
 * background) threw everything away, and the member had to start again with a
 * new email code. In three days of Oct 2026, 29 people verified their email
 * and never got an account; 13 of them asked for 3–7 codes. Now reopening the
 * app continues at the same step.
 *
 * The password goes to SecureStore, never into the plain draft.
 */
const KEY = 'signup-draft-v1';
const PASSWORD_KEY = 'signup-draft-password';

// The server accepts a verified email for 24 hours (emailRecentlyVerifiedForSignup);
// stop relying on it a little before that so the last step is not refused.
export const VERIFIED_FOR_MS = 23 * 60 * 60 * 1000;
// A draft nobody came back to in a week is stale.
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;

export interface SignupDraft<Data> {
  mode: string;
  data: Data;
  /** The address whose code was entered, lower-cased, and when. */
  verifiedEmail?: string | null;
  verifiedAt?: number | null;
  savedAt: number;
}

export function verificationStillValid(draft: { verifiedAt?: number | null } | null | undefined) {
  return Boolean(draft?.verifiedAt && Date.now() - draft.verifiedAt < VERIFIED_FOR_MS);
}

export async function saveSignupDraft<Data extends { basicDetails?: { password?: string } }>(
  draft: SignupDraft<Data>
) {
  try {
    const password = draft.data.basicDetails?.password;
    const data = draft.data.basicDetails
      ? { ...draft.data, basicDetails: { ...draft.data.basicDetails, password: '' } }
      : draft.data;
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...draft, data }));
    if (password) await SecureStore.setItemAsync(PASSWORD_KEY, password);
  } catch {
    // Saving progress is a convenience; signup still works without it.
  }
}

export async function loadSignupDraft<Data extends { basicDetails?: { password?: string } }>(): Promise<SignupDraft<Data> | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as SignupDraft<Data>;
    if (!draft?.mode || !draft.savedAt || Date.now() - draft.savedAt > KEEP_MS) {
      await clearSignupDraft();
      return null;
    }
    if (draft.data.basicDetails) {
      const password = await SecureStore.getItemAsync(PASSWORD_KEY);
      draft.data.basicDetails = { ...draft.data.basicDetails, password: password || '' };
    }
    return draft;
  } catch {
    return null;
  }
}

export async function clearSignupDraft() {
  try {
    await AsyncStorage.removeItem(KEY);
    await SecureStore.deleteItemAsync(PASSWORD_KEY);
  } catch {}
}
