import { useState } from 'react';
import { Linking, Pressable, Share, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Bookmark, BookmarkCheck, Share2, ShieldCheck } from 'lucide-react-native';
import { Screen, Card, H1, H2, Body, Muted, Fact, Badge, Button, Failed, Loading, Notice } from '../../components/ui';
import { JobCard, Logo } from '../../components/cards';
import { fetchJob, fetchSavedJobs, saveJob, searchJobs, unsaveJob } from '../../api/jobs';
import { fetchApplications } from '../../api/seeker';
import { isEmployer, useAuth } from '../../store/auth.store';
import { useTranslation } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';
import { useLoad } from '../../lib/use-load';
import { errorText } from '../../lib/api-error';
import { daysUntil, formatSalary, fullDate, plainText, safeHttpUrl, timeAgo } from '../../lib/format';
import { SITE_URL } from '../../lib/config';

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const job = useLoad(() => fetchJob(id), [id]);
  const similar = useLoad(
    () => (job.data ? searchJobs({ category: job.data.category, limit: 4 }).then((page) => page.items.filter((item) => item.id !== id).slice(0, 3)) : Promise.resolve([])),
    [job.data?.category, id],
    { enabled: Boolean(job.data) },
  );
  // Saved and applied state only matter to someone who can apply.
  const mine = useLoad(
    () => Promise.all([fetchSavedJobs().catch(() => []), fetchApplications().catch(() => [])]),
    [id, user?.id],
    { enabled: Boolean(user) && !isEmployer(user), refetchOnFocus: true },
  );
  const [savedOverride, setSavedOverride] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  const saved = savedOverride ?? Boolean(mine.data?.[0].some((row) => row.jobId === id));
  const applied = Boolean(mine.data?.[1].some((app) => app.jobId === id));

  async function toggleSave() {
    if (!user) return router.push({ pathname: '/(auth)/login', params: { next: `/job/${id}` } });
    setError('');
    const next = !saved;
    setSavedOverride(next);
    try {
      await (next ? saveJob(id) : unsaveJob(id));
    } catch (failure) {
      setSavedOverride(!next);
      setError(errorText(failure, t));
    }
  }

  const right = (
    <View className="flex-row">
      <Pressable onPress={() => Share.share({ message: `${job.data?.title ?? ''} ${SITE_URL}/jobs/${id}` })} accessibilityRole="button" accessibilityLabel={t('job.share')} className="h-11 w-11 items-center justify-center rounded-full active:bg-white/10">
        <Share2 color="#fff" size={20} />
      </Pressable>
      {!isEmployer(user) ? (
        <Pressable onPress={toggleSave} accessibilityRole="button" accessibilityLabel={t(saved ? 'm.unsave' : 'm.save')} className="h-11 w-11 items-center justify-center rounded-full active:bg-white/10">
          {saved ? <BookmarkCheck color={colors.lime} size={22} /> : <Bookmark color="#fff" size={22} />}
        </Pressable>
      ) : null}
    </View>
  );

  if (job.loading) return <Screen title="" right={right}><Loading /></Screen>;
  if (job.error || !job.data) return <Screen title=""><Failed message={errorText(job.error, t)} onRetry={job.reload} /></Screen>;

  const data = job.data;
  const days = daysUntil(data.closesAt);
  const closed = days !== null && days < 0;
  const salary = formatSalary(data, t('search.upTo'));
  const website = safeHttpUrl(data.companyWebsite);

  const footer = isEmployer(user) ? null : applied ? (
    <Button label={`✓ ${t('job.applied')} · ${t('job.apply.track')}`} variant="outline" onPress={() => router.push('/applications')} />
  ) : closed ? (
    <Button label={t('job.closed')} disabled />
  ) : (
    <Button label={t('job.applyNow')} onPress={() => (user ? router.push(`/job/apply/${id}`) : router.push({ pathname: '/(auth)/login', params: { next: `/job/apply/${id}` } }))} />
  );

  return (
    <Screen title={data.company} right={right} footer={footer} refreshing={job.refreshing} onRefresh={job.refresh}>
      <View className="flex-row gap-3">
        <Logo name={data.company} url={data.companyLogo} size={56} />
        <View className="flex-1 gap-1">
          <H1>{data.title}</H1>
          <Muted>{[data.company, data.location].filter(Boolean).join(' · ')}</Muted>
        </View>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {data.typeCode ? <Badge label={t(`search.types.${data.typeCode}`)} /> : null}
        {data.featured ? <Badge label={t('m.featured')} tone="good" /> : null}
        {data.urgent ? <Badge label={t('m.urgent')} tone="bad" /> : null}
        {data.companyVerified ? <Badge label={t('job.verified')} tone="info" /> : null}
      </View>
      {error ? <Notice tone="bad" text={error} /> : null}
      {closed ? (
        <Notice tone="warn" text={`${t('job.closedOn')} ${fullDate(data.closesAt, locale)}`} />
      ) : days !== null ? (
        <Notice tone="info" text={days === 0 ? t('job.closesToday') : t('job.closesIn', { n: days })} />
      ) : null}
      <Card>
        <H2>{t('job.overview')}</H2>
        {salary ? <Fact label={t('job.salary')} value={`${salary}${data.salaryType ? ` · ${data.salaryType}` : ''}`} /> : null}
        {data.experienceLevel ? <Fact label={t('job.experience')} value={data.experienceLevel} /> : null}
        <Fact label={t('job.openings')} value={String(data.vacancies)} />
        {data.createdAt ? <Fact label={t('job.posted')} value={timeAgo(data.createdAt, locale)} /> : null}
        {data.categoryLabel ? <Fact label={t('m.category')} value={data.categoryLabel} /> : null}
      </Card>
      <Card>
        <H2>{t('job.about')}</H2>
        <Body>{plainText(data.description) || t('job.noDescription')}</Body>
      </Card>
      {data.requirements ? (
        <Card>
          <H2>{t('job.requirements')}</H2>
          <Body>{plainText(data.requirements)}</Body>
        </Card>
      ) : null}
      {data.tags.length > 0 ? (
        <Card>
          <H2>{t('job.skills')}</H2>
          <View className="flex-row flex-wrap gap-2">
            {data.tags.map((tag) => <Badge key={tag} label={tag} />)}
          </View>
        </Card>
      ) : null}
      <Card>
        <View className="flex-row items-center gap-3">
          <Logo name={data.company} url={data.companyLogo} />
          <View className="flex-1">
            <Text className="text-base font-bold text-ink-900 dark:text-white">{data.company}</Text>
            <Muted>{[data.companyIndustry, data.companySize ? `${data.companySize} ${t('job.employees')}` : null].filter(Boolean).join(' · ')}</Muted>
          </View>
        </View>
        {data.companyDescription ? <Body>{data.companyDescription}</Body> : null}
        {website ? <Button label={t('job.website')} variant="outline" small onPress={() => Linking.openURL(website)} /> : null}
        {data.companyId ? <Button label={t('job.moreFromEmployer')} variant="ghost" small onPress={() => router.push({ pathname: '/(tabs)/jobs', params: { q: data.company } })} /> : null}
      </Card>
      <View className="flex-row gap-3 rounded-xl border border-ink-200 bg-surface p-4 dark:border-slate-800 dark:bg-slate-900">
        <ShieldCheck color={colors.accent} size={22} />
        <View className="flex-1 gap-1">
          <Text className="font-bold text-ink-900 dark:text-white">{t('job.safeTitle')}</Text>
          <Muted>{t('job.safeText')}</Muted>
        </View>
      </View>
      {(similar.data ?? []).length > 0 ? (
        <>
          <H2>{t('job.similar')}</H2>
          {similar.data!.map((item) => <JobCard key={item.id} job={item} />)}
        </>
      ) : null}
    </Screen>
  );
}
