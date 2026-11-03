import { memo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MapPin, Clock, Briefcase, Star, Bookmark, BookmarkCheck, ChevronRight, Building2 } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import type { NormalizedJob } from '../api/jobs';

interface Props {
  job: NormalizedJob;
  onPress: () => void;
}

/**
 * Modern, elevated JobCard component for the Beleqet Jobs feed.
 */
function JobCard({ job, onPress }: Props) {
  const [saved, setSaved] = useState(false);

  function toggleSave() {
    const next = !saved;
    setSaved(next);
    Toast.show({
      type: 'info',
      text1: next ? 'Job Saved' : 'Job Removed',
      text2: next ? 'You can view saved jobs in your profile.' : 'Removed from your saved jobs.',
      visibilityTime: 2000,
    });
  }

  // Company avatar initial
  const initials = job.companyDisplay
    ? job.companyDisplay.substring(0, 2).toUpperCase()
    : 'BJ';

  // Format salary
  const hasSalary = Boolean(job.salaryMin || job.salaryMax);
  let salaryText = '';
  if (hasSalary) {
    if (job.salaryMin && job.salaryMax && job.salaryMin !== job.salaryMax) {
      salaryText = `${job.salaryMin.toLocaleString()} – ${job.salaryMax.toLocaleString()} ${job.currency ?? 'ETB'}`;
    } else {
      salaryText = `${(job.salaryMin ?? job.salaryMax)?.toLocaleString()} ${job.currency ?? 'ETB'}`;
    }
  }

  // Determine job type badge color
  const isRemote = job.typeDisplay?.toLowerCase().includes('remote');
  const isFullTime = job.typeDisplay?.toLowerCase().includes('full');

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      className="bg-white rounded-3xl p-4 border border-black/5 shadow-sm shadow-black/5 mb-3"
      accessibilityRole="button"
      accessibilityLabel={`${job.title} at ${job.companyDisplay}`}
    >
      {/* Top Header: Company Avatar + Title + Bookmark */}
      <View className="flex-row items-start gap-3">
        {/* Company Avatar with subtle gradient/badge */}
        <View className="w-12 h-12 rounded-2xl bg-primary items-center justify-center shadow-sm">
          <Text className="text-brandGreen text-sm font-black tracking-wider">
            {initials}
          </Text>
        </View>

        {/* Title & Company */}
        <View className="flex-1 pr-1">
          <View className="flex-row items-center gap-1.5 flex-wrap">
            <Text className="text-ink text-base font-bold leading-5 flex-1" numberOfLines={1}>
              {job.title}
            </Text>
            {job.featured && (
              <View className="bg-brandGreen/20 px-2 py-0.5 rounded-full flex-row items-center gap-1">
                <Star color="#041603" size={9} fill="#041603" />
                <Text className="text-primary text-[10px] font-black uppercase tracking-wider">
                  Featured
                </Text>
              </View>
            )}
          </View>

          <View className="flex-row items-center gap-1.5 mt-1">
            <Building2 color="#94a3b8" size={12} />
            <Text className="text-muted text-xs font-semibold" numberOfLines={1}>
              {job.companyDisplay}
            </Text>
          </View>
        </View>

        {/* Bookmark Button */}
        <TouchableOpacity
          onPress={toggleSave}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          className="p-1.5 rounded-full bg-slate-50 border border-black/5"
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove saved job' : 'Save job'}
        >
          {saved ? (
            <BookmarkCheck color="#041603" size={16} fill="#041603" />
          ) : (
            <Bookmark color="#94a3b8" size={16} />
          )}
        </TouchableOpacity>
      </View>

      {/* Meta Pills (Location, Job Type, Freshness) */}
      <View className="flex-row flex-wrap gap-1.5 mt-3.5">
        {job.location ? (
          <View className="flex-row items-center gap-1 bg-slate-100/80 px-2.5 py-1 rounded-full">
            <MapPin color="#64748b" size={11} />
            <Text className="text-slate-600 text-[11px] font-semibold">{job.location}</Text>
          </View>
        ) : null}

        {job.typeDisplay ? (
          <View
            className={`flex-row items-center gap-1 px-2.5 py-1 rounded-full ${
              isRemote
                ? 'bg-purple-50 border border-purple-200/50'
                : isFullTime
                ? 'bg-emerald-50 border border-emerald-200/50'
                : 'bg-slate-100/80'
            }`}
          >
            <Briefcase
              color={isRemote ? '#7e22ce' : isFullTime ? '#059669' : '#64748b'}
              size={11}
            />
            <Text
              className={`text-[11px] font-semibold ${
                isRemote ? 'text-purple-700' : isFullTime ? 'text-emerald-700' : 'text-slate-600'
              }`}
            >
              {job.typeDisplay}
            </Text>
          </View>
        ) : null}

        <View className="flex-row items-center gap-1 bg-slate-100/80 px-2.5 py-1 rounded-full">
          <Clock color="#64748b" size={11} />
          <Text className="text-slate-600 text-[11px] font-semibold">{job.postedAgo}</Text>
        </View>
      </View>

      {/* Card Footer: Salary + Details Arrow */}
      <View className="flex-row items-center justify-between pt-3 mt-3 border-t border-slate-100">
        <View>
          <Text className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Compensation
          </Text>
          <Text className="text-primary text-xs font-black mt-0.5">
            {hasSalary ? salaryText : 'Negotiable / Attractive'}
          </Text>
        </View>

        <View className="flex-row items-center gap-1">
          <Text className="text-xs font-bold text-primary">View details</Text>
          <ChevronRight color="#041603" size={14} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default memo(JobCard);
