import React, { useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { DashboardScreen } from '../screens/DashboardScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { VerificationScreen } from '../screens/VerificationScreen';
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
import { SignupVerifyScreen } from '../screens/SignupVerifyScreen';
import { useAppTheme } from '../context/ThemeContext';
import { AnimatedTabBar } from '../components/AnimatedTabBar';
import { useAppLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { subjectFor } from '../constants/profileSubject';
import { clearSignupDraft, loadSignupDraft, saveSignupDraft, verificationStillValid } from '../utils/signupDraft';

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
      <Tabs.Screen name="Interests" component={InterestsScreen} options={{ tabBarLabel: t('interests') }} />
      <Tabs.Screen name="Messages" component={MessagesScreen} options={{ tabBarLabel: t('messages') }} />
      <Tabs.Screen name="Subscriptions" component={SubscriptionsScreen} options={{ tabBarLabel: t('plans') }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: t('profile') }} />
      <Tabs.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: t('settings') }} />
    </Tabs.Navigator>
  );
}

type AuthMode =
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
  | 'signup-verify'
  | 'signup-horoscope'
  | 'signup-star'
  | 'signup-eating-habits'
  | 'signup-interests';

// Steps before the account exists: the only ones worth saving and resuming.
const BEFORE_ACCOUNT: AuthMode[] = [
  'signup-profile-type',
  'signup-basic',
  'signup-personal',
  'signup-religious',
  'signup-location',
  'signup-professional',
  'signup-additional',
];

/*
 * Where the phone's Back button goes from each screen: the same place as the
 * on-screen arrow. Nothing handled it before, so Back closed the app mid-signup
 * and every answer was lost. `null` = stay put (the account already exists, so
 * going back to re-create it makes no sense); missing = let Android close the app.
 */
const BACK_TO: Partial<Record<AuthMode, AuthMode | null>> = {
  login: 'welcome',
  'phone-login': 'login',
  'signup-profile-type': 'welcome',
  'signup-basic': 'signup-profile-type',
  'signup-personal': 'signup-basic',
  'signup-religious': 'signup-personal',
  'signup-location': 'signup-religious',
  'signup-professional': 'signup-location',
  'signup-additional': 'signup-professional',
  'signup-photos': null,
  'signup-verify': 'signup-photos',
  'signup-horoscope': 'signup-verify',
  'signup-star': 'signup-horoscope',
  'signup-eating-habits': 'signup-star',
  'signup-interests': 'signup-eating-habits',
};

function AuthFlow() {
  const { signup, completeProfileSetup, isNewSignup, loginWithToken } = useAuth();
  const { language } = useAppLanguage();
  const [authMode, setAuthMode] = useState<AuthMode>(isNewSignup ? 'signup-photos' : 'welcome');

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

  const signupSubject = subjectFor(signupData.profileTypeData?.profileType, language);


  const patch = (next: Partial<typeof signupData>) => setSignupData((prev) => ({ ...prev, ...next }));

  // The address whose emailed code was entered, so a resumed signup does not
  // ask for another code while the server still accepts this one.
  const [verified, setVerified] = useState<{ email: string; at: number } | null>(null);
  const [restoring, setRestoring] = useState(!isNewSignup);
  const restoringRef = useRef(restoring);

  useEffect(() => {
    if (!restoringRef.current) return;
    let cancelled = false;
    loadSignupDraft<typeof signupData>().then((draft) => {
      if (cancelled) return;
      if (draft && BEFORE_ACCOUNT.includes(draft.mode as AuthMode)) {
        setSignupData(draft.data);
        const stillVerified = verificationStillValid(draft) && draft.verifiedEmail && draft.data.basicDetails?.password;
        if (stillVerified) {
          setVerified({ email: draft.verifiedEmail as string, at: draft.verifiedAt as number });
          setAuthMode(draft.mode as AuthMode);
        } else {
          // Past the email step but the code has lapsed (or the password could
          // not be read back): the details are kept, only the code is asked again.
          const pastBasic = BEFORE_ACCOUNT.indexOf(draft.mode as AuthMode) > BEFORE_ACCOUNT.indexOf('signup-basic');
          setAuthMode(pastBasic ? 'signup-basic' : (draft.mode as AuthMode));
        }
      }
      restoringRef.current = false;
      setRestoring(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (restoring || !BEFORE_ACCOUNT.includes(authMode)) return;
    saveSignupDraft({
      mode: authMode,
      data: signupData,
      verifiedEmail: verified?.email ?? null,
      verifiedAt: verified?.at ?? null,
      savedAt: Date.now(),
    });
  }, [restoring, authMode, signupData, verified]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!(authMode in BACK_TO)) return false;
      const target = BACK_TO[authMode];
      if (target) setAuthMode(target);
      return true;
    });
    return () => sub.remove();
  }, [authMode]);

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

    if (!basic?.password) {
      // Nothing to sign up with (a resumed draft whose password could not be
      // read back): the email step asks for it again.
      setAuthMode('signup-basic');
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
    await clearSignupDraft();
    setAuthMode('signup-photos');
  };

  /** Persists an optional post-signup enrichment step. */
  const saveProfilePatch = async (payload: Record<string, unknown>) => {
    try {
      await api.updateMyMatrimonyProfile(payload as any);
    } catch {}
  };

  if (restoring) {
    return <LoadingScreen />;
  }

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
          initial={signupData.profileTypeData}
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
          initial={signupData.basicDetails}
          verifiedEmail={verified && verificationStillValid({ verifiedAt: verified.at }) ? verified.email : null}
          onBack={() => setAuthMode('signup-profile-type')}
          onSubmit={(data) => {
            patch({ basicDetails: data });
            const email = data.email.trim().toLowerCase();
            // Re-submitting with the already verified address keeps its time;
            // a new address was just verified now.
            if (verified?.email !== email) setVerified({ email, at: Date.now() });
            setAuthMode('signup-personal');
          }}
          onExistingAccount={() => setAuthMode('login')}
        />
      );
    case 'signup-personal':
      return (
        <SignupPersonalDetailsScreen
          subject={signupSubject}
          initial={signupData.personalDetails}
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
          initial={signupData.religiousDetails}
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
          initial={signupData.locationDetails}
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
          initial={signupData.professionalDetails}
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
          initial={signupData.additionalDetails}
          onBack={() => setAuthMode('signup-professional')}
          onSubmit={async (data) => {
            patch({ additionalDetails: data });
            // Back from the photos step lands here with the account already
            // made; creating it again would only answer "already registered".
            if (isNewSignup) {
              setAuthMode('signup-photos');
              return;
            }
            try {
              await createAccount(data);
            } catch (err: any) {
              // The server no longer accepts the email check (over 24 hours):
              // everything typed is kept, only the code is asked again.
              if (err?.code === 'EMAIL_NOT_VERIFIED') {
                setVerified(null);
                setAuthMode('signup-basic');
                return;
              }
              throw err;
            }
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
            setAuthMode('signup-verify');
          }}
        />
      );
    case 'signup-verify':
      return (
        <SignupVerifyScreen
          onBack={() => setAuthMode('signup-photos')}
          onNext={() => setAuthMode('signup-horoscope')}
        />
      );
    case 'signup-horoscope':
      return (
        <SignupHoroscopeScreen
          dateOfBirth={isoDateOfBirth}
          onBack={() => setAuthMode('signup-verify')}
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
      {(session && !isNewSignup) ? <Stack.Screen name="Notifications" component={NotificationsScreen} /> : null}
      {(session && !isNewSignup) ? <Stack.Screen name="Verification" component={VerificationScreen} /> : null}
    </Stack.Navigator>
  );
}
