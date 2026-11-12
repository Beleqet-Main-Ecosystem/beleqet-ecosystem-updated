import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BadgeCheck, Clock, MapPin } from 'lucide-react-native';
import type { Job } from '../api/jobs';
import type { Gig } from '../api/freelance';
import { Badge } from './ui';
import { formatBudget, formatSalary, initials, plainText, timeAgo } from '../lib/format';
import { useTranslation } from '../lib/i18n';
import { useTheme } from '../lib/theme';

/** Company logo, or its initials on the brand colour when there is none or it fails to load. */
export function Logo({ name, url, size = 44 }: { name: string; url?: string | null; size?: number }) {
  const [failed, setFailed] = useState<string | null>(null);
  // Android's Image can't draw SVG, so an SVG logo shows initials too.
  if (url && /^https?:\/\//.test(url) && !/\.svg(\?|$)/i.test(url) && failed !== url) {
    return <Image source={{ uri: url }} onError={() => setFailed(url)} style={{ width: size, height: size }} className="rounded-lg bg-ink-100" accessibilityIgnoresInvertColors />;
  }
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center rounded-lg bg-obsidian">
      <Text className="text-xs font-bold text-limeAccent">{initials(name)}</Text>
    </View>
  );
}

export function JobCard({ job }: { job: Job }) {
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
  const salary = formatSalary(job, t('search.upTo'));
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/job/${job.id}`)}
      className="gap-2.5 rounded-xl border border-ink-200 bg-surface p-4 active:opacity-80 dark:border-slate-800 dark:bg-slate-900"
    >
      <View className="flex-row gap-3">
        <Logo name={job.company} url={job.companyLogo} />
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-bold leading-6 text-ink-900 dark:text-white" numberOfLines={2}>
            {job.title}
          </Text>
          <View className="flex-row items-center gap-1">
            <Text className="shrink text-[13px] text-ink-600 dark:text-slate-300" numberOfLines={1}>
              {job.company}
            </Text>
            {job.companyVerified ? <BadgeCheck color={colors.accent} size={14} /> : null}
          </View>
        </View>
      </View>
      <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
        {job.location ? (
          <View className="flex-row items-center gap-1">
            <MapPin color={colors.muted} size={14} />
            <Text className="text-[13px] text-ink-500 dark:text-slate-400">{job.location}</Text>
          </View>
        ) : null}
        {job.createdAt ? (
          <View className="flex-row items-center gap-1">
            <Clock color={colors.muted} size={14} />
            <Text className="text-[13px] text-ink-500 dark:text-slate-400">{timeAgo(job.createdAt, locale)}</Text>
          </View>
        ) : null}
      </View>
      <View className="flex-row flex-wrap items-center gap-2">
        {job.typeCode ? <Badge label={t(`search.types.${job.typeCode}`)} /> : null}
        {job.featured ? <Badge label={t('m.featured')} tone="good" /> : null}
        {job.urgent ? <Badge label={t('m.urgent')} tone="bad" /> : null}
        {salary ? <Text className="ml-auto text-sm font-bold text-ink-900 dark:text-white">{salary}</Text> : null}
      </View>
    </Pressable>
  );
}

export function GigCard({ gig }: { gig: Gig }) {
  const { t, locale } = useTranslation();
  const hourly = gig.pricingType === 'HOURLY';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/gig/${gig.id}`)}
      className="gap-2.5 rounded-xl border border-ink-200 bg-surface p-4 active:opacity-80 dark:border-slate-800 dark:bg-slate-900"
    >
      <View className="flex-row flex-wrap gap-2">
        {gig.funded ? <Badge label={t('freelance.funded')} tone="good" /> : null}
        <Badge label={t(hourly ? 'freelance.hourly' : 'freelance.fixed')} />
        {gig.categoryLabel ? <Badge label={gig.categoryLabel} tone="info" /> : null}
      </View>
      <Text className="text-base font-bold leading-6 text-ink-900 dark:text-white" numberOfLines={2}>
        {gig.title}
      </Text>
      {gig.description ? (
        <Text className="text-[13px] leading-5 text-ink-600 dark:text-slate-300" numberOfLines={2}>
          {plainText(gig.description)}
        </Text>
      ) : null}
      <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
        <Text className="text-[15px] font-bold text-ink-900 dark:text-white">
          {formatBudget(gig)}
          {hourly ? ` / ${t('freelance.hour')}` : ''}
        </Text>
        <Text className="text-[13px] text-ink-500 dark:text-slate-400">{t('m.bidCount', { count: gig.bidCount })}</Text>
        {gig.createdAt ? <Text className="text-[13px] text-ink-500 dark:text-slate-400">{timeAgo(gig.createdAt, locale)}</Text> : null}
      </View>
    </Pressable>
  );
}
