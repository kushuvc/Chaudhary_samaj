import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api } from './api';
import { loadJson, saveJson } from './localData';

/**
 * Push notifications.
 *
 * The device gets an Expo push token, the server stores it against the signed
 * in member, and the server sends through Expo (which hands it to Firebase).
 * Everything here fails quietly: a member who declines permission, an
 * emulator without Google Play, or Expo Go — which cannot receive push on
 * Android — just carries on without it and still has the in-app list.
 */

const TOKEN_KEY = 'chaudhary_push_token';

// Show notifications while the app is open too; otherwise a new interest that
// arrives while someone is scrolling the directory goes unseen.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  // The server sends on channelId "default"; the channel must exist first or
  // Android 8+ drops the notification.
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Chaudhary Samaj',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 120, 200],
    lightColor: '#5B5BD6',
  });
}

/** Asks for permission if needed, then registers this device with the server. */
export async function registerForPush(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
    await ensureAndroidChannel();

    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && current.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    await api.registerPushToken(token, Platform.OS);
    await saveJson(TOKEN_KEY, token);
    return token;
  } catch {
    return null;
  }
}

/** Detaches this device on sign-out, so a shared phone stops getting the last member's notifications. */
export async function unregisterPush() {
  try {
    const token = await loadJson<string | null>(TOKEN_KEY, null);
    if (token) await api.unregisterPushToken(token);
    await saveJson(TOKEN_KEY, null);
  } catch {
    // Signing out must never fail on this.
  }
}
