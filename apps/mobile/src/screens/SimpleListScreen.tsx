import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

interface SimpleListScreenProps<T> {
  title: string;
  subtitle: string;
  fetcher: () => Promise<T[]>;
  renderItem: (item: T) => React.ReactNode;
  keyExtractor: (item: T) => string;
}

export function SimpleListScreen<T>({
  title,
  subtitle,
  fetcher,
  renderItem,
  keyExtractor
}: SimpleListScreenProps<T>) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<T[]>([]);

  const load = async () => {
    try {
      setError(null);
      const next = await fetcher();
      setItems(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={keyExtractor}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>No records yet.</Text>}
      renderItem={({ item }) => <View style={styles.card}>{renderItem(item)}</View>}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc'
  },
  listContent: {
    padding: 16,
    gap: 10,
    backgroundColor: '#f8fafc'
  },
  header: {
    marginBottom: 8
  },
  title: {
    fontSize: 21,
    fontWeight: '700',
    color: '#0f172a'
  },
  subtitle: {
    color: '#475569'
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12
  },
  empty: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 30
  },
  error: {
    color: '#b91c1c',
    marginTop: 6
  }
});
