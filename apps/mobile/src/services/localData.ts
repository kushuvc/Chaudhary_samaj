import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const memoryStore = new Map<string, string>();

async function readRaw(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    // Some builds expose incompatible SecureStore native APIs; fallback keeps app usable.
  }

  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return memoryStore.get(key) ?? null;
  }
}

async function writeRaw(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
    return;
  } catch {
    // Continue to AsyncStorage fallback.
  }

  try {
    await AsyncStorage.setItem(key, value);
    return;
  } catch {
    memoryStore.set(key, value);
  }
}

export async function loadJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await readRaw(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function saveJson<T>(key: string, value: T): Promise<void> {
  await writeRaw(key, JSON.stringify(value));
}
