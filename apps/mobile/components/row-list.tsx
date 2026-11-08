import type { ReactElement } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Badge, Empty, Failed, Loading, Muted } from './ui';
import { errorText } from '../lib/api-error';
import { useTranslation } from '../lib/i18n';
import { useTheme } from '../lib/theme';

export type Row = { id: string; title: string; detail?: string; status?: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info'; onPress?: () => void; extra?: ReactElement | null };

type Props = {
  rows: Row[] | undefined;
  loading: boolean;
  error: unknown;
  refreshing: boolean;
  onRetry: () => void;
  onRefresh: () => void;
  emptyTitle: string;
  emptyText?: string;
  emptyAction?: ReactElement;
  header?: ReactElement;
};

/** A plain list of tappable rows with a status badge: bids, contracts, applications, projects. */
export function RowList({ rows, loading, error, refreshing, onRetry, onRefresh, emptyTitle, emptyText, emptyAction, header }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (loading) return <Loading />;
  if (error) return <View className="p-4"><Failed message={errorText(error, t)} onRetry={onRetry} /></View>;
  return (
    <FlatList
      data={rows ?? []}
      keyExtractor={(row) => row.id}
      contentContainerClassName="gap-3 p-4 pb-10"
      ListHeaderComponent={header}
      ListEmptyComponent={<Empty title={emptyTitle} text={emptyText} action={emptyAction} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
      renderItem={({ item }) => (
        <Pressable
          disabled={!item.onPress}
          onPress={item.onPress}
          accessibilityRole={item.onPress ? 'button' : undefined}
          className="gap-2 rounded-xl border border-ink-200 bg-surface p-4 active:opacity-80 dark:border-slate-800 dark:bg-slate-900"
        >
          <View className="flex-row items-start gap-3">
            <View className="flex-1 gap-0.5">
              <Text className="text-[15px] font-bold text-ink-900 dark:text-white">{item.title}</Text>
              {item.detail ? <Muted>{item.detail}</Muted> : null}
            </View>
            {item.status ? <Badge label={item.status} tone={item.tone} /> : null}
          </View>
          {item.extra}
        </Pressable>
      )}
    />
  );
}
