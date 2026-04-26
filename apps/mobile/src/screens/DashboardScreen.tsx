import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { InlineError, ScreenLoader } from '../components/AppFeedback';
import { PrimaryButton, ScreenTitle, SectionCard } from '../components/AppPrimitives';
import { api } from '../services/api';
import { radius, spacing, type } from '../theme';
import type { CommunityFeedStats, EventSummaryStats, HelpNeedRequest } from '../types';
import { BrandArtwork } from '../components/BrandArtwork';
import type { ThemePalette } from '../context/ThemeContext';

const defaultEventStats: EventSummaryStats = {
  totalCreated: 0,
  upcomingCount: 0,
  pastCount: 0,
  pendingCount: 0,
  fullyCollectedCount: 0,
};

const defaultCommunityStats: CommunityFeedStats = {
  totalPosts: 0,
  pinnedPosts: 0,
  upcomingMeetings: 0,
  byCategory: {},
};

export function DashboardScreen() {
  const { palette } = useAppTheme();
  const styles = React.useMemo(() => createStyles(palette), [palette]);
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [eventStats, setEventStats] = useState<EventSummaryStats>(defaultEventStats);
  const [communityStats, setCommunityStats] = useState<CommunityFeedStats>(defaultCommunityStats);
  const [businessCount, setBusinessCount] = useState(0);
  const [helpOpenCount, setHelpOpenCount] = useState(0);
  const [matrimonyCount, setMatrimonyCount] = useState(0);

  const loadDashboard = useCallback(async () => {
    try {
      setError(null);

      const [eventsRes, communityRes, businessRes, helpRes, matrimonyRes] = await Promise.all([
        api.getEventSummary(),
        api.getCommunityFeedStats(),
        api.getBusinessListings(),
        api.getHelpAndNeed({ status: 'open' }),
        api.getMatrimonyProfiles({ tab: 'all' }),
      ]);

      setEventStats(eventsRes);
      setCommunityStats(communityRes);
      setBusinessCount(businessRes.listings.length);
      setHelpOpenCount(
        helpRes.requests.filter((item: HelpNeedRequest) => item.status === 'open').length
      );
      setMatrimonyCount(matrimonyRes.profiles.length);
    } catch (err) {
      setError((err as Error).message || 'Unable to load dashboard');
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
    return <ScreenLoader message="Loading dashboard..." />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.heroWrap}>
        <BrandArtwork compact />
        <View style={styles.heroOverlay}>
          <Text style={styles.heroBadge}>Premium Community Lane</Text>
          <Text style={styles.heroTitle}>Community Snapshot</Text>
        </View>
      </View>

      <SectionCard>
        <ScreenTitle title={`Welcome, ${session?.user?.name || 'Member'}`} subtitle="Swiggy-style discovery shell is now active for mobile." />
      </SectionCard>

      {error ? <InlineError message={error} /> : null}

      <View style={styles.gridRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Matrimony Matches</Text>
          <Text style={styles.metricValue}>{matrimonyCount}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Business Listings</Text>
          <Text style={styles.metricValue}>{businessCount}</Text>
        </View>
      </View>

      <View style={styles.gridRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Open Help Requests</Text>
          <Text style={styles.metricValue}>{helpOpenCount}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Community Posts</Text>
          <Text style={styles.metricValue}>{communityStats.totalPosts}</Text>
        </View>
      </View>

      <SectionCard>
        <Text style={styles.cardTitle}>Events Summary</Text>
        <Text style={styles.cardText}>Created: {eventStats.totalCreated}</Text>
        <Text style={styles.cardText}>Upcoming: {eventStats.upcomingCount}</Text>
        <Text style={styles.cardText}>Past: {eventStats.pastCount}</Text>
        <Text style={styles.cardText}>Pending Collection: {eventStats.pendingCount}</Text>
      </SectionCard>

      <SectionCard>
        <Text style={styles.cardTitle}>Community Summary</Text>
        <Text style={styles.cardText}>Pinned announcements: {communityStats.pinnedPosts}</Text>
        <Text style={styles.cardText}>Upcoming meetings: {communityStats.upcomingMeetings}</Text>
      </SectionCard>

      <PrimaryButton label="Refresh Dashboard" onPress={onRefresh} />

      <SectionCard>
        <Text style={styles.noteTitle}>Mobile Migration Progress</Text>
        <Text style={styles.noteText}>Auth, Matrimony, Events, Help and Need, Business, and Community are backend-connected.</Text>
      </SectionCard>
    </ScrollView>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  heroWrap: {
    marginBottom: spacing.xs,
    position: 'relative',
  },
  heroOverlay: {
    position: 'absolute',
    left: spacing.md,
    top: spacing.sm,
    right: spacing.md,
  },
  heroBadge: {
    color: palette.primarySoft,
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  heroTitle: {
    marginTop: 4,
    color: palette.surface,
    fontSize: 24,
    fontWeight: '800',
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  metricCard: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.sm,
    shadowColor: palette.text,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  metricLabel: {
    ...type.caption,
  },
  metricValue: {
    marginTop: spacing.xs,
    fontSize: 22,
    fontWeight: '700',
    color: palette.text,
  },
  cardTitle: {
    fontWeight: '700',
    color: palette.text,
    marginBottom: spacing.xs,
  },
  cardText: {
    color: palette.muted,
    marginBottom: 2,
  },
  noteTitle: {
    fontWeight: '700',
    color: palette.text,
  },
  noteText: {
    marginTop: spacing.xs,
    color: palette.primary,
  },
  });
}
