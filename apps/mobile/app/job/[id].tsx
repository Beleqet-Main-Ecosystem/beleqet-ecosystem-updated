import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  MapPin,
  Clock,
  Briefcase,
  DollarSign,
  Building2,
  ArrowLeft,
  Share2,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { fetchJob, applyToJob, type NormalizedJob } from '../../api/jobs';
import { useAuthStore } from '../../store/auth.store';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [job, setJob] = useState<NormalizedJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchJob(id).then((j) => {
      setJob(j);
      setLoading(false);
    });
  }, [id]);

  async function handleApply() {
    if (!job) return;
    if (!user) {
      router.push('/(auth)/login');
      return;
    }
    Alert.alert(
      'Apply for this job',
      `Submit your application to ${job.companyDisplay}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: async () => {
            setApplying(true);
            try {
              await applyToJob(job.id, {});
              Toast.show({ type: 'success', text1: 'Application submitted! 🎉' });
            } catch {
              Toast.show({ type: 'error', text1: 'Could not submit application' });
            } finally {
              setApplying(false);
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color="#041603" size="large" />
      </View>
    );
  }

  if (!job) {
    return (
      <View className="flex-1 bg-surface items-center justify-center px-8">
        <Text className="text-ink font-bold text-base">Job not found</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-brandGreen font-semibold">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero */}
        <View className="bg-primary px-5 pt-6 pb-8">
          {/* Company avatar */}
          <View className="w-14 h-14 bg-brandGreen rounded-2xl items-center justify-center mb-4">
            <Text className="text-primary text-xl font-black">
              {job.companyDisplay.substring(0, 2).toUpperCase()}
            </Text>
          </View>
          <Text className="text-white text-2xl font-black leading-tight">{job.title}</Text>
          <Text className="text-white/50 mt-1 text-base">{job.companyDisplay}</Text>

          {/* Metadata chips */}
          <View className="flex-row flex-wrap gap-2 mt-4">
            {job.location ? (
              <Chip icon={<MapPin color="#d8ff3e" size={12} />} label={job.location} />
            ) : null}
            {job.typeDisplay ? (
              <Chip icon={<Briefcase color="#d8ff3e" size={12} />} label={job.typeDisplay} />
            ) : null}
            {job.postedAgo ? (
              <Chip icon={<Clock color="#d8ff3e" size={12} />} label={job.postedAgo} />
            ) : null}
            {(job.salaryMin ?? job.salaryMax) ? (
              <Chip
                icon={<DollarSign color="#d8ff3e" size={12} />}
                label={
                  job.salaryMin && job.salaryMax
                    ? `${job.salaryMin.toLocaleString()}–${job.salaryMax.toLocaleString()} ${job.currency ?? 'ETB'}`
                    : `${(job.salaryMin ?? job.salaryMax)?.toLocaleString()} ${job.currency ?? 'ETB'}`
                }
              />
            ) : null}
          </View>
        </View>

        {/* Body */}
        <View className="px-5 pt-6 gap-5">
          {/* Description */}
          {job.description ? (
            <Section title="Job Description">
              <Text className="text-ink text-sm leading-7">{job.description}</Text>
            </Section>
          ) : null}

          {/* Requirements */}
          {job.requirements && job.requirements.length > 0 ? (
            <Section title="Requirements">
              {job.requirements.map((req, i) => (
                <View key={i} className="flex-row gap-2 mb-1.5">
                  <Text className="text-brandGreen font-bold text-sm">•</Text>
                  <Text className="text-ink text-sm leading-6 flex-1">{req}</Text>
                </View>
              ))}
            </Section>
          ) : null}

          {/* Benefits */}
          {job.benefits && job.benefits.length > 0 ? (
            <Section title="Benefits">
              {job.benefits.map((b, i) => (
                <View key={i} className="flex-row gap-2 mb-1.5">
                  <Text className="text-brandGreen font-bold text-sm">✓</Text>
                  <Text className="text-ink text-sm leading-6 flex-1">{b}</Text>
                </View>
              ))}
            </Section>
          ) : null}

          {/* Tags */}
          {job.tags && job.tags.length > 0 ? (
            <Section title="Skills & Tags">
              <View className="flex-row flex-wrap gap-2">
                {job.tags.map((tag) => (
                  <View key={tag} className="bg-primary/5 px-3 py-1.5 rounded-full">
                    <Text className="text-ink text-xs font-semibold">{tag}</Text>
                  </View>
                ))}
              </View>
            </Section>
          ) : null}
        </View>
      </ScrollView>

      {/* Apply button — fixed bottom */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-black/5 px-5 py-4">
        <TouchableOpacity
          className="bg-primary rounded-2xl py-4 items-center active:opacity-80"
          onPress={handleApply}
          disabled={applying}
          accessibilityRole="button"
          accessibilityLabel="Apply for this job"
        >
          {applying ? (
            <ActivityIndicator color="#d8ff3e" />
          ) : (
            <Text className="text-brandGreen font-black text-base">Apply Now</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full">
      {icon}
      <Text className="text-white/80 text-xs font-semibold">{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-white rounded-2xl p-4 border border-black/5">
      <Text className="text-xs font-bold uppercase tracking-widest text-muted mb-3">{title}</Text>
      {children}
    </View>
  );
}
