import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Screen, Button } from '../../components/ui';
import { RowList } from '../../components/row-list';
import { fetchMyProjects } from '../../api/freelance';
import { useTranslation } from '../../lib/i18n';
import { useLoad } from '../../lib/use-load';
import { shortDate } from '../../lib/format';

/** The employer's freelance projects; each opens its bids or, once someone is hired, the contract. */
export default function Projects() {
  const { t, locale } = useTranslation();
  const projects = useLoad(fetchMyProjects, [], { refetchOnFocus: true });
  const rows = projects.data?.map((project) => ({
    id: project.id,
    title: project.title,
    detail: `${t('dash.bidCount', { count: project._count.bids })} · ${shortDate(project.createdAt, locale)}`,
    status: t(`dash.projectStatus.${project.status}`),
    tone: (project.status === 'IN_PROGRESS' ? 'good' : project.status === 'OPEN' || project.status === 'FUNDED' ? 'info' : 'neutral') as 'good' | 'info' | 'neutral',
    onPress: () => router.push(project.contract ? `/contract/${project.contract.id}` : `/gig/${project.id}`),
  }));
  return (
    <Screen
      title={t('m.tabs.projects')}
      back={false}
      scroll={false}
      right={
        <Pressable onPress={() => router.push('/post-project')} accessibilityRole="button" accessibilityLabel={t('dash.postProject')} className="h-11 w-11 items-center justify-center rounded-full active:bg-white/10">
          <Plus color="#fff" size={24} />
        </Pressable>
      }
    >
      <RowList
        rows={rows}
        loading={projects.loading}
        error={projects.error}
        refreshing={projects.refreshing}
        onRetry={projects.reload}
        onRefresh={projects.refresh}
        emptyTitle={t('dash.noProjects')}
        emptyAction={<Button small label={t('dash.postProject')} onPress={() => router.push('/post-project')} />}
      />
    </Screen>
  );
}
