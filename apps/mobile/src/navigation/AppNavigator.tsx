import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { DashboardScreen } from '../screens/DashboardScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { PhoneLoginScreen } from '../screens/PhoneLoginScreen';
import { LoadingScreen } from '../screens/LoadingScreen';
import { MatrimonyScreen } from '../screens/MatrimonyScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { InterestsScreen } from '../screens/InterestsScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { SubscriptionsScreen } from '../screens/SubscriptionsScreen';
import { LanguageSelectionScreen } from '../screens/LanguageSelectionScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { SignupProfileTypeScreen, type ProfileTypeData } from '../screens/SignupProfileTypeScreen';
import { SignupPersonalDetailsScreen, type PersonalDetailsData } from '../screens/SignupPersonalDetailsScreen';
import { SignupReligiousDetailsScreen, type ReligiousDetailsData } from '../screens/SignupReligiousDetailsScreen';
import { SignupLocationDetailsScreen, type LocationDetailsData } from '../screens/SignupLocationDetailsScreen';
import { SignupProfessionalDetailsScreen, type ProfessionalDetailsData } from '../screens/SignupProfessionalDetailsScreen';
import { SignupInterestsScreen, type InterestsData } from '../screens/SignupInterestsScreen';
import { SignupAdditionalDetailsScreen, type AdditionalDetailsData } from '../screens/SignupAdditionalDetailsScreen';
import { SignupEatingHabitsScreen, type EatingHabit } from '../screens/SignupEatingHabitsScreen';
import { SignupHoroscopeScreen, type HoroscopeData } from '../screens/SignupHoroscopeScreen';
import { SignupStarDetailsScreen, type StarDetailsData } from '../screens/SignupStarDetailsScreen';
import { SignupManagePhotosScreen, type Photo } from '../screens/SignupManagePhotosScreen';
import { SignupBasicDetailsScreen, type BasicDetailsData } from '../screens/SignupBasicDetailsScreen';
import { useAppTheme } from '../context/ThemeContext';
import { AnimatedTabBar } from '../components/AnimatedTabBar';
import { useAppLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { subjectFor } from '../constants/profileSubject';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function MainTabs() {
  const { t } = useAppLanguage();

  return (
    <Tabs.Navigator
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true }}
    >
      <Tabs.Screen name="Home" component={DashboardScreen} options={{ tabBarLabel: t('home') }} />
      <Tabs.Screen name="Matrimony" component={MatrimonyScreen} options={{ tabBarLabel: t('matrimony') }} />
      <Tabs.Screen name="Interests" component={InterestsScreen} options={{ tabBarLabel: 'Interests' }} />
      <Tabs.Screen name="Messages" component={MessagesScreen} options={{ tabBarLabel: 'Messages' }} />
      <Tabs.Screen name="Subscriptions" component={SubscriptionsScreen} options={{ tabBarLabel: 'Plans' }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: t('profile') }} />
      <Tabs.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: t('settings') }} />
    </Tabs.Navigator>
  );
}

function AuthFlow() {
  const { signup, completeProfileSetup, isNewSignup, loginWithToken } = useAuth();
  const [authMode, setAuthMode] = useState<
    | 'welcome'
    | 'login'
    | 'phone-login'
    | 'signup-profile-type'
    | 'signup-basic'
    | 'signup-personal'
    | 'signup-religious'
    | 'signup-location'
    | 'signup-professional'
    | 'signup-additional'
    | 'signup-photos'
    | 'signup-horoscope'
    | 'signup-star'
    | 'signup-eating-habits'
    | 'signup-interests'
  >(isNewSignup ? 'signup-photos' : 'welcome');

  const [signupData, setSignupData] = useState<{
    profileTypeData?: ProfileTypeData;
    basicDetails?: BasicDetailsData;
    personalDetails?: PersonalDetailsData;
    religiousDetails?: ReligiousDetailsData;
    locationDetails?: LocationDetailsData;
    professionalDetails?: ProfessionalDetailsData;
    additionalDetails?: AdditionalDetailsData;
    interests?: InterestsData;
    eatingHabit?: EatingHabit;
    horoscope?: HoroscopeData;
    starDetails?: StarDetailsData;
    photos?: Photo[];
  }>({});

  // Who the signup questions are about, so each step can address them by

  // relationship rather than always saying "you".

  const signupSubject = subjectFor(signupData.profileTypeData?.profileType);


  const patch = (next: Partial<typeof signupData>) => setSignupData((prev) => ({ ...prev, ...next }));

  const isoDateOfBirth = (() => {
    const dob = signupData.personalDetails?.dateOfBirth;
    if (!dob?.year || !dob?.month || !dob?.day) {
      return undefined;
    }
    return `${dob.year}-${dob.month}-${dob.day}`;
  })();

  /**
   * Creates the account once the five required steps are complete. The phone
   * OTP was already verified during the basic-details step; every screen after
   * this point only enriches the profile that now exists.
   */
  const createAccount = async (additional: AdditionalDetailsData) => {
    const basic = signupData.basicDetails;
    const pd = signupData.personalDetails;
    const rd = signupData.religiousDetails;
    const ld = signupData.locationDetails;
    const prof = signupData.professionalDetails;

    if (!basic) {
      return;
    }

    const dobYear = pd?.dateOfBirth?.year ? Number(pd.dateOfBirth.year) : undefined;
    const age = dobYear ? new Date().getFullYear() - dobYear : undefined;

    const familyStatusLabels: Record<string, string> = {
      middle_class: 'Middle Class',
      upper_middle_class: 'Upper Middle Class',
      rich_affluent: 'Rich / Affluent',
    };

    await signup({
      name: basic.fullName,
      email: basic.email,
      password: basic.password,
      phone: basic.phone,
      profileCreatedFor: signupData.profileTypeData?.profileType,
      motherTongue: signupData.profileTypeData?.motherTongue,
      language: signupData.profileTypeData?.motherTongue,
      gender: pd?.gender,
      age,
      dateOfBirth: isoDateOfBirth,
      height: pd?.height,
      maritalStatus: pd?.maritalStatus?.replace(/_/g, ' '),
      physicalStatus: pd?.physicalStatus?.replace(/_/g, ' '),
      religion: rd?.religion,
      caste: rd?.caste,
      community: rd?.caste,
      subcaste: rd?.subcaste,
      subCommunity: rd?.subcaste,
      openToAnySubcaste: rd?.openToAnySubcaste,
      dosh: rd?.dosh,
      country: ld?.country,
      state: ld?.state,
      city: ld?.city,
      location: ld?.city,
      village: ld?.village,
      nativeCity: ld?.nativeCity,
      nativeVillage: ld?.nativeVillage,
      education: prof?.education,
      employmentType: prof?.employmentType,
      occupation: prof?.occupation,
      incomeCurrency: prof?.incomeCurrency,
      annualIncome: prof?.annualIncome,
      familyStatus: additional.familyStatus
        ? familyStatusLabels[additional.familyStatus] || additional.familyStatus
        : undefined,
      familyType: additional.familyType?.replace(/_/g, ' '),
      familyWealth: additional.familyWealth,
      fatherName: additional.fatherName,
      motherName: additional.motherName,
      fatherOccupation: additional.fatherOccupation,
      motherOccupation: additional.motherOccupation,
      siblings: additional.siblings,
      bio: additional.bio,
    });
  };

  /** Persists an optional post-signup enrichment step. */
  const saveProfilePatch = async (payload: Record<string, unknown>) => {
    try {
      await api.updateMyMatrimonyProfile(payload as any);
    } catch {}
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
      return <LoginScreen onPhoneLogin={() => setAuthMode('phone-login')} onSignup={() => setAuthMode('signup-profile-type')} />;
    case 'phone-login':
      return (
        <PhoneLoginScreen
          onLoginSuccess={async (token, userId) => {
            await loginWithToken(token, userId);
          }}
          onBack={() => setAuthMode('login')}
        />
      );
    case 'signup-profile-type':
      return (
        <SignupProfileTypeScreen
          onBack={() => setAuthMode('welcome')}
          onNext={(data) => {
            patch({ profileTypeData: data });
            setAuthMode('signup-basic');
          }}
        />
      );
    case 'signup-basic':
      return (
        <SignupBasicDetailsScreen
          onBack={() => setAuthMode('signup-profile-type')}
          onSubmit={(data) => {
            patch({ basicDetails: data });
            setAuthMode('signup-personal');
          }}
          onExistingAccount={() => setAuthMode('login')}
        />
      );
    case 'signup-personal':
      return (
        <SignupPersonalDetailsScreen
          subject={signupSubject}
          onBack={() => setAuthMode('signup-basic')}
          onNext={(data) => {
            patch({ personalDetails: data });
            setAuthMode('signup-religious');
          }}
        />
      );
    case 'signup-religious':
      return (
        <SignupReligiousDetailsScreen
          subject={signupSubject}
          onBack={() => setAuthMode('signup-personal')}
          onNext={(data) => {
            patch({ religiousDetails: data });
            setAuthMode('signup-location');
          }}
        />
      );
    case 'signup-location':
      return (
        <SignupLocationDetailsScreen
          subject={signupSubject}
          onBack={() => setAuthMode('signup-religious')}
          onNext={(data) => {
            patch({ locationDetails: data });
            setAuthMode('signup-professional');
          }}
        />
      );
    case 'signup-professional':
      return (
        <SignupProfessionalDetailsScreen
          onBack={() => setAuthMode('signup-location')}
          onNext={(data) => {
            patch({ professionalDetails: data });
            setAuthMode('signup-additional');
          }}
        />
      );
    case 'signup-additional':
      return (
        <SignupAdditionalDetailsScreen
          subject={signupSubject}
          onBack={() => setAuthMode('signup-professional')}
          onSubmit={async (data) => {
            patch({ additionalDetails: data });
            await createAccount(data);
            setAuthMode('signup-photos');
          }}
        />
      );
    case 'signup-photos':
      return (
        <SignupManagePhotosScreen
          onBack={() => setAuthMode('signup-additional')}
          onComplete={async (photos) => {
            patch({ photos });
            if (photos.length > 0) {
              await saveProfilePatch({ profile: { photos } });
            }
            setAuthMode('signup-horoscope');
          }}
        />
      );
    case 'signup-horoscope':
      return (
        <SignupHoroscopeScreen
          dateOfBirth={isoDateOfBirth}
          onBack={() => setAuthMode('signup-photos')}
          onNext={async (data) => {
            patch({ horoscope: data });
            await saveProfilePatch({
              matrimony: { horoscopeTime: data.timeOfBirth, horoscopePlace: data.placeOfBirth },
            });
            setAuthMode('signup-star');
          }}
          onSkip={() => setAuthMode('signup-star')}
        />
      );
    case 'signup-star':
      return (
        <SignupStarDetailsScreen
          onBack={() => setAuthMode('signup-horoscope')}
          onNext={async (data) => {
            patch({ starDetails: data });
            await saveProfilePatch({ matrimony: { nakshatra: data.nakshatra, raasi: data.raasi } });
            setAuthMode('signup-eating-habits');
          }}
          onSkip={() => setAuthMode('signup-eating-habits')}
        />
      );
    case 'signup-eating-habits':
      return (
        <SignupEatingHabitsScreen
          subject={signupSubject}
          onBack={() => setAuthMode('signup-star')}
          onNext={async (habit) => {
            patch({ eatingHabit: habit });
            await saveProfilePatch({ matrimony: { eatingHabit: habit } });
            setAuthMode('signup-interests');
          }}
          onSkip={() => setAuthMode('signup-interests')}
        />
      );
    case 'signup-interests':
      return (
        <SignupInterestsScreen
          subject={signupSubject}
          onBack={() => setAuthMode('signup-eating-habits')}
          onNext={async (data) => {
            patch({ interests: data });
            await saveProfilePatch({
              matrimony: {
                hobbies: data.hobbies,
                music: data.music,
                sports: data.sports,
                cuisine: data.cuisine,
              },
            });
            await completeProfileSetup();
          }}
          onSkip={async () => {
            await completeProfileSetup();
          }}
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
