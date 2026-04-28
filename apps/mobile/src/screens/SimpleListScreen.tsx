import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useAppLanguage } from '../context/LanguageContext';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';

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
  const { palette } = useAppTheme();
  const { t } = useAppLanguage();
  const styles = useMemo(() => createStyles(palette), [palette]);
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
        <ActivityIndicator size="large" color={palette.primary} />
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
      ListEmptyComponent={<Text style={styles.empty}>{t('noRecordsYet')}</Text>}
      renderItem={({ item }) => <View style={styles.card}>{renderItem(item)}</View>}
    />
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.bg,
    },
    listContent: {
      padding: 16,
      gap: 10,
      backgroundColor: palette.bg,
    },
    header: {
      marginBottom: 8,
    },
    title: {
      fontSize: 21,
      fontWeight: '700',
      color: palette.text,
    },
    subtitle: {
      color: palette.muted,
    },
    card: {
      backgroundColor: palette.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      padding: 12,
    },
    empty: {
      textAlign: 'center',
      color: palette.muted,
      marginTop: 30,
    },
    error: {
      color: palette.danger,
      marginTop: 6,
    },
  });
}
