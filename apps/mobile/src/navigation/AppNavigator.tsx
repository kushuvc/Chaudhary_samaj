import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { DashboardScreen } from '../screens/DashboardScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { LoadingScreen } from '../screens/LoadingScreen';
import { MatrimonyScreen } from '../screens/MatrimonyScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { InterestsScreen } from '../screens/InterestsScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { LanguageSelectionScreen } from '../screens/LanguageSelectionScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { SignupProfileTypeScreen, type ProfileType } from '../screens/SignupProfileTypeScreen';
import { SignupPersonalDetailsScreen, type PersonalDetailsData } from '../screens/SignupPersonalDetailsScreen';
import { SignupReligiousDetailsScreen, type ReligiousDetailsData } from '../screens/SignupReligiousDetailsScreen';
import { SignupLocationDetailsScreen, type LocationDetailsData } from '../screens/SignupLocationDetailsScreen';
import { SignupInterestsScreen, type InterestsData } from '../screens/SignupInterestsScreen';
import { SignupAdditionalDetailsScreen, type AdditionalDetailsData } from '../screens/SignupAdditionalDetailsScreen';
import { SignupEatingHabitsScreen, type EatingHabit } from '../screens/SignupEatingHabitsScreen';
import { SignupHoroscopeScreen, type HoroscopeData } from '../screens/SignupHoroscopeScreen';
import { SignupManagePhotosScreen, type Photo } from '../screens/SignupManagePhotosScreen';
import { SignupBasicDetailsScreen, type BasicDetailsData } from '../screens/SignupBasicDetailsScreen';
import { useAppTheme } from '../context/ThemeContext';
import { useAppLanguage } from '../context/LanguageContext';
import { api } from '../services/api';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function tabIcon(name: keyof typeof Ionicons.glyphMap) {
  return ({ color, size }: { color: string; size: number }) => <Ionicons name={name} color={color} size={size} />;
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  const { resolvedTheme, palette } = useAppTheme();
  const { t } = useAppLanguage();

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          minHeight: 66,
          height: 58 + Math.max(insets.bottom, 10),
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 7,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          borderTopColor: palette.border,
          borderTopWidth: 1,
          backgroundColor: palette.tabBg,
          shadowColor: '#000000',
          shadowOpacity: resolvedTheme === 'dark' ? 0.24 : 0.08,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: -5 },
          elevation: 10,
        },
      }}
    >
      <Tabs.Screen name="Home" component={DashboardScreen} options={{ tabBarIcon: tabIcon('home-outline'), tabBarLabel: t('home') }} />
      <Tabs.Screen name="Matrimony" component={MatrimonyScreen} options={{ tabBarIcon: tabIcon('heart-outline'), tabBarLabel: t('matrimony') }} />
      <Tabs.Screen name="Interests" component={InterestsScreen} options={{ tabBarIcon: tabIcon('mail-outline'), tabBarLabel: 'Interests' }} />
      <Tabs.Screen name="Messages" component={MessagesScreen} options={{ tabBarIcon: tabIcon('chatbubble-outline'), tabBarLabel: 'Messages' }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: tabIcon('person-outline'), tabBarLabel: t('profile') }} />
      <Tabs.Screen name="Settings" component={SettingsScreen} options={{ tabBarIcon: tabIcon('settings-outline'), tabBarLabel: t('settings') }} />
    </Tabs.Navigator>
  );
}

function AuthFlow() {
  const { signup, completeProfileSetup, isNewSignup } = useAuth();
  const [authMode, setAuthMode] = useState<
    | 'welcome'
    | 'login'
    | 'signup-profile-type'
    | 'signup-personal'
    | 'signup-religious'
    | 'signup-location'
    | 'signup-interests'
    | 'signup-additional'
    | 'signup-eating-habits'
    | 'signup-horoscope'
    | 'signup-photos'
    | 'signup-basic'
  >(isNewSignup ? 'signup-photos' : 'welcome');

  const [signupData, setSignupData] = useState<{
    profileType?: ProfileType;
    personalDetails?: PersonalDetailsData;
    religiousDetails?: ReligiousDetailsData;
    locationDetails?: LocationDetailsData;
    interests?: InterestsData;
    additionalDetails?: AdditionalDetailsData;
    eatingHabit?: EatingHabit;
    horoscope?: HoroscopeData;
    photos?: Photo[];
  }>({});

  const handleProfileTypeNext = (type: ProfileType) => {
    setSignupData({ ...signupData, profileType: type });
    setAuthMode('signup-personal');
  };

  const handlePersonalDetailsNext = (data: PersonalDetailsData) => {
    setSignupData({ ...signupData, personalDetails: data });
    setAuthMode('signup-religious');
  };

  const handleReligiousDetailsNext = (data: ReligiousDetailsData) => {
    setSignupData({ ...signupData, religiousDetails: data });
    setAuthMode('signup-location');
  };

  const handleLocationDetailsNext = (data: LocationDetailsData) => {
    setSignupData({ ...signupData, locationDetails: data });
    setAuthMode('signup-interests');
  };

  const handleInterestsNext = (data: InterestsData) => {
    setSignupData({ ...signupData, interests: data });
    setAuthMode('signup-additional');
  };

  const handleInterestsSkip = () => {
    setAuthMode('signup-additional');
  };

  const handleAdditionalDetailsSubmit = (data: AdditionalDetailsData) => {
    setSignupData({ ...signupData, additionalDetails: data });
    setAuthMode('signup-eating-habits');
  };

  const handleEatingHabitsNext = (habit: EatingHabit) => {
    setSignupData({ ...signupData, eatingHabit: habit });
    setAuthMode('signup-horoscope');
  };

  const handleEatingHabitsSkip = () => {
    setAuthMode('signup-horoscope');
  };

  const handleHoroscopeNext = (data: HoroscopeData) => {
    setSignupData({ ...signupData, horoscope: data });
    setAuthMode('signup-basic');
  };

  const handleHoroscopeSkip = () => {
    setAuthMode('signup-basic');
  };

  const handleSignupSubmit = async (basicDetails: BasicDetailsData) => {
    const pd = signupData.personalDetails;
    const rd = signupData.religiousDetails;
    const ld = signupData.locationDetails;
    const ad = signupData.additionalDetails;
    const intr = signupData.interests;

    const dobYear = pd?.dateOfBirth?.year ? parseInt(pd.dateOfBirth.year) : undefined;
    const dobMonth = pd?.dateOfBirth?.month ? parseInt(pd.dateOfBirth.month) : undefined;
    const dobDay = pd?.dateOfBirth?.day ? parseInt(pd.dateOfBirth.day) : undefined;
    const dobString = dobYear && dobMonth && dobDay
      ? `${dobYear}-${String(dobMonth).padStart(2, '0')}-${String(dobDay).padStart(2, '0')}`
      : undefined;
    const age = dobYear ? new Date().getFullYear() - dobYear : undefined;

    const familyStatusMap: Record<string, string> = {
      middle_class: 'Middle Class',
      upper_middle_class: 'Upper Middle Class',
      rich_affluent: 'Rich',
    };

    await signup({
      name: basicDetails.fullName,
      email: basicDetails.email,
      password: basicDetails.password,
      phone: basicDetails.phone,
      gender: pd?.gender || undefined,
      age,
      dateOfBirth: dobString,
      height: pd?.height || undefined,
      maritalStatus: pd?.maritalStatus?.replace(/_/g, ' ') || undefined,
      physicalStatus: pd?.physicalStatus || undefined,
      location: ld?.city || undefined,
      country: ld?.country || undefined,
      state: ld?.state || undefined,
      city: ld?.city || undefined,
      village: ld?.village || undefined,
      nativeCity: ld?.nativeCity || undefined,
      nativeVillage: ld?.nativeVillage || undefined,
      community: rd?.caste || undefined,
      subCommunity: rd?.subcaste || undefined,
      religion: rd?.religion || undefined,
      caste: rd?.caste || undefined,
      dosh: rd?.dosh || undefined,
      eatingHabit: signupData.eatingHabit || undefined,
      horoscopeTime: signupData.horoscope?.timeOfBirth || undefined,
      horoscopePlace: signupData.horoscope?.placeOfBirth || undefined,
      familyStatus: ad?.familyStatus ? familyStatusMap[ad.familyStatus] || ad.familyStatus : undefined,
      familyType: ad?.familyType?.replace(/_/g, ' ') || undefined,
      familyWealth: ad?.familyWealth || undefined,
      fatherName: ad?.fatherName || undefined,
      motherName: ad?.motherName || undefined,
      fatherOccupation: ad?.fatherOccupation || undefined,
      motherOccupation: ad?.motherOccupation || undefined,
      siblings: ad?.siblings || undefined,
      hobbies: intr?.hobbies,
      music: intr?.music,
      sports: intr?.sports,
    });
    setAuthMode('signup-photos');
  };

  const handlePhotosComplete = async (photos: Photo[]) => {
    if (photos.length > 0) {
      try {
        await api.updateMyMatrimonyProfile({ profile: { photos } } as any);
      } catch {}
    }
    await completeProfileSetup();
  };

  switch (authMode) {
    case 'welcome':
      return (
        <WelcomeScreen
          onCreateProfile={() => setAuthMode('signup-profile-type')}
          onLogin={() => setAuthMode('login')}
        />
      );
    case 'login':
      return <LoginScreen />;
    case 'signup-profile-type':
      return (
        <SignupProfileTypeScreen
          onBack={() => setAuthMode('welcome')}
          onNext={handleProfileTypeNext}
        />
      );
    case 'signup-personal':
      return (
        <SignupPersonalDetailsScreen
          onBack={() => setAuthMode('signup-profile-type')}
          onNext={handlePersonalDetailsNext}
        />
      );
    case 'signup-religious':
      return (
        <SignupReligiousDetailsScreen
          onBack={() => setAuthMode('signup-personal')}
          onNext={handleReligiousDetailsNext}
        />
      );
    case 'signup-location':
      return (
        <SignupLocationDetailsScreen
          onBack={() => setAuthMode('signup-religious')}
          onNext={handleLocationDetailsNext}
        />
      );
    case 'signup-interests':
      return (
        <SignupInterestsScreen
          onBack={() => setAuthMode('signup-location')}
          onNext={handleInterestsNext}
          onSkip={handleInterestsSkip}
        />
      );
    case 'signup-additional':
      return (
        <SignupAdditionalDetailsScreen
          onBack={() => setAuthMode('signup-interests')}
          onSubmit={handleAdditionalDetailsSubmit}
        />
      );
    case 'signup-eating-habits':
      return (
        <SignupEatingHabitsScreen
          onBack={() => setAuthMode('signup-additional')}
          onNext={handleEatingHabitsNext}
          onSkip={handleEatingHabitsSkip}
        />
      );
    case 'signup-horoscope':
      return (
        <SignupHoroscopeScreen
          onBack={() => setAuthMode('signup-eating-habits')}
          onNext={handleHoroscopeNext}
          onSkip={handleHoroscopeSkip}
        />
      );
    case 'signup-basic':
      return (
        <SignupBasicDetailsScreen
          onBack={() => setAuthMode('signup-horoscope')}
          onSubmit={handleSignupSubmit}
        />
      );
    case 'signup-photos':
      return (
        <SignupManagePhotosScreen
          onBack={() => setAuthMode('signup-basic')}
          onComplete={handlePhotosComplete}
        />
      );
  }
}

export function AppNavigator() {
  const { session, loading, isNewSignup } = useAuth();
  const { ready, language } = useAppLanguage();

  if (loading || !ready) {
    return <LoadingScreen />;
  }

  if (!language) {
    return <LanguageSelectionScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {(!session || isNewSignup) ? <Stack.Screen name="Auth" component={AuthFlow} /> : null}
      {(session && !isNewSignup) ? <Stack.Screen name="Main" component={MainTabs} /> : null}
    </Stack.Navigator>
  );
}
