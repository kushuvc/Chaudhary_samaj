import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { EmptyState, InlineError, ScreenLoader } from '../components/AppFeedback';
import { LabeledInput, OptionSelector } from '../components/AppPrimitives';
import { DateInput } from '../components/DateInput';
import { useAppTheme } from '../context/ThemeContext';
import { useAppLanguage } from '../context/LanguageContext';
import type { ThemePalette } from '../context/ThemeContext';
import { api } from '../services/api';
import type { EventSummary, EventSummaryStats } from '../types';

const PAYMENT_MODE_OPTIONS = ['cash', 'upi', 'bank_transfer', 'manual'];

export function EventsScreen() {
  const { palette } = useAppTheme();
  const { t } = useAppLanguage();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [summary, setSummary] = useState<EventSummaryStats | null>(null);
  const [tab, setTab] = useState<'all' | 'upcoming' | 'past' | 'pending' | 'fully_collected'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createEventForm, setCreateEventForm] = useState({
    title: '',
    date: '',
    location: '',
    organizerName: '',
    guestCount: '0',
    moneyExpected: '0',
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null);
  const [contributionModalVisible, setContributionModalVisible] = useState(false);
  const [contributionForm, setContributionForm] = useState({
    guestName: '',
    amount: '',
    date: '',
    paymentMode: 'cash',
    notes: '',
  });
  const [contributionSubmitting, setContributionSubmitting] = useState(false);

  const load = useCallback(async (selectedTab: 'all' | 'upcoming' | 'past' | 'pending' | 'fully_collected') => {
    try {
      setError(null);
      const [eventsResponse, summaryResponse] = await Promise.all([
        api.getEvents(selectedTab),
        api.getEventSummary(),
      ]);
      setEvents(eventsResponse.events);
      setSummary(summaryResponse);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [load, tab]);

  const tabItems = useMemo(
    () => [
      { key: 'all', label: t('allTab') },
      { key: 'upcoming', label: t('upcoming') },
      { key: 'past', label: t('past') },
      { key: 'pending', label: t('pendingTab') },
      { key: 'fully_collected', label: t('collectedTab') },
    ] as const,
    [t]
  );

  const onCreateEvent = async () => {
    if (!createEventForm.title.trim() || !createEventForm.date.trim() || !createEventForm.location.trim()) {
      setError(t('eventRequiredFields'));
      return;
    }

    try {
      setCreateSubmitting(true);
      await api.createEvent({
        title: createEventForm.title.trim(),
        date: createEventForm.date.trim(),
        location: createEventForm.location.trim(),
        organizerName: createEventForm.organizerName.trim() || t('organizer'),
        guestCount: Number(createEventForm.guestCount || '0'),
        moneyExpected: Number(createEventForm.moneyExpected || '0'),
      });
      setCreateModalVisible(false);
      setCreateEventForm({
        title: '',
        date: '',
        location: '',
        organizerName: '',
        guestCount: '0',
        moneyExpected: '0',
      });
      await load(tab);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreateSubmitting(false);
    }
  };

  const onRecordContribution = async () => {
    if (!selectedEvent) {
      return;
    }
    if (!contributionForm.guestName.trim() || !contributionForm.date.trim() || !contributionForm.paymentMode.trim()) {
      setError(t('guestDatePaymentRequired'));
      return;
    }
    const amount = Number(contributionForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(t('validPositiveAmount'));
      return;
    }

    try {
      setContributionSubmitting(true);
      await api.recordContribution(selectedEvent.id, {
        guestName: contributionForm.guestName.trim(),
        amount,
        date: contributionForm.date.trim(),
        paymentMode: contributionForm.paymentMode.trim().toLowerCase(),
        notes: contributionForm.notes.trim(),
      });
      setContributionModalVisible(false);
      setContributionForm({ guestName: '', amount: '', date: '', paymentMode: 'cash', notes: '' });
      await load(tab);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setContributionSubmitting(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    load(tab);
  };

  if (loading) {
    return <ScreenLoader message={t('loadingEvents')} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.title}>Events</Text>
                <Text style={styles.title}>{t('eventsTitle')}</Text>
                <Text style={styles.subtitle}>{t('eventsSubtitle')}</Text>
              </View>
              <Pressable style={styles.primaryBtn} onPress={() => setCreateModalVisible(true)}>
                <Text style={styles.primaryBtnText}>{t('createEvent')}</Text>
              </Pressable>
            </View>

            {summary ? (
              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{summary.totalCreated}</Text>
                  <Text style={styles.summaryLabel}>{t('created')}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{summary.upcomingCount}</Text>
                  <Text style={styles.summaryLabel}>{t('upcoming')}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{summary.pastCount}</Text>
                  <Text style={styles.summaryLabel}>{t('past')}</Text>
                </View>
              </View>
            ) : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
              {tabItems.map((item) => (
                <Pressable
                  key={item.key}
                  style={[styles.tabChip, tab === item.key ? styles.tabChipActive : null]}
                  onPress={() => setTab(item.key)}
                >
                  <Text style={[styles.tabChipText, tab === item.key ? styles.tabChipTextActive : null]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {error ? <InlineError message={error} /> : null}
          </View>
        }
        renderItem={({ item }) => {
          const remaining = Math.max(item.expectedAmount - item.collectedAmount, 0);
          return (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.badge}>{item.status}</Text>
              </View>
              <Text style={styles.meta}>
                {new Date(item.eventDate).toLocaleDateString()} | {item.location}
              </Text>
              <Text style={styles.meta}>{t('organizerLabel')}: {item.organizerName || t('notAvailable')}</Text>
              <Text style={styles.meta}>{t('guestsLabel')}: {item.guestCount}</Text>
              <Text style={styles.meta}>{t('collectedLabel')}: Rs {item.collectedAmount.toLocaleString()}</Text>
              <Text style={styles.meta}>{t('remainingLabel')}: Rs {remaining.toLocaleString()}</Text>

              <View style={styles.actionRow}>
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() => {
                    setSelectedEvent(item);
                    setContributionForm((prev) => ({ ...prev, date: new Date().toISOString().slice(0, 10) }));
                    setContributionModalVisible(true);
                  }}
                >
                  <Text style={styles.secondaryBtnText}>{t('recordContribution')}</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title={t('noEventsInTab')}
            subtitle={t('noEventsTabSubtitle')}
          />
        }
      />

      <Modal visible={createModalVisible} animationType="slide" onRequestClose={() => setCreateModalVisible(false)}>
        <ScrollView style={styles.modalWrap} contentContainerStyle={styles.modalContent}>
          <Text style={styles.modalTitle}>{t('createEventTitle')}</Text>
          <LabeledInput
            label={t('eventTitleLabel')}
            placeholder={t('eventTitlePlaceholder')}
            value={createEventForm.title}
            onChangeText={(text) => setCreateEventForm((prev) => ({ ...prev, title: text }))}
          />
          <DateInput
            label={t('eventDateLabel')}
            value={createEventForm.date}
            onChange={(value) => setCreateEventForm((prev) => ({ ...prev, date: value }))}
          />
          <LabeledInput
            label={t('locationLabel')}
            placeholder={t('locationPlaceholder')}
            value={createEventForm.location}
            onChangeText={(text) => setCreateEventForm((prev) => ({ ...prev, location: text }))}
          />
          <LabeledInput
            label={t('organizerNameLabel')}
            placeholder={t('organizerNamePlaceholder')}
            value={createEventForm.organizerName}
            onChangeText={(text) => setCreateEventForm((prev) => ({ ...prev, organizerName: text }))}
          />
          <LabeledInput
            label={t('expectedGuestsLabel')}
            placeholder={t('expectedGuestsPlaceholder')}
            keyboardType="number-pad"
            value={createEventForm.guestCount}
            onChangeText={(text) => setCreateEventForm((prev) => ({ ...prev, guestCount: text }))}
          />
          <LabeledInput
            label={t('expectedCollectionLabel')}
            placeholder={t('expectedCollectionPlaceholder')}
            keyboardType="decimal-pad"
            value={createEventForm.moneyExpected}
            onChangeText={(text) => setCreateEventForm((prev) => ({ ...prev, moneyExpected: text }))}
          />

          <View style={styles.modalActions}>
            <Pressable style={styles.secondaryBtn} onPress={() => setCreateModalVisible(false)}>
              <Text style={styles.secondaryBtnText}>{t('cancel')}</Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={onCreateEvent} disabled={createSubmitting}>
              <Text style={styles.primaryBtnText}>{createSubmitting ? t('creating') : t('create')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Modal>

      <Modal visible={contributionModalVisible} animationType="slide" onRequestClose={() => setContributionModalVisible(false)}>
        <ScrollView style={styles.modalWrap} contentContainerStyle={styles.modalContent}>
          <Text style={styles.modalTitle}>{t('recordContributionTitle')}</Text>
          <Text style={styles.modalSubtitle}>{selectedEvent?.title || ''}</Text>

          <LabeledInput
            label={t('guestNameLabel')}
            placeholder={t('guestNamePlaceholder')}
            value={contributionForm.guestName}
            onChangeText={(text) => setContributionForm((prev) => ({ ...prev, guestName: text }))}
          />
          <LabeledInput
            label={t('amountLabel')}
            placeholder={t('amountPlaceholder')}
            keyboardType="decimal-pad"
            value={contributionForm.amount}
            onChangeText={(text) => setContributionForm((prev) => ({ ...prev, amount: text }))}
          />
          <DateInput
            label={t('paymentDateLabel')}
            value={contributionForm.date}
            onChange={(value) => setContributionForm((prev) => ({ ...prev, date: value }))}
          />
          <OptionSelector
            label={t('paymentModeLabel')}
            value={contributionForm.paymentMode}
            options={PAYMENT_MODE_OPTIONS}
            onChange={(next) => setContributionForm((prev) => ({ ...prev, paymentMode: next }))}
          />
          <LabeledInput
            label={t('notesLabel')}
            placeholder={t('notesPlaceholder')}
            multiline
            numberOfLines={4}
            style={styles.textArea}
            value={contributionForm.notes}
            onChangeText={(text) => setContributionForm((prev) => ({ ...prev, notes: text }))}
          />

          <View style={styles.modalActions}>
            <Pressable style={styles.secondaryBtn} onPress={() => setContributionModalVisible(false)}>
              <Text style={styles.secondaryBtnText}>{t('cancel')}</Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={onRecordContribution} disabled={contributionSubmitting}>
              <Text style={styles.primaryBtnText}>{contributionSubmitting ? t('saving') : t('save')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.bg,
    },
    listContent: {
      padding: 16,
      gap: 10,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: palette.text,
    },
    subtitle: {
      color: palette.muted,
      marginTop: 2,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    summaryCard: {
      flex: 1,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 12,
      padding: 10,
    },
    summaryValue: {
      fontSize: 18,
      fontWeight: '700',
      color: palette.text,
    },
    summaryLabel: {
      color: palette.muted,
      marginTop: 2,
    },
    tabRow: {
      gap: 8,
      marginBottom: 12,
    },
    tabChip: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: palette.surface,
    },
    tabChipActive: {
      backgroundColor: palette.primary,
      borderColor: palette.primary,
    },
    tabChipText: {
      color: palette.accent,
      fontWeight: '600',
    },
    tabChipTextActive: {
      color: palette.surface,
    },
    card: {
      backgroundColor: palette.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.border,
      padding: 12,
      gap: 4,
    },
    cardHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: palette.text,
      paddingRight: 8,
    },
    badge: {
      fontSize: 12,
      color: palette.primary,
      fontWeight: '700',
      textTransform: 'capitalize',
    },
    meta: {
      color: palette.muted,
      fontSize: 13,
    },
    actionRow: {
      marginTop: 8,
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    primaryBtn: {
      backgroundColor: palette.primary,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 10,
    },
    primaryBtnText: {
      color: palette.surface,
      fontWeight: '700',
    },
    secondaryBtn: {
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.primary,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 10,
    },
    secondaryBtnText: {
      color: palette.primary,
      fontWeight: '700',
    },
    modalWrap: {
      flex: 1,
      backgroundColor: palette.bg,
    },
    modalContent: {
      padding: 16,
      gap: 10,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: palette.text,
    },
    modalSubtitle: {
      color: palette.muted,
      marginBottom: 4,
    },
    textArea: {
      minHeight: 90,
      textAlignVertical: 'top',
    },
    modalActions: {
      marginTop: 8,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
    },
  });
}
