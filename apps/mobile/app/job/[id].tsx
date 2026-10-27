import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  StatusBar,
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
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
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
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchJob(id).then((j) => {
      setJob(j);
      setLoading(false);
    });
  }, [id]);

  async function handleShare() {
    if (!job) return;
    try {
      await Share.share({
        title: job.title,
        message: `Check out this job on Beleqet: ${job.title} at ${job.companyDisplay}\nhttps://beleqet.com/jobs/${job.id}`,
      });
    } catch {
      // Ignore share cancellation
    }
  }

  function handleToggleSave() {
    const next = !saved;
    setSaved(next);
    Toast.show({
      type: 'info',
      text1: next ? 'Saved to Bookmarks' : 'Removed from Bookmarks',
      text2: next ? 'You can view this job in your profile.' : undefined,
    });
  }

  async function handleApply() {
    if (!job) return;
    if (!user) {
      router.push('/(auth)/login');
      return;
    }

    Alert.alert(
      'Apply for Position',
      `Submit your verified Beleqet profile and resume to ${job.companyDisplay}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Application',
          onPress: async () => {
            setApplying(true);
            try {
              await applyToJob(job.id, {});
              Toast.show({
                type: 'success',
                text1: 'Application Submitted! 🎉',
                text2: `Your profile has been delivered to ${job.companyDisplay}.`,
              });
            } catch (err) {
              Toast.show({
                type: 'error',
                text1: 'Application Failed',
                text2: err instanceof Error ? err.message : 'Could not submit application. Please try again.',
              });
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
        <Text className="text-muted text-sm font-semibold mt-3">Loading job details…</Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View className="flex-1 bg-surface items-center justify-center px-8">
        <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center mb-4">
          <Briefcase color="#041603" size={28} />
        </View>
        <Text className="text-slate-900 font-bold text-lg">Job Not Found</Text>
        <Text className="text-muted text-sm text-center mt-1 mb-6">
          This job vacancy may have expired or been filled by the employer.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-primary px-6 py-3 rounded-full"
        >
          <Text className="text-brandGreen font-bold text-sm">Return to Job Listings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Company initials
  const initials = job.companyDisplay
    ? job.companyDisplay.substring(0, 2).toUpperCase()
    : 'BJ';

  // Format salary
  const hasSalary = Boolean(job.salaryMin || job.salaryMax);
  let salaryText = 'Negotiable / Competitive';
  if (hasSalary) {
    if (job.salaryMin && job.salaryMax && job.salaryMin !== job.salaryMax) {
      salaryText = `${job.salaryMin.toLocaleString()} – ${job.salaryMax.toLocaleString()} ${job.currency ?? 'ETB'}`;
    } else {
      salaryText = `${(job.salaryMin ?? job.salaryMax)?.toLocaleString()} ${job.currency ?? 'ETB'}`;
    }
  }

  return (
    <View className="flex-1 bg-surface">
      <StatusBar barStyle="light-content" backgroundColor="#041603" />

      {/* ── Top Floating Navigation Bar ── */}
      <View className="bg-primary px-5 pt-14 pb-3 flex-row items-center justify-between border-b border-white/10">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-white/10 items-center justify-center border border-white/10 active:opacity-75"
          accessibilityRole="button"
          accessibilityLabel="Back to jobs feed"
        >
          <ArrowLeft color="#ffffff" size={20} />
        </TouchableOpacity>

        <Text className="text-white text-sm font-bold flex-1 text-center px-3" numberOfLines={1}>
          {job.title}
        </Text>

        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={handleShare}
            className="w-10 h-10 rounded-full bg-white/10 items-center justify-center border border-white/10 active:opacity-75"
            accessibilityRole="button"
            accessibilityLabel="Share job"
          >
            <Share2 color="#ffffff" size={17} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleToggleSave}
            className="w-10 h-10 rounded-full bg-white/10 items-center justify-center border border-white/10 active:opacity-75"
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Unsave job' : 'Save job'}
          >
            {saved ? (
              <BookmarkCheck color="#d8ff3e" size={18} fill="#d8ff3e" />
            ) : (
              <Bookmark color="#ffffff" size={17} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Scrollable Body ── */}
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        
        {/* Hero Section */}
        <View className="bg-primary px-5 pt-4 pb-8">
          <View className="flex-row items-center gap-3.5 mb-4">
            <View className="w-14 h-14 bg-brandGreen rounded-2xl items-center justify-center shadow-md">
              <Text className="text-primary text-xl font-black">{initials}</Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-white/80 text-sm font-semibold">{job.companyDisplay}</Text>
                <ShieldCheck color="#d8ff3e" size={15} />
              </View>
              <Text className="text-white/40 text-xs mt-0.5">Verified Ethiopian Employer</Text>
            </View>
          </View>

          <Text className="text-white text-2xl font-black leading-tight tracking-tight">
            {job.title}
          </Text>

          {/* Quick Info Badges */}
          <View className="flex-row flex-wrap gap-2 mt-4">
            {job.location ? (
              <HeroBadge icon={<MapPin color="#d8ff3e" size={13} />} label={job.location} />
            ) : null}
            {job.typeDisplay ? (
              <HeroBadge icon={<Briefcase color="#d8ff3e" size={13} />} label={job.typeDisplay} />
            ) : null}
            {job.postedAgo ? (
              <HeroBadge icon={<Clock color="#d8ff3e" size={13} />} label={job.postedAgo} />
            ) : null}
            <HeroBadge
              icon={<DollarSign color="#d8ff3e" size={13} />}
              label={salaryText}
              highlight
            />
          </View>
        </View>

        {/* Details Content Cards */}
        <View className="px-5 pt-6 space-y-4">
          
          {/* Overview */}
          {job.description ? (
            <SectionCard title="About The Opportunity">
              <Text className="text-slate-700 text-sm leading-6">{job.description}</Text>
            </SectionCard>
          ) : null}

          {/* Requirements */}
          {job.requirements && (typeof job.requirements === 'string' ? job.requirements.length > 0 : true) ? (
            <SectionCard title="Key Requirements & Experience">
              {(typeof job.requirements === 'string'
                ? job.requirements.split('\n').filter(Boolean)
                : Array.isArray(job.requirements)
                ? job.requirements
                : []
              ).map((req: string, i: number) => (
                <View key={i} className="flex-row items-start gap-2.5 mb-2">
                  <CheckCircle2 color="#059669" size={16} style={{ marginTop: 2 }} />
                  <Text className="text-slate-700 text-sm leading-5 flex-1">{req}</Text>
                </View>
              ))}
            </SectionCard>
          ) : null}

          {/* Skills & Tags */}
          {job.tags && job.tags.length > 0 ? (
            <SectionCard title="Skills & Specializations">
              <View className="flex-row flex-wrap gap-2">
                {job.tags.map((tag) => (
                  <View
                    key={tag}
                    className="bg-primary/5 border border-primary/10 px-3.5 py-1.5 rounded-full"
                  >
                    <Text className="text-primary text-xs font-bold">{tag}</Text>
                  </View>
                ))}
              </View>
            </SectionCard>
          ) : null}

          {/* Employer Card */}
          <SectionCard title="About The Employer">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center">
                <Building2 color="#041603" size={20} />
              </View>
              <View className="flex-1">
                <Text className="text-slate-900 font-bold text-sm">{job.companyDisplay}</Text>
                <Text className="text-muted text-xs mt-0.5">
                  Direct recruiter on Beleqet Talent Platform
                </Text>
              </View>
            </View>
          </SectionCard>

        </View>
      </ScrollView>

      {/* ── Fixed Bottom Bar ── */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200/80 px-5 py-4 shadow-lg shadow-black/10">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={handleToggleSave}
            className="w-14 h-14 rounded-2xl bg-slate-100 items-center justify-center border border-slate-200 active:opacity-75"
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Saved' : 'Save'}
          >
            {saved ? (
              <BookmarkCheck color="#041603" size={22} fill="#041603" />
            ) : (
              <Bookmark color="#64748b" size={22} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 bg-primary rounded-2xl py-4 items-center justify-center active:opacity-90 shadow-md shadow-primary/20"
            onPress={handleApply}
            disabled={applying}
            accessibilityRole="button"
            accessibilityLabel="Apply for this job"
          >
            {applying ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator color="#d8ff3e" size="small" />
                <Text className="text-brandGreen font-black text-base">Submitting…</Text>
              </View>
            ) : (
              <Text className="text-brandGreen font-black text-base tracking-wide">
                Apply for Position
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Sub-components ──

function HeroBadge({
  icon,
  label,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  highlight?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full ${
        highlight ? 'bg-brandGreen/20 border border-brandGreen/30' : 'bg-white/10'
      }`}
    >
      {icon}
      <Text
        className={`text-xs font-bold ${
          highlight ? 'text-brandGreen' : 'text-white/90'
        }`}
      >
        {label}
      </Text>
    </View>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-white rounded-3xl p-5 border border-black/5 shadow-sm shadow-black/5">
      <Text className="text-xs font-extrabold uppercase tracking-wider text-muted mb-3.5">
        {title}
      </Text>
      {children}
    </View>
  );
}
