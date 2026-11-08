import { router } from 'expo-router';
import { Screen, Button } from '../components/ui';
import { RowList } from '../components/row-list';
import { fetchMyContracts } from '../api/freelance';
import { useAuth } from '../store/auth.store';
import { useTranslation } from '../lib/i18n';
import { useLoad } from '../lib/use-load';
import { money, shortDate, shortName } from '../lib/format';

/** Contracts this person is part of, as freelancer or client. */
export default function Contracts() {
  const { t, locale } = useTranslation();
  const me = useAuth((s) => s.user);
  const contracts = useLoad(fetchMyContracts, [], { refetchOnFocus: true });
  const rows = contracts.data?.map((contract) => {
    const other = contract.clientId === me?.id ? contract.freelancer : contract.client;
    return {
      id: contract.id,
      title: contract.freelanceJob.title,
      detail: [money(contract.agreedAmount, contract.currency), shortDate(contract.startedAt, locale), shortName(other)].filter(Boolean).join(' · '),
      status: t(`freelance.contract.status.${contract.status}`),
      tone: (contract.status === 'ACTIVE' ? 'good' : contract.status === 'DISPUTED' ? 'bad' : 'neutral') as 'good' | 'bad' | 'neutral',
      onPress: () => router.push(`/contract/${contract.id}`),
    };
  });
  return (
    <Screen title={t('dash.tabs.contracts')} scroll={false}>
      <RowList
        rows={rows}
        loading={contracts.loading}
        error={contracts.error}
        refreshing={contracts.refreshing}
        onRetry={contracts.reload}
        onRefresh={contracts.refresh}
        emptyTitle={t('dash.noContracts')}
        emptyAction={<Button small label={t('freelance.gig.browse')} onPress={() => router.push('/(tabs)/freelance')} />}
      />
    </Screen>
  );
}
