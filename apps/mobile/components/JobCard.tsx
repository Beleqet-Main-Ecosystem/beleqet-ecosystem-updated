import { View, Text, TouchableOpacity } from 'react-native';
import { MapPin, Clock, Briefcase, Star } from 'lucide-react-native';
import type { NormalizedJob } from '../api/jobs';

interface Props {
  job: NormalizedJob;
  onPress: () => void;
}

/**
 * Compact job listing card for use in FlatList feeds.
 */
export default function JobCard({ job, onPress }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-white rounded-2xl p-4 border border-black/5 active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel={`${job.title} at ${job.companyDisplay}`}
    >
      {/* Header row */}
      <View className="flex-row items-start gap-3">
        {/* Company avatar */}
        <View className="w-11 h-11 bg-primary rounded-xl items-center justify-center shrink-0">
          <Text className="text-brandGreen text-sm font-black">
            {job.companyDisplay.substring(0, 2).toUpperCase()}
          </Text>
        </View>

        <View className="flex-1">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-ink text-sm font-bold flex-1" numberOfLines={1}>
              {job.title}
            </Text>
            {job.featured && (
              <View className="bg-brandGreen/15 px-2 py-0.5 rounded-full flex-row items-center gap-1">
                <Star color="#041603" size={9} fill="#041603" />
                <Text className="text-primary text-[10px] font-black">Featured</Text>
              </View>
            )}
          </View>
          <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
            {job.companyDisplay}
          </Text>
        </View>
      </View>

      {/* Tags row */}
      <View className="flex-row flex-wrap gap-1.5 mt-3">
        {job.location ? (
          <Tag icon={<MapPin color="#6b7280" size={10} />} label={job.location} />
        ) : null}
        {job.typeDisplay ? (
          <Tag icon={<Briefcase color="#6b7280" size={10} />} label={job.typeDisplay} />
        ) : null}
        <Tag icon={<Clock color="#6b7280" size={10} />} label={job.postedAgo} />
      </View>

      {/* Salary */}
      {(job.salaryMin ?? job.salaryMax) ? (
        <Text className="text-primary text-xs font-bold mt-2">
          {job.salaryMin && job.salaryMax
            ? `${job.salaryMin.toLocaleString()} – ${job.salaryMax.toLocaleString()} ${job.currency ?? 'ETB'}`
            : `${(job.salaryMin ?? job.salaryMax)?.toLocaleString()} ${job.currency ?? 'ETB'}`}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

function Tag({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View className="flex-row items-center gap-1 bg-surface px-2.5 py-1 rounded-full">
      {icon}
      <Text className="text-muted text-[11px] font-semibold">{label}</Text>
    </View>
  );
}
