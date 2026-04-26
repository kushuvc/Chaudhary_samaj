import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { EmptyState, InlineError, ScreenLoader } from '../components/AppFeedback';
import { LabeledInput, OptionSelector } from '../components/AppPrimitives';
import { DateInput } from '../components/DateInput';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { api } from '../services/api';
import type { CommunityFeedStats, CommunityMeeting, CommunityPost } from '../types';

const feedTabs = [
  { key: 'all', label: 'All' },
  { key: 'meeting', label: 'Meetings' },
  { key: 'news', label: 'News' },
  { key: 'celebration', label: 'Celebrations' },
  { key: 'update', label: 'Updates' },
  { key: 'achievement', label: 'Achievements' },
  { key: 'lost_found', label: 'Lost & Found' },
  { key: 'pinned', label: 'Pinned' },
] as const;

const postCategories = [
  { key: 'meeting', label: 'Meeting Announcement' },
  { key: 'news', label: 'Community News' },
  { key: 'celebration', label: 'Celebration' },
  { key: 'update', label: 'General Update' },
  { key: 'achievement', label: 'Achievement' },
  { key: 'lost_found', label: 'Lost or Found' },
  { key: 'announcement', label: 'Announcement' },
] as const;

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function categoryLabel(value: string) {
  const found = postCategories.find((item) => item.key === value);
  if (found) {
    return found.label;
  }
  return value.replace(/_/g, ' ');
}

export function CommunityScreen() {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [selectedTab, setSelectedTab] = useState<(typeof feedTabs)[number]['key']>('all');
  const [search, setSearch] = useState('');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [meetings, setMeetings] = useState<CommunityMeeting[]>([]);
  const [stats, setStats] = useState<CommunityFeedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createPostVisible, setCreatePostVisible] = useState(false);
  const [createMeetingVisible, setCreateMeetingVisible] = useState(false);
  const [postForm, setPostForm] = useState({
    title: '',
    author: '',
    category: 'news',
    content: '',
    pinned: false,
  });
  const [meetingForm, setMeetingForm] = useState({
    title: '',
    meetingDate: '',
    location: '',
    host: '',
    agenda: '',
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const selectedQuery = useMemo(() => {
    if (selectedTab === 'all') {
      return { search: search.trim() || undefined };
    }

    if (selectedTab === 'pinned') {
      return { search: search.trim() || undefined, pinnedOnly: true };
    }

    return {
      search: search.trim() || undefined,
      category: selectedTab,
    };
  }, [search, selectedTab]);

  const loadData = async () => {
    try {
      setError(null);
      const [postsResponse, meetingsResponse, statsResponse] = await Promise.all([
        api.getCommunityPosts(selectedQuery),
        api.getCommunityMeetings(),
        api.getCommunityFeedStats(),
      ]);

      setPosts(postsResponse.posts);
      setMeetings(meetingsResponse.meetings);
      setStats(statsResponse);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [selectedQuery.search, selectedQuery.category, selectedQuery.pinnedOnly]);

  const pinnedPosts = posts.filter((post) => post.pinned);
  const visiblePosts = selectedTab === 'pinned' ? pinnedPosts : posts;
  const featuredMeetings = meetings.slice(0, 3);

  const resetPostForm = () => {
    setPostForm({
      title: '',
      author: '',
      category: 'news',
      content: '',
      pinned: false,
    });
    setActionError(null);
    setActionMessage(null);
  };

  const resetMeetingForm = () => {
    setMeetingForm({
      title: '',
      meetingDate: '',
      location: '',
      host: '',
      agenda: '',
    });
    setActionError(null);
    setActionMessage(null);
  };

  const submitPost = async () => {
    try {
      setActionError(null);
      const title = postForm.title.trim();
      const author = postForm.author.trim();
      const content = postForm.content.trim();
      if (!title || !author || !content) {
        setActionError('Title, author, and content are required.');
        return;
      }

      await api.createCommunityPost({
        title,
        author,
        content,
        category: postForm.category,
        pinned: postForm.pinned,
      });

      setCreatePostVisible(false);
      resetPostForm();
      setActionMessage('Post created successfully.');
      setLoading(true);
      await loadData();
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const submitMeeting = async () => {
    try {
      setActionError(null);
      const title = meetingForm.title.trim();
      const host = meetingForm.host.trim();
      const location = meetingForm.location.trim();
      const agenda = meetingForm.agenda.trim();
      const meetingDate = meetingForm.meetingDate.trim();
      if (!title || !host || !location || !agenda || !meetingDate) {
        setActionError('All meeting fields are required.');
        return;
      }

      await api.createCommunityMeeting({
        title,
        host,
        location,
        agenda,
        meetingDate,
      });

      setCreateMeetingVisible(false);
      resetMeetingForm();
      setActionMessage('Meeting created successfully.');
      setLoading(true);
      await loadData();
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  if (loading) {
    return <ScreenLoader message="Loading community feed..." />;
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
    >
      <View style={styles.header}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>Community Feed</Text>
          <Text style={styles.subtitle}>Announcements, celebrations, meetings, and updates</Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable style={styles.primaryButton} onPress={() => setCreatePostVisible(true)}>
            <Text style={styles.primaryButtonText}>Create Post</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => setCreateMeetingVisible(true)}>
            <Text style={styles.secondaryButtonText}>Add Meeting</Text>
          </Pressable>
        </View>
      </View>

      {stats ? (
        <View style={styles.statsGrid}>
          <StatCard label="Total Posts" value={String(stats.totalPosts)} styles={styles} />
          <StatCard label="Pinned" value={String(stats.pinnedPosts)} styles={styles} />
          <StatCard label="Upcoming Meetings" value={String(stats.upcomingMeetings)} styles={styles} />
        </View>
      ) : null}

      <View style={styles.searchCard}>
        <TextInput
          placeholder="Search title, content, or author"
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
          placeholderTextColor={palette.muted}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
        {feedTabs.map((tab) => {
          const active = selectedTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setSelectedTab(tab.key)}
              style={[styles.tab, active ? styles.tabActive : null]}
            >
              <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {actionMessage ? <Text style={styles.success}>{actionMessage}</Text> : null}
      {error ? <InlineError message={error} /> : null}
      {actionError ? <InlineError message={actionError} /> : null}

      <SectionHeader title="Pinned Announcements" subtitle="Important messages highlighted by the community" styles={styles} />
      {pinnedPosts.length > 0 ? (
        pinnedPosts.map((post) => <PostCard key={post.id} post={post} styles={styles} />)
      ) : (
        <EmptyState title="No pinned announcements" subtitle="Pin important posts so members can see them first." />
      )}

      <SectionHeader title="Upcoming Meetings" subtitle="Planned gatherings and community sessions" styles={styles} />
      {featuredMeetings.length > 0 ? (
        featuredMeetings.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} styles={styles} />)
      ) : (
        <EmptyState title="No meetings found" subtitle="Create a meeting to show it here for the community." />
      )}

      <SectionHeader title="Latest Posts" subtitle="Real posts visible to all users" styles={styles} />
      {visiblePosts.length > 0 ? (
        visiblePosts.map((post) => <PostCard key={post.id} post={post} styles={styles} />)
      ) : (
        <EmptyState title="No posts for this filter" subtitle="Try a different category or create a new post." />
      )}

      <Modal visible={createPostVisible} animationType="slide" transparent onRequestClose={() => setCreatePostVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create Post</Text>
            <LabeledInput
              label="Title"
              placeholder="Title"
              value={postForm.title}
              onChangeText={(value) => setPostForm((current) => ({ ...current, title: value }))}
            />
            <LabeledInput
              label="Author"
              placeholder="Author"
              value={postForm.author}
              onChangeText={(value) => setPostForm((current) => ({ ...current, author: value }))}
            />
            <LabeledInput
              label="Content"
              style={styles.textArea}
              placeholder="Content"
              value={postForm.content}
              onChangeText={(value) => setPostForm((current) => ({ ...current, content: value }))}
              multiline
              numberOfLines={4}
            />
            <OptionSelector
              label="Category"
              value={postForm.category}
              options={postCategories.map((category) => category.key)}
              onChange={(value) => setPostForm((current) => ({ ...current, category: value }))}
            />
            <Pressable onPress={() => setPostForm((current) => ({ ...current, pinned: !current.pinned }))} style={styles.checkboxRow}>
              <View style={[styles.checkbox, postForm.pinned ? styles.checkboxChecked : null]} />
              <Text style={styles.checkboxLabel}>Pin this post</Text>
            </Pressable>
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setCreatePostVisible(false)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={submitPost}>
                <Text style={styles.primaryButtonText}>Post</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={createMeetingVisible} animationType="slide" transparent onRequestClose={() => setCreateMeetingVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Meeting</Text>
            <LabeledInput
              label="Meeting Title"
              placeholder="Meeting title"
              value={meetingForm.title}
              onChangeText={(value) => setMeetingForm((current) => ({ ...current, title: value }))}
            />
            <DateInput
              label="Meeting Date"
              value={meetingForm.meetingDate}
              onChange={(value) => setMeetingForm((current) => ({ ...current, meetingDate: value }))}
            />
            <LabeledInput
              label="Location"
              placeholder="Location"
              value={meetingForm.location}
              onChangeText={(value) => setMeetingForm((current) => ({ ...current, location: value }))}
            />
            <LabeledInput
              label="Host"
              placeholder="Host"
              value={meetingForm.host}
              onChangeText={(value) => setMeetingForm((current) => ({ ...current, host: value }))}
            />
            <LabeledInput
              label="Agenda"
              style={styles.textArea}
              placeholder="Agenda"
              value={meetingForm.agenda}
              onChangeText={(value) => setMeetingForm((current) => ({ ...current, agenda: value }))}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setCreateMeetingVisible(false)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={submitMeeting}>
                <Text style={styles.primaryButtonText}>Save Meeting</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

type CommunityStyles = ReturnType<typeof createStyles>;

function SectionHeader({ title, subtitle, styles }: { title: string; subtitle: string; styles: CommunityStyles }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

function StatCard({ label, value, styles }: { label: string; value: string; styles: CommunityStyles }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PostCard({ post, styles }: { post: CommunityPost; styles: CommunityStyles }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <View style={styles.cardBadge}>
          <Text style={styles.cardBadgeText}>{categoryLabel(post.category)}</Text>
        </View>
        {post.pinned ? <Text style={styles.pinnedBadge}>Pinned</Text> : null}
      </View>
      <Text style={styles.cardTitle}>{post.title}</Text>
      <Text style={styles.cardMeta}>{post.authorName} • {formatDateLabel(post.createdAt)}</Text>
      <Text style={styles.cardContent}>{post.content}</Text>
      <View style={styles.metricsRow}>
        <Metric label="Likes" value={String(post.likes ?? 0)} styles={styles} />
        <Metric label="Comments" value={String(post.comments ?? 0)} styles={styles} />
      </View>
    </View>
  );
}

function MeetingCard({ meeting, styles }: { meeting: CommunityMeeting; styles: CommunityStyles }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <View style={styles.cardBadge}>
          <Text style={styles.cardBadgeText}>Meeting</Text>
        </View>
        <Text style={styles.pinnedBadge}>{formatDateLabel(meeting.meetingDate)}</Text>
      </View>
      <Text style={styles.cardTitle}>{meeting.title}</Text>
      <Text style={styles.cardMeta}>{meeting.host} • {meeting.location}</Text>
      <Text style={styles.cardContent}>{meeting.agenda}</Text>
    </View>
  );
}

function Metric({ label, value, styles }: { label: string; value: string; styles: CommunityStyles }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: palette.bg,
    },
    content: {
      padding: 16,
      paddingBottom: 28,
      gap: 14,
    },
    header: {
      flexDirection: 'column',
      gap: 12,
    },
    headerTextBlock: {
      gap: 4,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: palette.text,
    },
    subtitle: {
      color: palette.muted,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 10,
      flexWrap: 'wrap',
    },
    primaryButton: {
      backgroundColor: palette.primary,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 999,
    },
    primaryButtonText: {
      color: palette.surface,
      fontWeight: '700',
    },
    secondaryButton: {
      backgroundColor: palette.accentSoft,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 999,
    },
    secondaryButtonText: {
      color: palette.text,
      fontWeight: '700',
    },
    statsGrid: {
      flexDirection: 'row',
      gap: 10,
    },
    statCard: {
      flex: 1,
      backgroundColor: palette.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.border,
    },
    statValue: {
      fontSize: 22,
      fontWeight: '800',
      color: palette.text,
    },
    statLabel: {
      marginTop: 4,
      color: palette.muted,
      fontSize: 12,
    },
    searchCard: {
      backgroundColor: palette.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.border,
      paddingHorizontal: 12,
    },
    searchInput: {
      height: 48,
      color: palette.text,
    },
    tabsRow: {
      gap: 10,
      paddingVertical: 4,
    },
    tab: {
      backgroundColor: palette.accentSoft,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
    },
    tabActive: {
      backgroundColor: palette.primary,
    },
    tabLabel: {
      color: palette.text,
      fontWeight: '700',
    },
    tabLabelActive: {
      color: palette.surface,
    },
    sectionHeader: {
      marginTop: 4,
      marginBottom: 2,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: palette.text,
    },
    sectionSubtitle: {
      marginTop: 3,
      color: palette.muted,
    },
    card: {
      backgroundColor: palette.surface,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.border,
      gap: 8,
    },
    cardTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardBadge: {
      backgroundColor: palette.primarySoft,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    cardBadgeText: {
      color: palette.primary,
      fontWeight: '700',
      fontSize: 12,
    },
    pinnedBadge: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700',
    },
    cardTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: palette.text,
    },
    cardMeta: {
      color: palette.muted,
      fontSize: 12,
    },
    cardContent: {
      color: palette.accent,
      lineHeight: 20,
    },
    metricsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    metric: {
      flex: 1,
      backgroundColor: palette.bg,
      borderRadius: 14,
      padding: 10,
      borderWidth: 1,
      borderColor: palette.border,
    },
    metricValue: {
      fontWeight: '800',
      color: palette.text,
    },
    metricLabel: {
      color: palette.muted,
      fontSize: 12,
      marginTop: 2,
    },
    success: {
      color: palette.primary,
      fontWeight: '700',
    },
    error: {
      color: palette.danger,
      fontWeight: '700',
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.55)',
      justifyContent: 'center',
      padding: 16,
    },
    modalCard: {
      backgroundColor: palette.surface,
      borderRadius: 20,
      padding: 16,
      gap: 10,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: palette.text,
      marginBottom: 4,
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: palette.muted,
    },
    checkboxChecked: {
      backgroundColor: palette.primary,
      borderColor: palette.primary,
    },
    checkboxLabel: {
      color: palette.accent,
      fontWeight: '600',
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 4,
    },
  });
}