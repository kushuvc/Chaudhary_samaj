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
import type { CreateHelpNeedPayload, HelpNeedQuery, HelpNeedRequest } from '../types';

const CATEGORY_OPTIONS = ['financial', 'medical', 'jobs', 'business', 'general'];
const URGENCY_OPTIONS = ['low', 'medium', 'high', 'critical'];
const STATUS_OPTIONS = ['all', 'open', 'under_review', 'in_progress', 'resolved'];
const CONTACT_MODE_OPTIONS = ['phone', 'email', 'chat'];

export function HelpNeedScreen() {
  const [requests, setRequests] = useState<HelpNeedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<'all' | string>('all');
  const [urgency, setUrgency] = useState<'all' | string>('all');
  const [status, setStatus] = useState<'all' | string>('all');
  const [search, setSearch] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<HelpNeedRequest | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [createForm, setCreateForm] = useState<CreateHelpNeedPayload>({
    title: '',
    category: 'financial',
    amount: undefined,
    urgency: 'medium',
    location: '',
    contact: '',
    description: '',
    reason: '',
    medicalCategory: '',
    expenseType: '',
    subType: '',
  });

  const [supportAmount, setSupportAmount] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportContactMode, setSupportContactMode] = useState('phone');

  const categories = useMemo(
    () => ['all', 'financial', 'medical', 'jobs', 'business', 'general'],
    []
  );

  const loadRequests = useCallback(async () => {
    try {
      setError(null);
      const query: HelpNeedQuery = {
        category: category === 'all' ? undefined : category,
        urgency: urgency === 'all' ? undefined : urgency,
        status: status === 'all' ? undefined : status,
        search: search.trim() || undefined,
      };
      const response = await api.getHelpAndNeed(query);
      setRequests(response.requests);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category, urgency, status, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadRequests();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadRequests]);

  const onCreateRequest = async () => {
    if (!createForm.title.trim() || !createForm.location.trim() || !createForm.contact.trim() || !createForm.description.trim()) {
      setError('Title, location, contact, and details are required.');
      return;
    }

    try {
      setSubmitting(true);
      await api.createHelpNeedRequest({
        ...createForm,
        title: createForm.title.trim(),
        location: createForm.location.trim(),
        contact: createForm.contact.trim(),
        description: createForm.description.trim(),
        reason: createForm.reason?.trim(),
        medicalCategory: createForm.medicalCategory?.trim(),
        expenseType: createForm.expenseType?.trim(),
        subType: createForm.subType?.trim(),
      });
      setShowCreateModal(false);
      setCreateForm({
        title: '',
        category: 'financial',
        amount: undefined,
        urgency: 'medium',
        location: '',
        contact: '',
        description: '',
        reason: '',
        medicalCategory: '',
        expenseType: '',
        subType: '',
      });
      await loadRequests();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const onSupport = async () => {
    if (!selectedRequest) {
      return;
    }

    try {
      setSubmitting(true);
      const amount = Number(supportAmount || '0');
      await api.offerHelpNeedSupport(selectedRequest.id, {
        amount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
        offerMessage: supportMessage.trim() || undefined,
        contactMode: supportContactMode.trim() || undefined,
      });
      setShowSupportModal(false);
      setSelectedRequest(null);
      setSupportAmount('');
      setSupportMessage('');
      setSupportContactMode('phone');
      await loadRequests();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRequests();
  };

  if (loading) {
    return <ScreenLoader message="Loading help requests..." />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.title}>Help and Need</Text>
                <Text style={styles.subtitle}>Sensitive requests with moderation</Text>
              </View>
              <Pressable style={styles.primaryBtn} onPress={() => setShowCreateModal(true)}>
                <Text style={styles.primaryBtnText}>Create</Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search by title or location"
              value={search}
              onChangeText={setSearch}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {categories.map((item) => (
                <Pressable
                  key={item}
                  style={[styles.chip, category === item ? styles.chipActive : null]}
                  onPress={() => setCategory(item)}
                >
                  <Text style={[styles.chipText, category === item ? styles.chipTextActive : null]}>{item}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <OptionSelector label="Urgency" value={urgency} options={['all', ...URGENCY_OPTIONS]} onChange={setUrgency} />
            <OptionSelector label="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} />

            {error ? <InlineError message={error} /> : null}
          </View>
        }
        renderItem={({ item }) => {
          const progress = item.amountNeeded > 0 ? Math.min(100, Math.round((item.amountCollected / item.amountNeeded) * 100)) : 0;
          return (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.badge}>{item.status}</Text>
              </View>
              <Text style={styles.meta}>{item.category} • {item.urgency}</Text>
              <Text style={styles.meta}>{item.location}</Text>
              <Text style={styles.meta}>Needed: Rs {item.amountNeeded.toLocaleString()}</Text>
              <Text style={styles.meta}>Collected: Rs {item.amountCollected.toLocaleString()} ({progress}%)</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>

              <View style={styles.actionRow}>
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() => {
                    setSelectedRequest(item);
                    setShowSupportModal(true);
                  }}
                >
                  <Text style={styles.secondaryBtnText}>Support</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title="No help requests found"
            subtitle="Try changing filters or create a new request."
          />
        }
      />

      <Modal visible={showCreateModal} animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <ScrollView style={styles.modalWrap} contentContainerStyle={styles.modalContent}>
          <Text style={styles.modalTitle}>Create Help Request</Text>
          <LabeledInput label="Title" placeholder="Title" value={createForm.title} onChangeText={(text) => setCreateForm((prev) => ({ ...prev, title: text }))} />
          <OptionSelector label="Category" value={createForm.category} options={CATEGORY_OPTIONS} onChange={(text) => setCreateForm((prev) => ({ ...prev, category: text }))} />
          <LabeledInput
            label="Amount Needed"
            placeholder="Amount needed"
            keyboardType="decimal-pad"
            value={String(createForm.amount || '')}
            onChangeText={(text) => setCreateForm((prev) => ({ ...prev, amount: text ? Number(text) : undefined }))}
          />
          <OptionSelector label="Urgency" value={createForm.urgency} options={URGENCY_OPTIONS} onChange={(text) => setCreateForm((prev) => ({ ...prev, urgency: text }))} />
          <LabeledInput label="Location" placeholder="Location" value={createForm.location} onChangeText={(text) => setCreateForm((prev) => ({ ...prev, location: text }))} />
          <LabeledInput label="Contact Preference" placeholder="Contact preference" value={createForm.contact} onChangeText={(text) => setCreateForm((prev) => ({ ...prev, contact: text }))} />
          <LabeledInput
            label="Description"
            multiline
            numberOfLines={4}
            style={styles.textArea}
            placeholder="Description"
            value={createForm.description}
            onChangeText={(text) => setCreateForm((prev) => ({ ...prev, description: text }))}
          />

          <View style={styles.modalActions}>
            <Pressable style={styles.secondaryBtn} onPress={() => setShowCreateModal(false)}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={onCreateRequest} disabled={submitting}>
              <Text style={styles.primaryBtnText}>{submitting ? 'Saving...' : 'Create'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Modal>

      <Modal visible={showSupportModal} animationType="slide" onRequestClose={() => setShowSupportModal(false)}>
        <ScrollView style={styles.modalWrap} contentContainerStyle={styles.modalContent}>
          <Text style={styles.modalTitle}>Offer Help</Text>
          <Text style={styles.modalSubtitle}>{selectedRequest?.title || ''}</Text>
          <LabeledInput label="Amount" placeholder="Amount" keyboardType="decimal-pad" value={supportAmount} onChangeText={setSupportAmount} />
          <OptionSelector label="Contact Mode" value={supportContactMode} options={CONTACT_MODE_OPTIONS} onChange={setSupportContactMode} />
          <LabeledInput
            label="Support Message"
            multiline
            numberOfLines={4}
            style={styles.textArea}
            placeholder="Support message"
            value={supportMessage}
            onChangeText={setSupportMessage}
          />

          <View style={styles.modalActions}>
            <Pressable style={styles.secondaryBtn} onPress={() => setShowSupportModal(false)}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={onSupport} disabled={submitting}>
              <Text style={styles.primaryBtnText}>{submitting ? 'Sending...' : 'Send Support'}</Text>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  searchInput: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  chipsRow: {
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  chipActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  chipText: {
    color: '#334155',
    textTransform: 'capitalize',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  errorText: {
    color: '#b91c1c',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  badge: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  meta: {
    color: '#475569',
    marginBottom: 3,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
    marginTop: 4,
    marginBottom: 10,
  },
  progressFill: {
    height: 8,
    backgroundColor: '#0f766e',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  primaryBtn: {
    backgroundColor: '#0f766e',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  secondaryBtnText: {
    color: '#334155',
    fontWeight: '700',
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 24,
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
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalSubtitle: {
    color: '#64748b',
    marginBottom: 4,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
});
