import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Bell, Search } from 'lucide-react-native';
import { Screen, Scroll, Card, H2, Muted, Button, Empty, Failed, Loading, Progress, Field } from '../../components/ui';
import { GigCard, JobCard, Logo } from '../../components/cards';
import { VerifyEmailBanner } from '../../components/verify-banner';
import { isEmployer, useAuth } from '../../store/auth.store';
import { useTranslation } from '../../lib/i18n';
import { useLoad } from '../../lib/use-load';
import { errorText } from '../../lib/api-error';
import { formatSalary, shortDate } from '../../lib/format';
import { searchJobs } from '../../api/jobs';
import { searchGigs } from '../../api/freelance';
import { ACTIVE_STATUSES, fetchApplications, fetchFeed, fetchProfile, profileChecks } from '../../api/seeker';
import { fetchMyJobs } from '../../api/employer';
import { fetchMyProjects } from '../../api/freelance';
import { useUnread } from '../../lib/unread';

export default function Home() {
  const user = useAuth((s) => s.user);
  const { t } = useTranslation();
  const unread = useUnread();
  const bell = user ? (
    <Pressable onPress={() => router.push('/notifications')} accessibilityRole="button" accessibilityLabel={t('m.notifications')} className="h-11 w-11 items-center justify-center rounded-full active:bg-white/10">
      <Bell color="#fff" size={22} />
      {unread > 0 ? <View className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-limeAccent" /> : null}
    </Pressable>
  ) : null;
  return (
    <Screen title="Beleqet" back={false} right={bell} scroll={false}>
      {!user ? <GuestHome /> : isEmployer(user) ? <EmployerHome /> : <SeekerHome />}
    </Screen>
  );
}

/** Signed out: search, the latest jobs and projects, and a way in. */
function GuestHome() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const load = useLoad(() => Promise.all([searchJobs({ limit: 5 }), searchGigs({ limit: 3 })]), []);
  return (
    <Scroll refreshing={load.refreshing} onRefresh={load.refresh}>
      <View className="gap-2 rounded-2xl bg-obsidian p-5">
        <Text className="text-[26px] font-extrabold leading-8 text-white">{t('hero.title')}</Text>
        <Text className="text-[15px] leading-6 text-white/75">{t('hero.subtitle')}</Text>
        <View className="mt-2 flex-row gap-2">
          <View className="flex-1">
            <Field value={q} onChangeText={setQ} placeholder={t('m.searchJobs')} returnKeyType="search" onSubmitEditing={() => router.push({ pathname: '/(tabs)/jobs', params: { q } })} />
          </View>
          <Button label="" icon={<Search color="#041603" size={20} />} variant="lime" onPress={() => router.push({ pathname: '/(tabs)/jobs', params: { q } })} />
        </View>
      </View>
      <View className="flex-row gap-3">
        <Button className="flex-1" label={t('auth.signIn')} variant="outline" onPress={() => router.push('/(auth)/login')} />
        <Button className="flex-1" label={t('auth.createAccount')} onPress={() => router.push('/(auth)/register')} />
      </View>
      {load.loading ? <Loading /> : load.error ? <Failed message={errorText(load.error, t)} onRetry={load.reload} /> : (
        <>
          <SectionTitle title={t('m.home.latestJobs')} action={t('m.seeAll')} onPress={() => router.push('/(tabs)/jobs')} />
          {load.data?.[0].items.map((job) => <JobCard key={job.id} job={job} />)}
          <SectionTitle title={t('m.home.openProjects')} action={t('m.seeAll')} onPress={() => router.push('/(tabs)/freelance')} />
          {load.data?.[1].items.map((gig) => <GigCard key={gig.id} gig={gig} />)}
        </>
      )}
    </Scroll>
  );
}

/** Job seekers and freelancers: the website's dashboard overview. */
function SeekerHome() {
  const { t, locale } = useTranslation();
  const user = useAuth((s) => s.user)!;
  const load = useLoad(() => Promise.all([fetchApplications(), fetchProfile()]), [], { refetchOnFocus: true });
  // The personal feed is a nice-to-have: the page works without it.
  const feed = useLoad(() => fetchFeed(3).catch(() => []), []);

  return (
    <Scroll refreshing={load.refreshing} onRefresh={() => Promise.all([load.refresh(), feed.refresh()]).then(() => undefined)}>
      <VerifyEmailBanner />
      <View className="gap-1">
        <Text className="text-2xl font-extrabold text-ink-900 dark:text-white">{t('dash.hello', { name: user.firstName })}</Text>
        <Muted>{t('dash.helloSub')}</Muted>
      </View>
      {load.loading ? <Loading /> : load.error || !load.data ? <Failed message={errorText(load.error, t)} onRetry={load.reload} /> : (() => {
        const [apps, profile] = load.data;
        const stats = [
          { key: 'dash.statApplied', value: apps.length },
          { key: 'dash.statActive', value: apps.filter((app) => ACTIVE_STATUSES.includes(app.status)).length },
          { key: 'dash.statInterviews', value: apps.filter((app) => app.status === 'INTERVIEW_SCHEDULED').length },
          { key: 'dash.statOffers', value: apps.filter((app) => app.status === 'OFFERED').length },
        ];
        const interview = apps
          .filter((app) => app.status === 'INTERVIEW_SCHEDULED' && app.interviewSlot && new Date(app.interviewSlot) > new Date())
          .sort((a, b) => a.interviewSlot!.localeCompare(b.interviewSlot!))[0];
        const checks = profileChecks(profile);
        const strength = Math.round((checks.filter((check) => check.done).length / checks.length) * 100);
        return (
          <>
            <View className="flex-row flex-wrap gap-3">
              {stats.map((stat) => (
                <Pressable key={stat.key} onPress={() => router.push('/applications')} accessibilityRole="button" className="min-w-[45%] flex-1 gap-1 rounded-xl border border-ink-200 bg-surface p-4 dark:border-slate-800 dark:bg-slate-900">
                  <Muted>{t(stat.key)}</Muted>
                  <Text className="text-[26px] font-extrabold text-ink-900 dark:text-white">{stat.value}</Text>
                </Pressable>
              ))}
            </View>
            {interview ? (
              <Pressable onPress={() => router.push('/interviews')} accessibilityRole="button" className="gap-1 rounded-xl bg-obsidian p-4">
                <Text className="text-[13px] font-bold text-limeAccent">{t('dash.upcoming')}</Text>
                <Text className="text-base font-bold text-white">{[interview.job.title, interview.job.company?.name].filter(Boolean).join(' · ')}</Text>
                <Text className="text-sm text-white/75">{shortDate(interview.interviewSlot, locale)}</Text>
              </Pressable>
            ) : null}
            <Card>
              <SectionTitle title={t('dash.jobsForYou')} action={t('dash.openFeed')} onPress={() => router.push('/feed')} />
              {(feed.data ?? []).length === 0 ? <Muted>{t('dash.noJobs')}</Muted> : null}
              {(feed.data ?? []).map((job) => (
                <Pressable key={job.id} onPress={() => router.push(`/job/${job.id}`)} className="flex-row items-center gap-3 border-t border-ink-100 py-3 dark:border-slate-800">
                  <Logo name={job.company} url={job.companyLogo} size={40} />
                  <View className="flex-1">
                    <Text className="text-[15px] font-bold text-ink-900 dark:text-white" numberOfLines={1}>{job.title}</Text>
                    <Muted>{[job.company, job.location].filter(Boolean).join(' · ')}</Muted>
                  </View>
                  <Text className="text-[13px] font-bold text-ink-900 dark:text-white">{formatSalary(job, t('search.upTo')) ?? ''}</Text>
                </Pressable>
              ))}
            </Card>
            <Card onPress={() => router.push('/profile')}>
              <View className="flex-row items-center justify-between">
                <H2>{t('dash.strength')}</H2>
                <Text className="font-bold text-ink-900 dark:text-white">{strength}%</Text>
              </View>
              <Progress value={strength} />
              {checks.map((check) => (
                <Text key={check.key} className="text-sm text-ink-700 dark:text-slate-300">
                  {check.done ? '✓' : '○'} {t(`dash.checks.${check.key}`)}
                </Text>
              ))}
            </Card>
          </>
        );
      })()}
    </Scroll>
  );
}

/** Employers: open jobs with applicant counts, and their freelance projects. */
function EmployerHome() {
  const { t } = useTranslation();
  const load = useLoad(() => Promise.all([fetchMyJobs(), fetchMyProjects().catch(() => [])]), [], { refetchOnFocus: true });
  return (
    <Scroll refreshing={load.refreshing} onRefresh={load.refresh}>
      <VerifyEmailBanner />
      {load.loading ? <Loading /> : load.error || !load.data ? <Failed message={errorText(load.error, t)} onRetry={load.reload} /> : (() => {
        const [jobs, projects] = load.data;
        const open = jobs.filter((job) => job.status === 'PUBLISHED');
        const applicants = open.reduce((sum, job) => sum + (job._count?.applications ?? 0), 0);
        const hiring = projects.filter((project) => project.contract && project.contract.status === 'ACTIVE');
        return (
          <>
            <View className="gap-1">
              <Text className="text-2xl font-extrabold text-ink-900 dark:text-white">{t('emp.overview')}</Text>
              <Muted>{t('emp.overviewSub', { open: open.length, applicants })}</Muted>
            </View>
            <View className="flex-row gap-3">
              <Button className="flex-1" label={`+ ${t('postJob.title')}`} onPress={() => router.push('/post-job')} />
              <Button className="flex-1" label={`+ ${t('m.postProject')}`} variant="outline" onPress={() => router.push('/post-project')} />
            </View>
            {open.length === 0 ? (
              <Empty title={t('emp.noOpen')} text={t('emp.noOpenText')} />
            ) : (
              <Card>
                <SectionTitle title={t('emp.openJobs')} action={t('emp.manageAll')} onPress={() => router.push('/(tabs)/hiring')} />
                {open.map((job) => (
                  <Pressable key={job.id} onPress={() => router.push({ pathname: '/applicants', params: { job: job.id } })} className="gap-0.5 border-t border-ink-100 py-3 dark:border-slate-800">
                    <Text className="text-[15px] font-bold text-ink-900 dark:text-white">{job.title}</Text>
                    <Muted>{[job.location, t('emp.applicantCount', { count: job._count?.applications ?? 0 })].filter(Boolean).join(' · ')}</Muted>
                  </Pressable>
                ))}
              </Card>
            )}
            {hiring.length > 0 ? (
              <Card>
                <SectionTitle title={t('m.home.activeContracts')} action={t('m.seeAll')} onPress={() => router.push('/(tabs)/projects')} />
                {hiring.map((project) => (
                  <Pressable key={project.id} onPress={() => router.push(`/contract/${project.contract!.id}`)} className="border-t border-ink-100 py-3 dark:border-slate-800">
                    <Text className="text-[15px] font-bold text-ink-900 dark:text-white">{project.title}</Text>
                  </Pressable>
                ))}
              </Card>
            ) : null}
          </>
        );
      })()}
    </Scroll>
  );
}

export function SectionTitle({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <H2>{title}</H2>
      {action && onPress ? (
        <Pressable onPress={onPress} accessibilityRole="link" className="min-h-9 justify-center">
          <Text className="text-sm font-bold text-forest dark:text-limeAccent">{action} →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
