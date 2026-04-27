import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { loadJson, saveJson } from '../services/localData';

export type AppLanguage = 'en-IN' | 'hi-IN' | 'gu-IN';

type TranslationKey =
  | 'home'
  | 'matrimony'
  | 'events'
  | 'help'
  | 'business'
  | 'community'
  | 'settings'
  | 'profile'
  | 'selectLanguage'
  | 'continue'
  | 'welcomeMember'
  | 'loading';

interface LanguageContextValue {
  language: AppLanguage | null;
  ready: boolean;
  setLanguage: (next: AppLanguage) => Promise<void>;
  t: (key: TranslationKey) => string;
}

const STORAGE_KEY = 'chaudhary_mobile_app_language';

const translations: Record<AppLanguage, Record<TranslationKey, string>> = {
  'en-IN': {
    home: 'Home',
    matrimony: 'Matrimony',
    events: 'Events',
    help: 'Help',
    business: 'Business',
    community: 'Community',
    settings: 'Settings',
    profile: 'Profile',
    selectLanguage: 'Choose your language',
    continue: 'Continue',
    welcomeMember: 'Welcome, Member',
    loading: 'Loading...',
  },
  'hi-IN': {
    home: 'होम',
    matrimony: 'वैवाहिक',
    events: 'कार्यक्रम',
    help: 'मदद',
    business: 'व्यापार',
    community: 'समुदाय',
    settings: 'सेटिंग्स',
    profile: 'प्रोफाइल',
    selectLanguage: 'अपनी भाषा चुनें',
    continue: 'आगे बढ़ें',
    welcomeMember: 'स्वागत है, सदस्य',
    loading: 'लोड हो रहा है...',
  },
  'gu-IN': {
    home: 'હોમ',
    matrimony: 'લગ્ન',
    events: 'કાર્યક્રમો',
    help: 'મદદ',
    business: 'વ્યવસાય',
    community: 'સમુદાય',
    settings: 'સેટિંગ્સ',
    profile: 'પ્રોફાઇલ',
    selectLanguage: 'તમારી ભાષા પસંદ કરો',
    continue: 'આગળ વધો',
    welcomeMember: 'સ્વાગત છે, સભ્ય',
    loading: 'લોડ થઈ રહ્યું છે...',
  },
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const saved = await loadJson<AppLanguage | 'pa-IN' | null>(STORAGE_KEY, null);
      if (!mounted) {
        return;
      }
      const normalized = saved === 'pa-IN' ? 'gu-IN' : saved;
      setLanguageState(normalized);
      if (saved === 'pa-IN') {
        await saveJson<AppLanguage>(STORAGE_KEY, 'gu-IN');
      }
      setReady(true);
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = async (next: AppLanguage) => {
    setLanguageState(next);
    await saveJson<AppLanguage>(STORAGE_KEY, next);
  };

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    ready,
    setLanguage,
    t: (key) => {
      const active = language ?? 'en-IN';
      return translations[active][key] || translations['en-IN'][key] || key;
    },
  }), [language, ready]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useAppLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useAppLanguage must be used within LanguageProvider');
  }
  return context;
}
