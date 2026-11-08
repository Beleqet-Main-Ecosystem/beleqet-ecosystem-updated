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

/** A search result list that loads the next page as you reach the end. A new query starts afresh. */
export function PagedList<T>(props: Props<T>) {
  return <Results key={props.query} {...props} />;
}

function Results<T>({ load, render, keyOf, header, emptyTitle, emptyText }: Props<T>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [state, setState] = useState<'loading' | 'ready' | 'more' | 'refreshing' | 'failed'>('loading');
  const [error, setError] = useState<unknown>(null);
  const generation = useRef(0);

  const fetchPage = useCallback(
    // Callers set the state shown meanwhile; the first load starts in 'loading' (one list per query).
    async (next: number) => {
      const mine = ++generation.current;
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
    // `load` changes every render; the list remounts when the query changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    // Fetching on mount: state is set only after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPage(1);
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
        state === 'loading' ? <Loading /> : state === 'failed' ? <Failed message={errorText(error, t)} onRetry={() => { setState('loading'); void fetchPage(1); }} /> : <Empty title={emptyTitle} text={emptyText} />
      }
      ListFooterComponent={state === 'more' ? <View className="py-4"><ActivityIndicator color={colors.accent} /></View> : null}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (state === 'ready' && page < totalPages) {
          setState('more');
          void fetchPage(page + 1);
        }
      }}
      refreshControl={<RefreshControl refreshing={state === 'refreshing'} onRefresh={() => { setState('refreshing'); void fetchPage(1); }} tintColor={colors.accent} colors={[colors.accent]} />}
    />
  );
}
