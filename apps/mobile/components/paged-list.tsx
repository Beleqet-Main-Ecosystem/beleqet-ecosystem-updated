import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import type { Page } from '../api/jobs';
import { Empty, Failed, Loading } from './ui';
import { errorText } from '../lib/api-error';
import { useTranslation } from '../lib/i18n';
import { useTheme } from '../lib/theme';

type Props<T> = {
  /** Loads one page; a new `query` key starts again from page 1. */
  load: (page: number) => Promise<Page<T>>;
  query: string;
  render: (item: T) => ReactElement;
  keyOf: (item: T) => string;
  header?: ReactElement;
  emptyTitle: string;
  emptyText?: string;
};

/** A search result list that loads the next page as you reach the end. */
export function PagedList<T>({ load, query, render, keyOf, header, emptyTitle, emptyText }: Props<T>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [state, setState] = useState<'loading' | 'ready' | 'more' | 'refreshing' | 'failed'>('loading');
  const [error, setError] = useState<unknown>(null);
  const generation = useRef(0);

  const fetchPage = useCallback(
    async (next: number, mode: 'loading' | 'more' | 'refreshing') => {
      const mine = ++generation.current;
      setState(mode);
      try {
        const result = await load(next);
        if (mine !== generation.current) return;
        setItems((current) => (next === 1 ? result.items : [...current, ...result.items]));
        setPage(result.page);
        setTotalPages(result.totalPages);
        setState('ready');
      } catch (failure) {
        if (mine !== generation.current) return;
        setError(failure);
        // A failed "load more" keeps what is already shown.
        setState(next === 1 ? 'failed' : 'ready');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query],
  );

  useEffect(() => {
    void fetchPage(1, 'loading');
  }, [fetchPage]);

  return (
    <FlatList
      data={state === 'loading' || state === 'failed' ? [] : items}
      keyExtractor={keyOf}
      renderItem={({ item }) => render(item)}
      contentContainerClassName="gap-3 p-4 pb-10"
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      ListEmptyComponent={
        state === 'loading' ? <Loading /> : state === 'failed' ? <Failed message={errorText(error, t)} onRetry={() => fetchPage(1, 'loading')} /> : <Empty title={emptyTitle} text={emptyText} />
      }
      ListFooterComponent={state === 'more' ? <View className="py-4"><ActivityIndicator color={colors.accent} /></View> : null}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (state === 'ready' && page < totalPages) void fetchPage(page + 1, 'more');
      }}
      refreshControl={<RefreshControl refreshing={state === 'refreshing'} onRefresh={() => fetchPage(1, 'refreshing')} tintColor={colors.accent} colors={[colors.accent]} />}
    />
  );
}
