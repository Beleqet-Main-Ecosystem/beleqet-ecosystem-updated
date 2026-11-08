import { router } from 'expo-router';
import { Screen, Button } from '../components/ui';
import { RowList } from '../components/row-list';
import { fetchMyBids } from '../api/freelance';
import { useTranslation } from '../lib/i18n';
import { useLoad } from '../lib/use-load';
import { money, shortDate } from '../lib/format';

/** The bids this person sent, newest first; an accepted bid opens its contract. */
export default function Bids() {
  const { t, locale } = useTranslation();
  const bids = useLoad(fetchMyBids, [], { refetchOnFocus: true });
  const rows = bids.data?.map((bid) => ({
    id: bid.id,
    title: bid.freelanceJob.title,
    detail: `${money(bid.amount, bid.freelanceJob.currency)} · ${shortDate(bid.createdAt, locale)}`,
    status: t(`dash.bidStatus.${bid.status}`),
    tone: (bid.status === 'ACCEPTED' ? 'good' : bid.status === 'REJECTED' ? 'bad' : 'neutral') as 'good' | 'bad' | 'neutral',
    onPress: () => router.push(bid.freelanceJob.contract ? `/contract/${bid.freelanceJob.contract.id}` : `/gig/${bid.freelanceJob.id}`),
  }));
  return (
    <Screen title={t('dash.tabs.bids')} scroll={false}>
      <RowList
        rows={rows}
        loading={bids.loading}
        error={bids.error}
        refreshing={bids.refreshing}
        onRetry={bids.reload}
        onRefresh={bids.refresh}
        emptyTitle={t('dash.noBids')}
        emptyAction={<Button small label={t('freelance.gig.browse')} onPress={() => router.push('/(tabs)/freelance')} />}
      />
    </Screen>
  );
}
