import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
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
import { api } from '../services/api';
import type { EventSummary, EventSummaryStats } from '../types';

const PAYMENT_MODE_OPTIONS = ['cash', 'upi', 'bank_transfer', 'manual'];

export function EventsScreen() {
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
      { key: 'all', label: 'All' },
      { key: 'upcoming', label: 'Upcoming' },
      { key: 'past', label: 'Past' },
      { key: 'pending', label: 'Pending' },
      { key: 'fully_collected', label: 'Collected' },
    ] as const,
    []
  );

  const onCreateEvent = async () => {
    if (!createEventForm.title.trim() || !createEventForm.date.trim() || !createEventForm.location.trim()) {
      setError('Event title, date, and location are required.');
      return;
    }

    try {
      setCreateSubmitting(true);
      await api.createEvent({
        title: createEventForm.title.trim(),
        date: createEventForm.date.trim(),
        location: createEventForm.location.trim(),
        organizerName: createEventForm.organizerName.trim() || 'Organizer',
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
      setError('Guest, date, and payment mode are required.');
      return;
    }
    const amount = Number(contributionForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Please enter a valid positive amount.');
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
    return <ScreenLoader message="Loading events..." />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.title}>Events</Text>
                <Text style={styles.subtitle}>Your private event space</Text>
              </View>
              <Pressable style={styles.primaryBtn} onPress={() => setCreateModalVisible(true)}>
                <Text style={styles.primaryBtnText}>Create Event</Text>
              </Pressable>
            </View>

            {summary ? (
              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{summary.totalCreated}</Text>
                  <Text style={styles.summaryLabel}>Created</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{summary.upcomingCount}</Text>
                  <Text style={styles.summaryLabel}>Upcoming</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{summary.pastCount}</Text>
                  <Text style={styles.summaryLabel}>Past</Text>
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
              <Text style={styles.meta}>Organizer: {item.organizerName || 'N/A'}</Text>
              <Text style={styles.meta}>Guests: {item.guestCount}</Text>
              <Text style={styles.meta}>Collected: Rs {item.collectedAmount.toLocaleString()}</Text>
              <Text style={styles.meta}>Remaining: Rs {remaining.toLocaleString()}</Text>

              <View style={styles.actionRow}>
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() => {
                    setSelectedEvent(item);
                    setContributionForm((prev) => ({ ...prev, date: new Date().toISOString().slice(0, 10) }));
                    setContributionModalVisible(true);
                  }}
                >
                  <Text style={styles.secondaryBtnText}>Record Contribution</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title="No events in this tab"
            subtitle="Create an event or switch tabs to view your history."
          />
        }
      />

      <Modal visible={createModalVisible} animationType="slide" onRequestClose={() => setCreateModalVisible(false)}>
        <ScrollView style={styles.modalWrap} contentContainerStyle={styles.modalContent}>
          <Text style={styles.modalTitle}>Create Event</Text>
          <LabeledInput
            label="Event Title"
            placeholder="Event title"
            value={createEventForm.title}
            onChangeText={(text) => setCreateEventForm((prev) => ({ ...prev, title: text }))}
          />
          <LabeledInput
            label="Event Date"
            placeholder="Date (YYYY-MM-DD)"
            value={createEventForm.date}
            onChangeText={(text) => setCreateEventForm((prev) => ({ ...prev, date: text }))}
          />
          <LabeledInput
            label="Location"
            placeholder="Location"
            value={createEventForm.location}
            onChangeText={(text) => setCreateEventForm((prev) => ({ ...prev, location: text }))}
          />
          <LabeledInput
            label="Organizer Name"
            placeholder="Organizer name"
            value={createEventForm.organizerName}
            onChangeText={(text) => setCreateEventForm((prev) => ({ ...prev, organizerName: text }))}
          />
          <LabeledInput
            label="Expected Guests"
            placeholder="Expected guests"
            keyboardType="number-pad"
            value={createEventForm.guestCount}
            onChangeText={(text) => setCreateEventForm((prev) => ({ ...prev, guestCount: text }))}
          />
          <LabeledInput
            label="Expected Collection"
            placeholder="Money expected"
            keyboardType="decimal-pad"
            value={createEventForm.moneyExpected}
            onChangeText={(text) => setCreateEventForm((prev) => ({ ...prev, moneyExpected: text }))}
          />

          <View style={styles.modalActions}>
            <Pressable style={styles.secondaryBtn} onPress={() => setCreateModalVisible(false)}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={onCreateEvent} disabled={createSubmitting}>
              <Text style={styles.primaryBtnText}>{createSubmitting ? 'Creating...' : 'Create'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Modal>

      <Modal visible={contributionModalVisible} animationType="slide" onRequestClose={() => setContributionModalVisible(false)}>
        <ScrollView style={styles.modalWrap} contentContainerStyle={styles.modalContent}>
          <Text style={styles.modalTitle}>Record Contribution</Text>
          <Text style={styles.modalSubtitle}>{selectedEvent?.title || ''}</Text>

          <LabeledInput
            label="Guest Name"
            placeholder="Guest name"
            value={contributionForm.guestName}
            onChangeText={(text) => setContributionForm((prev) => ({ ...prev, guestName: text }))}
          />
          <LabeledInput
            label="Amount"
            placeholder="Amount"
            keyboardType="decimal-pad"
            value={contributionForm.amount}
            onChangeText={(text) => setContributionForm((prev) => ({ ...prev, amount: text }))}
          />
          <LabeledInput
            label="Payment Date"
            placeholder="Date (YYYY-MM-DD)"
            value={contributionForm.date}
            onChangeText={(text) => setContributionForm((prev) => ({ ...prev, date: text }))}
          />
          <OptionSelector
            label="Payment Mode"
            value={contributionForm.paymentMode}
            options={PAYMENT_MODE_OPTIONS}
            onChange={(next) => setContributionForm((prev) => ({ ...prev, paymentMode: next }))}
          />
          <LabeledInput
            label="Notes"
            placeholder="Notes"
            multiline
            numberOfLines={4}
            style={styles.textArea}
            value={contributionForm.notes}
            onChangeText={(text) => setContributionForm((prev) => ({ ...prev, notes: text }))}
          />

          <View style={styles.modalActions}>
            <Pressable style={styles.secondaryBtn} onPress={() => setContributionModalVisible(false)}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={onRecordContribution} disabled={contributionSubmitting}>
              <Text style={styles.primaryBtnText}>{contributionSubmitting ? 'Saving...' : 'Save'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
    color: '#0f172a',
  },
  subtitle: {
    color: '#64748b',
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  summaryLabel: {
    color: '#64748b',
    marginTop: 2,
  },
  tabRow: {
    gap: 8,
    marginBottom: 12,
  },
  tabChip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  tabChipActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  tabChipText: {
    color: '#334155',
    fontWeight: '600',
  },
  tabChipTextActive: {
    color: '#fff',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    color: '#0f172a',
    paddingRight: 8,
  },
  badge: {
    fontSize: 12,
    color: '#0f766e',
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  meta: {
    color: '#475569',
    fontSize: 13,
  },
  actionRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  primaryBtn: {
    backgroundColor: '#0f766e',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#0f766e',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  secondaryBtnText: {
    color: '#0f766e',
    fontWeight: '700',
  },
  modalWrap: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalContent: {
    padding: 16,
    gap: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalSubtitle: {
    color: '#475569',
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
