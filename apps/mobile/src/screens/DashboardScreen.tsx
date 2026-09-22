import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop, Ellipse } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { useAppLanguage } from '../context/LanguageContext';
import { optionLabel } from '../constants/optionTranslations';
import { api } from '../services/api';
import { MatrimonyProfileDetailScreen } from './MatrimonyProfileDetailScreen';
import { AppGuideScreen } from './AppGuideScreen';
import type { ThemePalette } from '../context/ThemeContext';
import { FadeInView, PressableScale, Pulse } from '../components/Motion';
import type { MatrimonyProfile } from '../types';

export function DashboardScreen() {
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t, language } = useAppLanguage();
  const styles = React.useMemo(() => createStyles(palette), [palette]);
  const { session } = useAuth();
  const navigation = useNavigation<any>();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [totalProfiles, setTotalProfiles] = useState(0);
  const [recentProfiles, setRecentProfiles] = useState<MatrimonyProfile[]>([]);
  const [sentInterests, setSentInterests] = useState(0);
  const [receivedInterests, setReceivedInterests] = useState(0);
  const [acceptedInterests, setAcceptedInterests] = useState(0);
  const [myProfile, setMyProfile] = useState<any>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setError(null);
      const [matrimonyRes, interestsRes, myProfileRes] = await Promise.all([
        api.getMatrimonyProfiles({ tab: 'all' }),
        api.getMyInterests().catch(() => ({ sent: [], received: [] })),
        api.getMyMatrimonyProfile().catch(() => null),
      ]);
      setTotalProfiles(matrimonyRes.profiles.length);
      /*
       * Only the profiles this member may actually see.
       *
       * Past the free allowance the server sends { id, isLocked } and nothing
       * else, and this strip rendered those as a card reading "Member ·
       * Chaudhary" with a male symbol — no name, and the wrong gender sign,
       * because an absent gender is not female. Better to show fewer real
       * people than four cards of placeholder.
       */
      setRecentProfiles(matrimonyRes.profiles.filter((p: MatrimonyProfile) => !p.isLocked).slice(0, 4));
      setSentInterests(interestsRes.sent.length);
      setReceivedInterests(interestsRes.received.length);
      setAcceptedInterests(interestsRes.sent.filter((i: any) => i.status === 'accepted').length);
      setMyProfile(myProfileRes);
    } catch (err) {
      setError((err as Error).message || t('dashLoadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadDashboard();
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.bg }}>
        <Ionicons name="heart" size={40} color={palette.primary} />
        <Text style={{ marginTop: 12, color: palette.primary, fontWeight: '600', fontSize: 15 }}>{t('dashboardFindingMatches')}</Text>
      </View>
    );
  }

  const userName = session?.user?.name || t('lblMember');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('greetingMorning') : hour < 17 ? t('greetingAfternoon') : t('greetingEvening');
  /*
   * /matrimony/me answers { user, profile, matrimony, preferences } — age
   * lives under matrimony, location under profile. Reading them from the top
   * level found neither, so a filled-in profile reported "Age not set,
   * Location not set" and stayed flagged incomplete for ever.
   */
  const myAge = myProfile?.matrimony?.age ?? myProfile?.profile?.age ?? myProfile?.age;
  const myLocation =
    myProfile?.profile?.location ??
    myProfile?.matrimony?.location ??
    myProfile?.location ??
    myProfile?.profile?.city;
  const profileComplete = Boolean(myAge && myLocation);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
    >
      {/* Hero Banner */}
      <View style={[styles.heroCard, { height: 200 + insets.top }]}>
        <Svg style={StyleSheet.absoluteFill as any} width="100%" height="100%" viewBox="0 0 380 200" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <LinearGradient id="heroGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#5B5BD6" />
              <Stop offset="0.55" stopColor="#7C4DDA" />
              <Stop offset="1" stopColor="#3D3B9E" />
            </LinearGradient>
            <LinearGradient id="shineH" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#ffffff" stopOpacity="0.14" />
              <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="380" height="200" fill="url(#heroGrad)" />
          <Rect x="0" y="0" width="380" height="100" fill="url(#shineH)" />
          <Circle cx="340" cy="30" r="70" fill="#ffffff" fillOpacity="0.06" />
          <Circle cx="350" cy="160" r="45" fill="#ffffff" fillOpacity="0.05" />
          <Circle cx="15" cy="170" r="55" fill="#ffffff" fillOpacity="0.05" />
          <Ellipse cx="100" cy="210" rx="120" ry="40" fill="#ffffff" fillOpacity="0.04" />
          <Path d="M0 140 C 80 115, 160 155, 240 130 C 300 112, 345 135, 380 120 L380 200 L0 200 Z" fill="#ffffff" fillOpacity="0.07" />
          <Circle cx="60" cy="60" r="4" fill="#ffffff" fillOpacity="0.3" />
          <Circle cx="85" cy="45" r="2.5" fill="#ffffff" fillOpacity="0.25" />
          <Circle cx="260" cy="150" r="5" fill="#ffffff" fillOpacity="0.2" />
        </Svg>
        <View style={[styles.heroContent, { paddingTop: insets.top + 28 }]}>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>💍 Chaudhary Matrimony</Text>
          </View>
          <Text style={styles.heroGreeting}>{greeting},</Text>
          <Text style={styles.heroName}>{userName} 👋</Text>
          <Text style={styles.heroSub}>{t('dashboardFindMatches')}</Text>
        </View>
      </View>

      {/* A first-time member lands here with seven tabs and no idea what any of
          them do. One row, directly under the hero, before the stats. */}
      <Pressable
        style={({ pressed }) => [styles.guideButton, pressed && { opacity: 0.6 }]}
        onPress={() => setGuideOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('guideTitle')}
      >
        <View style={styles.guideIcon}>
          <Ionicons name="book-outline" size={22} color={palette.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.guideTitle}>{t('guideTitle')}</Text>
          <Text style={styles.guideSub}>{t('guideSubtitle')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={palette.muted} />
      </Pressable>

      <AppGuideScreen visible={guideOpen} onClose={() => setGuideOpen(false)} />

      {/* Error */}
      {!!error && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={16} color={palette.warning} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Profile Incomplete Banner */}
      {!profileComplete && (
        <PressableScale style={styles.incompleteBanner} onPress={() => navigation.navigate('Profile')}>
          <View style={styles.incompleteBannerLeft}>
            <Ionicons name="person-circle-outline" size={32} color={palette.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.incompleteBannerTitle}>{t('dashboardCompleteProfile')}</Text>
              <Text style={styles.incompleteBannerSub}>{t('dashboardCompleteProfileSub')}</Text>
            </View>
          </View>
          <Pulse style={styles.incompleteBannerBadge}>
            <Text style={styles.incompleteBannerBadgeText}>→</Text>
          </Pulse>
        </PressableScale>
      )}

      {/* Interests Stats.
          Each tile was a plain View, so tapping the count of received
          interests — the obvious thing to do when it reads 3 — did nothing.
          They now go where the number came from. */}
      <Text style={styles.sectionTitle}>{t('dashboardMyActivity')}</Text>
      <View style={styles.statsRow}>
        {[
          { icon: 'paper-plane', tint: palette.primary, bg: palette.primarySoft, value: sentInterests, label: t('dashboardInterestsSent'), go: 'Interests' },
          { icon: 'mail', tint: palette.violet, bg: palette.primarySoft, value: receivedInterests, label: t('dashboardInterestsReceived'), go: 'Interests' },
          { icon: 'checkmark-circle', tint: palette.accent, bg: palette.accentSoft, value: acceptedInterests, label: t('dashboardInterestsAccepted'), go: 'Messages' },
          { icon: 'people', tint: palette.primaryDeep, bg: palette.primarySoft, value: totalProfiles, label: t('dashboardTotalProfiles'), go: 'Matrimony' },
        ].map((tile, i) => (
          <FadeInView key={tile.label} index={i} style={styles.statPillWrap}>
            <PressableScale
              style={[styles.statPill, { backgroundColor: tile.bg }]}
              onPress={() => navigation.navigate(tile.go)}
              accessibilityRole="button"
              accessibilityLabel={`${tile.label}: ${tile.value}`}
            >
              <Ionicons name={tile.icon as any} size={18} color={tile.tint} />
              <Text style={[styles.statPillValue, { color: tile.tint }]}>{tile.value}</Text>
              <Text style={styles.statPillLabel}>{tile.label}</Text>
            </PressableScale>
          </FadeInView>
        ))}
      </View>

      {/* Recent Profiles */}
      {recentProfiles.length > 0 && (
        <>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('dashboardRecentProfiles')}</Text>
            <Pressable onPress={() => navigation.navigate('Matrimony')} hitSlop={8}>
              <Text style={styles.seeAllText}>{t('viewAll')} ›</Text>
            </Pressable>
          </View>
          <View style={styles.profilesGrid}>
            {recentProfiles.map((profile, i) => (
              <FadeInView key={profile.id} index={i} style={styles.profileCardWrap}>
              <PressableScale style={styles.profileCard} onPress={() => setSelectedProfileId(profile.id)}>
                <View style={styles.profileAvatar}>
                  <Ionicons name="person" size={28} color={palette.primary} />
                </View>
                <Text style={styles.profileName} numberOfLines={1}>
                  {profile.name || t('lblMember')}
                </Text>
                <Text style={styles.profileMeta} numberOfLines={1}>
                  {[
                    profile.age ? t('dashAgeShort', { age: profile.age }) : null,
                    optionLabel(profile.location || '', language),
                  ]
                    .filter(Boolean)
                    .join(' • ') || optionLabel('Chaudhary', language)}
                </Text>
                {/* Compared case-insensitively: stored values have not always
                    been lowercase, and a capitalised one showed the wrong sign. */}
                <View style={[styles.profileBadge, (profile.gender || '').toLowerCase() === 'female' ? styles.profileBadgeFemale : styles.profileBadgeMale]}>
                  <Text style={styles.profileBadgeText}>{(profile.gender || '').toLowerCase() === 'female' ? '♀' : '♂'}</Text>
                </View>
              </PressableScale>
              </FadeInView>
            ))}
          </View>
        </>
      )}

      {/* My Profile Card */}
      <Text style={styles.sectionTitle}>{t('dashboardMyProfile')}</Text>
      <Pressable style={styles.myProfileCard} onPress={() => navigation.navigate('Profile')}>
        <View style={styles.myProfileLeft}>
          <View style={styles.myProfileAvatar}>
            <Ionicons name="person" size={36} color="#ffffff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.myProfileName}>{userName}</Text>
            <Text style={styles.myProfileMeta}>
              {myAge ? t('dashYearsShort', { age: myAge }) : t('dashAgeNotSet')} • {myLocation || t('dashLocationNotSet')}
            </Text>
            <View style={styles.myProfileStatus}>
              <View style={[styles.myProfileDot, { backgroundColor: profileComplete ? palette.accent : palette.violet }]} />
              <Text style={styles.myProfileStatusText}>{profileComplete ? t('dashProfileComplete') : t('dashProfileIncomplete')}</Text>
            </View>
          </View>
        </View>
      </Pressable>

      <View style={{ height: 30 }} />

      {/* Profile Detail Modal */}
      <Modal visible={!!selectedProfileId} animationType="slide" onRequestClose={() => setSelectedProfileId(null)}>
        {selectedProfileId && (
          <MatrimonyProfileDetailScreen
            profileId={selectedProfileId}
            onBack={() => setSelectedProfileId(null)}
          />
        )}
      </Modal>
    </ScrollView>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.bg },
    content: { paddingBottom: 32 },
    heroCard: { height: 200, marginBottom: 20, overflow: 'hidden', position: 'relative' },
    heroContent: { flex: 1, padding: 24, paddingTop: 28, justifyContent: 'flex-end' },
    heroPill: {
      alignSelf: 'flex-start', marginBottom: 'auto',
      backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20,
      paddingHorizontal: 12, paddingVertical: 5,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    },
    heroPillText: { color: '#ffffff', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
    heroGreeting: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500', marginBottom: 2 },
    heroName: { color: '#ffffff', fontSize: 26, fontWeight: '800', letterSpacing: -0.3 },
    heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 3 },
    guideButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: palette.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.border,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    guideIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: palette.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    guideTitle: { fontSize: 15.5, fontWeight: '700', color: palette.text },
    guideSub: { fontSize: 13, color: palette.muted, marginTop: 1 },
    errorBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: palette.warningSoft, borderRadius: 10, padding: 12,
      marginHorizontal: 16, marginBottom: 12,
      borderWidth: 1, borderColor: palette.warning,
    },
    errorText: { color: palette.warning, fontSize: 13, flex: 1 },
    incompleteBanner: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: palette.surface, borderRadius: 14, padding: 14,
      marginHorizontal: 16, marginBottom: 16,
      borderWidth: 1.5, borderColor: palette.primary,
      shadowColor: palette.primary, shadowOpacity: 0.1,
      shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
    },
    incompleteBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    incompleteBannerTitle: { fontSize: 14, fontWeight: '700', color: palette.text },
    incompleteBannerSub: { fontSize: 12, color: palette.muted, marginTop: 2 },
    incompleteBannerBadge: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: palette.primary, justifyContent: 'center', alignItems: 'center',
    },
    incompleteBannerBadgeText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    sectionTitle: {
      fontSize: 17, fontWeight: '700', color: palette.text,
      marginBottom: 10, marginTop: 4, paddingHorizontal: 16,
    },
    statsRow: {
      flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: 8,
    },
    /* The flex that used to sit on the pill now sits on the animated wrapper
       around it, so the four tiles still share the row evenly. */
    statPillWrap: { flex: 1 },
    statPill: {
      flex: 1, borderRadius: 16, padding: 12, alignItems: 'center', gap: 4,
      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 }, elevation: 1,
    },
    statPillValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
    statPillLabel: { fontSize: 10, color: palette.muted, fontWeight: '600', textAlign: 'center', lineHeight: 13 },
    profilesGrid: {
      flexDirection: 'row', flexWrap: 'wrap',
      paddingHorizontal: 12, gap: 10, marginBottom: 8,
    },
    profileCardWrap: { flex: 1, minWidth: '44%' },
    sectionHeaderRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, marginTop: 8, marginBottom: 10,
    },
    seeAllText: { fontSize: 13, fontWeight: '700', color: palette.primary },
    profileCard: {
      backgroundColor: palette.surface,
      borderRadius: 16, padding: 14, alignItems: 'center',
      shadowColor: '#000', shadowOpacity: 0.06,
      shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
      position: 'relative',
    },
    profileAvatar: {
      width: 60, height: 60, borderRadius: 30,
      backgroundColor: palette.primarySoft, justifyContent: 'center', alignItems: 'center',
      marginBottom: 8, borderWidth: 2, borderColor: palette.border,
    },
    profileName: { fontSize: 13, fontWeight: '700', color: palette.text, textAlign: 'center' },
    profileMeta: { fontSize: 11, color: palette.muted, marginTop: 3, textAlign: 'center' },
    profileBadge: {
      position: 'absolute', top: 10, right: 10,
      width: 22, height: 22, borderRadius: 11,
      justifyContent: 'center', alignItems: 'center',
    },
    // Gender tints reuse the pink/blue soft tokens so they stay legible in dark
    // mode; the semantics come from the icon, not the colour.
    profileBadgeFemale: { backgroundColor: palette.dangerSoft },
    profileBadgeMale: { backgroundColor: palette.infoSoft },
    profileBadgeText: { fontSize: 12, fontWeight: '700' },
    myProfileCard: {
      backgroundColor: palette.surface, borderRadius: 16,
      padding: 16, marginHorizontal: 16, marginBottom: 8,
      shadowColor: '#000', shadowOpacity: 0.05,
      shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
    },
    myProfileLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    myProfileAvatar: {
      width: 64, height: 64, borderRadius: 32,
      backgroundColor: palette.primary, justifyContent: 'center', alignItems: 'center',
    },
    myProfileName: { fontSize: 17, fontWeight: '800', color: palette.text },
    myProfileMeta: { fontSize: 13, color: palette.muted, marginTop: 3 },
    myProfileStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    myProfileDot: { width: 8, height: 8, borderRadius: 4 },
    myProfileStatusText: { fontSize: 12, color: palette.muted, fontWeight: '600' },
  });
}
