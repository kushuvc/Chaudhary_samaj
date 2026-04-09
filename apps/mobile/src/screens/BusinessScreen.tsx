import React, { useCallback, useMemo, useState } from 'react';
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
import { api } from '../services/api';
import type { BusinessListing } from '../types';

const CATEGORY_OPTIONS = ['Retail', 'Services', 'Education', 'Health', 'Food', 'Real Estate', 'Other'];

export function BusinessScreen() {
  const [listings, setListings] = useState<BusinessListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: '',
    ownerName: '',
    description: '',
    contactPhone: '',
    contactEmail: '',
    location: '',
    serviceTags: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadListings = useCallback(async () => {
    try {
      setError(null);
      const response = await api.getBusinessListings();
      setListings(response.listings || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load business listings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    loadListings();
  }, [loadListings]);

  const onRefresh = () => {
    setRefreshing(true);
    loadListings();
  };

  const categories = useMemo(() => {
    const values = Array.from(new Set(listings.map((item) => item.category).filter(Boolean))).sort();
    return ['all', ...values];
  }, [listings]);

  const locations = useMemo(() => {
    const values = Array.from(new Set(listings.map((item) => item.location).filter(Boolean))).sort();
    return ['all', ...values];
  }, [listings]);

  const filteredListings = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    return listings.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }
      if (locationFilter !== 'all' && item.location !== locationFilter) {
        return false;
      }
      if (!search) {
        return true;
      }
      return [item.name, item.ownerName, item.description, item.location, ...(item.serviceTags || [])]
        .join(' ')
        .toLowerCase()
        .includes(search);
    });
  }, [listings, searchText, categoryFilter, locationFilter]);

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const resetForm = () => {
    setForm({
      name: '',
      category: '',
      ownerName: '',
      description: '',
      contactPhone: '',
      contactEmail: '',
      location: '',
      serviceTags: '',
    });
  };

  const submitListing = async () => {
    if (!form.name.trim() || !form.category.trim() || !form.ownerName.trim() || !form.description.trim() || !form.contactPhone.trim() || !form.location.trim()) {
      setError('Please fill required fields: name, category, owner, description, phone, location.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const response = await api.createBusinessListing({
        name: form.name.trim(),
        category: form.category.trim(),
        ownerName: form.ownerName.trim(),
        description: form.description.trim(),
        contactPhone: form.contactPhone.trim(),
        contactEmail: form.contactEmail.trim() || undefined,
        location: form.location.trim(),
        serviceTags: form.serviceTags
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      });

      setListings((current) => [response.listing, ...current]);
      setModalOpen(false);
      resetForm();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create listing');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <ScreenLoader message="Loading business listings..." />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>Business and Marketing</Text>
        <Text style={styles.subtitle}>Global listings visible to all community members</Text>

        <Pressable style={styles.primaryButton} onPress={() => setModalOpen(true)}>
          <Text style={styles.primaryButtonText}>+ Add Business Listing</Text>
        </Pressable>

        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          style={styles.input}
          placeholder="Search listings"
          placeholderTextColor="#94a3b8"
        />

        <Text style={styles.filterLabel}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {categories.map((item) => (
            <Pressable
              key={item}
              onPress={() => setCategoryFilter(item)}
              style={[styles.chip, categoryFilter === item && styles.chipActive]}
            >
              <Text style={[styles.chipText, categoryFilter === item && styles.chipTextActive]}>
                {item === 'all' ? 'All' : item}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.filterLabel}>Location</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {locations.map((item) => (
            <Pressable
              key={item}
              onPress={() => setLocationFilter(item)}
              style={[styles.chip, locationFilter === item && styles.chipActive]}
            >
              <Text style={[styles.chipText, locationFilter === item && styles.chipTextActive]}>
                {item === 'all' ? 'All' : item}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {error ? <InlineError message={error} /> : null}

        {filteredListings.length === 0 ? (
          <EmptyState
            title="No listings found"
            subtitle="Create a listing or adjust your filters."
            actionLabel="Add Listing"
            onAction={() => setModalOpen(true)}
          />
        ) : (
          filteredListings.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.badge}>{item.category}</Text>
              </View>
              <Text style={styles.cardSub}>Owner: {item.ownerName}</Text>
              <Text style={styles.cardSub}>Location: {item.location}</Text>
              <Text style={styles.cardSub}>Contact: {item.contactPhone}</Text>
              {item.contactEmail ? <Text style={styles.cardSub}>Email: {item.contactEmail}</Text> : null}
              <Text style={styles.description}>{item.description}</Text>
              {(item.serviceTags || []).length > 0 ? (
                <Text style={styles.tags}>Tags: {(item.serviceTags || []).join(', ')}</Text>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Create Business Listing</Text>

          <ScrollView>
            <LabeledInput label="Business Name" value={form.name} onChangeText={(v) => updateForm('name', v)} placeholder="Business name*" />
            <OptionSelector label="Category" value={form.category} options={CATEGORY_OPTIONS} onChange={(v) => updateForm('category', v)} />
            <LabeledInput label="Owner Name" value={form.ownerName} onChangeText={(v) => updateForm('ownerName', v)} placeholder="Owner name*" />
            <LabeledInput label="Location" value={form.location} onChangeText={(v) => updateForm('location', v)} placeholder="Location*" />
            <LabeledInput
              label="Contact Phone"
              value={form.contactPhone}
              onChangeText={(v) => updateForm('contactPhone', v)}
              placeholder="Contact phone*"
              keyboardType="phone-pad"
            />
            <LabeledInput
              label="Contact Email"
              value={form.contactEmail}
              onChangeText={(v) => updateForm('contactEmail', v)}
              placeholder="Contact email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <LabeledInput
              label="Service Tags"
              value={form.serviceTags}
              onChangeText={(v) => updateForm('serviceTags', v)}
              placeholder="Service tags (comma separated)"
            />
            <LabeledInput
              label="Description"
              value={form.description}
              onChangeText={(v) => updateForm('description', v)}
              style={styles.textArea}
              placeholder="Description*"
              multiline
              numberOfLines={4}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable style={styles.primaryButton} onPress={submitListing} disabled={submitting}>
              <Text style={styles.primaryButtonText}>{submitting ? 'Creating...' : 'Create Listing'}</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setModalOpen(false)}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { marginTop: 4, color: '#475569', marginBottom: 12 },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  primaryButton: {
    backgroundColor: '#0f766e',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#94a3b8',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  secondaryButtonText: { color: '#334155', fontWeight: '600' },
  filterLabel: { marginTop: 6, marginBottom: 6, color: '#0f172a', fontWeight: '600' },
  chipRow: { marginBottom: 10 },
  chip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  chipActive: { backgroundColor: '#ccfbf1', borderColor: '#0f766e' },
  chipText: { color: '#334155', fontWeight: '600' },
  chipTextActive: { color: '#0f766e' },
  errorText: { color: '#dc2626', marginBottom: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 10,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', flex: 1, paddingRight: 8 },
  badge: {
    fontSize: 12,
    color: '#0f766e',
    backgroundColor: '#ccfbf1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  cardSub: { color: '#475569', marginTop: 2 },
  description: { color: '#1e293b', marginTop: 8 },
  tags: { color: '#0f766e', marginTop: 8, fontWeight: '600' },
  emptyCard: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
  },
  emptyTitle: { fontWeight: '700', color: '#0f172a' },
  emptyText: { marginTop: 4, color: '#64748b' },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  stateText: { marginTop: 8, color: '#334155' },
  modalContainer: { flex: 1, backgroundColor: '#f8fafc', padding: 16, paddingTop: 48 },
  modalTitle: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
});
