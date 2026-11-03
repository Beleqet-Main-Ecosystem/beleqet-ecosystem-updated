import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Share,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ShieldCheck,
  Clock,
  Tag,
  Users,
  ArrowLeft,
  Share2,
  Bookmark,
  BookmarkCheck,
  Calendar,
  Briefcase,
  Sparkles,
  Send,
  CheckCircle2,
  X,
  FileText,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import {
  fetchGig,
  submitProposal,
  formatBudget,
  gigPostedAgo,
  type FreelanceJob,
} from '../../api/freelance';
import { useAuthStore } from '../../store/auth.store';

const TYPE_LABELS: Record<string, string> = {
  FIXED: 'Fixed Price',
  HOURLY: 'Hourly Rate',
  RETAINER: 'Monthly Retainer',
};

const SUGGESTED_DAYS = [3, 7, 14, 21, 30];

export default function GigDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const [gig, setGig] = useState<FreelanceJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  // Proposal Form State
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [proposedBudget, setProposedBudget] = useState('');
  const [timelineDays, setTimelineDays] = useState('7');
  const [submitting, setSubmitting] = useState(false);
  const [proposalSubmitted, setProposalSubmitted] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchGig(id)
      .then((g) => {
        setGig(g);
        if (g?.budgetMin) {
          setProposedBudget(String(g.budgetMin));
        }
        if (g?.deadlineDays) {
          setTimelineDays(String(g.deadlineDays));
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [id]);

  async function handleShare() {
    if (!gig) return;
    try {
      await Share.share({
        title: gig.title,
        message: `Check out this freelance project on Beleqet: "${gig.title}" (${formatBudget(gig)})\nhttps://beleqet.com/freelance/${gig.id}`,
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
      text2: next ? 'You can review this gig anytime from your profile.' : undefined,
    });
  }

  async function handleSubmitProposal() {
    if (!gig) return;
    if (!user) {
      router.push('/(auth)/login');
      return;
    }
    if (!coverLetter.trim() || coverLetter.trim().length < 15) {
      Toast.show({
        type: 'error',
        text1: 'Cover letter is too short',
        text2: 'Please write at least 15 characters explaining your qualifications.',
      });
      return;
    }
    const budget = parseFloat(proposedBudget);
    if (!proposedBudget || isNaN(budget) || budget <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Invalid bid amount',
        text2: 'Please specify a valid budget in ETB.',
      });
      return;
    }
    const days = parseInt(timelineDays, 10);
    if (!timelineDays || isNaN(days) || days <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Invalid delivery timeline',
        text2: 'Please specify the number of days you need to complete the project.',
      });
      return;
    }

    setSubmitting(true);
    try {
      await submitProposal(gig.id, {
        coverLetter: coverLetter.trim(),
        amount: budget,
        timelineDays: days,
      });
      setProposalSubmitted(true);
      setShowProposalForm(false);
      Toast.show({
        type: 'success',
        text1: 'Proposal Submitted! 🎉',
        text2: 'The client will be notified and can contact you directly.',
      });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Submission Failed',
        text2: err instanceof Error ? err.message : 'Could not submit proposal. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color="#041603" size="large" />
        <Text className="text-muted text-sm font-semibold mt-3">Loading project details…</Text>
      </View>
    );
  }

  if (!gig) {
    return (
      <View className="flex-1 bg-surface items-center justify-center px-8">
        <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center mb-4">
          <Briefcase color="#041603" size={28} />
        </View>
        <Text className="text-slate-900 font-bold text-lg">Project Not Found</Text>
        <Text className="text-muted text-sm text-center mt-1 mb-6">
          This freelance project may have been closed or is no longer accepting bids.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-primary px-6 py-3 rounded-full"
        >
          <Text className="text-brandGreen font-bold text-sm">Back to Freelance</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const g = gig as any;
  const clientName =
    (g.client?.firstName && g.client?.lastName
      ? `${g.client.firstName} ${g.client.lastName}`
      : g.client?.firstName ?? g.clientName) || 'Verified Client';
  const clientInitials = clientName.substring(0, 2).toUpperCase();
  const bidCount = g.bidCount ?? g.proposalCount ?? 0;
  const deliveryDays = gig.deadlineDays ? `${gig.deadlineDays} days` : 'Flexible';
  const pricingType = TYPE_LABELS[gig.pricingType] ?? gig.pricingType ?? 'Fixed Price';

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor="#041603" />

      {/* ── Top Navigation Bar ── */}
      <View className="bg-primary pt-12 pb-3 px-4 flex-row items-center justify-between border-b border-white/10">
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/freelance'))}
          className="w-10 h-10 rounded-full bg-white/10 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft color="#ffffff" size={20} />
        </TouchableOpacity>

        <Text className="text-white font-bold text-base tracking-wide">Project Details</Text>

        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={handleShare}
            className="w-10 h-10 rounded-full bg-white/10 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Share project"
          >
            <Share2 color="#ffffff" size={18} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleToggleSave}
            className="w-10 h-10 rounded-full bg-white/10 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Save project"
          >
            {saved ? (
              <BookmarkCheck color="#d8ff3e" size={20} />
            ) : (
              <Bookmark color="#ffffff" size={20} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: showProposalForm ? 60 : 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Card ── */}
        <View className="bg-primary px-5 pt-4 pb-8">
          <View className="flex-row items-center gap-3.5 mb-4">
            <View className="w-14 h-14 bg-brandGreen rounded-2xl items-center justify-center shadow-md">
              <Text className="text-primary text-xl font-black">{clientInitials}</Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-white/80 font-bold text-sm">{clientName}</Text>
                <CheckCircle2 color="#d8ff3e" size={14} />
              </View>
              <Text className="text-white/40 text-xs mt-0.5">Verified Payment & Identity</Text>
            </View>
          </View>

          {/* Title */}
          <Text className="text-white text-2xl font-black leading-tight mb-4">
            {gig.title}
          </Text>

          {/* Badges / Chips */}
          <View className="flex-row flex-wrap gap-2 mb-4">
            <View className="flex-row items-center gap-1.5 bg-brandGreen/20 px-3.5 py-1.5 rounded-full border border-brandGreen/30">
              <Tag color="#d8ff3e" size={13} />
              <Text className="text-brandGreen text-xs font-bold">{formatBudget(gig)}</Text>
            </View>
            <View className="flex-row items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full">
              <Briefcase color="rgba(255,255,255,0.7)" size={12} />
              <Text className="text-white/80 text-xs font-semibold">{pricingType}</Text>
            </View>
            <View className="flex-row items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full">
              <Calendar color="rgba(255,255,255,0.7)" size={12} />
              <Text className="text-white/80 text-xs font-semibold">{deliveryDays}</Text>
            </View>
            <View className="flex-row items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full">
              <Clock color="rgba(255,255,255,0.7)" size={12} />
              <Text className="text-white/80 text-xs font-semibold">{gigPostedAgo(gig)}</Text>
            </View>
            <View className="flex-row items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full">
              <Users color="rgba(255,255,255,0.7)" size={12} />
              <Text className="text-white/80 text-xs font-semibold">{bidCount} proposal{bidCount !== 1 ? 's' : ''}</Text>
            </View>
          </View>

          {/* Escrow banner */}
          <View className="flex-row items-center bg-white/10 border border-white/10 rounded-2xl p-3.5 gap-3">
            <View className="w-9 h-9 rounded-xl bg-brandGreen/20 items-center justify-center">
              <ShieldCheck color="#d8ff3e" size={20} />
            </View>
            <View className="flex-1">
              <Text className="text-brandGreen font-bold text-xs tracking-wide">
                BeleqetSafe Escrow Protected
              </Text>
              <Text className="text-white/60 text-xs leading-4 mt-0.5">
                Client deposit is verified before contract activation. Released on work approval.
              </Text>
            </View>
          </View>
        </View>

        {/* ── Content Sections ── */}
        <View className="px-5 -mt-3 gap-4">
          {/* Project Description */}
          <View className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
            <View className="flex-row items-center gap-2 mb-3">
              <FileText color="#041603" size={18} />
              <Text className="text-sm font-bold text-slate-900 tracking-wide uppercase">
                Project Scope & Requirements
              </Text>
            </View>
            <Text className="text-slate-700 text-sm leading-6">
              {gig.description || 'No detailed description provided by the client.'}
            </Text>
          </View>

          {/* Required Skills */}
          {gig.skills && gig.skills.length > 0 && (
            <View className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
              <View className="flex-row items-center gap-2 mb-3">
                <Sparkles color="#041603" size={18} />
                <Text className="text-sm font-bold text-slate-900 tracking-wide uppercase">
                  Required Skills & Expertise
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {gig.skills.map((skill) => (
                  <View
                    key={skill}
                    className="bg-slate-50 border border-slate-200/60 px-3.5 py-1.5 rounded-xl"
                  >
                    <Text className="text-slate-800 text-xs font-semibold">{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Client Trust Card */}
          <View className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
            <Text className="text-sm font-bold text-slate-900 tracking-wide uppercase mb-3">
              About the Client
            </Text>
            <View className="flex-row items-center justify-between py-2 border-b border-slate-100">
              <Text className="text-slate-500 text-xs">Payment Method</Text>
              <View className="flex-row items-center gap-1.5">
                <CheckCircle2 color="#16a34a" size={14} />
                <Text className="text-slate-900 text-xs font-bold">Verified</Text>
              </View>
            </View>
            <View className="flex-row items-center justify-between py-2 border-b border-slate-100">
              <Text className="text-slate-500 text-xs">Platform Deposit</Text>
              <Text className="text-slate-900 text-xs font-bold">Secured via Telebirr / CBE</Text>
            </View>
            <View className="flex-row items-center justify-between py-2">
              <Text className="text-slate-500 text-xs">Total Proposals</Text>
              <Text className="text-slate-900 text-xs font-bold">{bidCount} submitted</Text>
            </View>
          </View>

          {/* ── Proposal Form ── */}
          {showProposalForm && (
            <View className="bg-white rounded-3xl p-5 border-2 border-primary shadow-lg gap-4">
              <View className="flex-row items-center justify-between border-b border-slate-100 pb-3">
                <View className="flex-row items-center gap-2">
                  <Send color="#041603" size={18} />
                  <Text className="text-slate-900 font-black text-base">Submit Your Proposal</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowProposalForm(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
                  accessibilityLabel="Close proposal form"
                >
                  <X color="#64748b" size={16} />
                </TouchableOpacity>
              </View>

              {/* Bid Amount */}
              <View>
                <View className="flex-row items-center justify-between mb-1.5">
                  <Text className="text-slate-700 text-xs font-bold">Your Bid Amount (ETB)</Text>
                  <Text className="text-slate-400 text-xs">
                    Client budget: {formatBudget(gig)}
                  </Text>
                </View>
                <View className="flex-row items-center border border-slate-200 rounded-2xl px-3.5 py-2.5 bg-slate-50">
                  <Text className="text-slate-500 font-bold text-sm mr-2">ETB</Text>
                  <TextInput
                    className="flex-1 text-slate-900 text-sm font-semibold p-0"
                    placeholder="e.g. 15000"
                    placeholderTextColor="#94a3b8"
                    value={proposedBudget}
                    onChangeText={setProposedBudget}
                    keyboardType="numeric"
                    accessibilityLabel="Bid amount in ETB"
                  />
                </View>
              </View>

              {/* Delivery Timeline */}
              <View>
                <Text className="text-slate-700 text-xs font-bold mb-1.5">
                  Delivery Time (in days)
                </Text>
                <View className="flex-row gap-2 mb-2">
                  {SUGGESTED_DAYS.map((days) => (
                    <TouchableOpacity
                      key={days}
                      onPress={() => setTimelineDays(String(days))}
                      className={`flex-1 py-2 rounded-xl items-center border ${
                        timelineDays === String(days)
                          ? 'bg-primary border-primary'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          timelineDays === String(days) ? 'text-brandGreen' : 'text-slate-700'
                        }`}
                      >
                        {days}d
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  className="border border-slate-200 rounded-2xl px-3.5 py-2.5 text-slate-900 text-sm bg-slate-50"
                  placeholder="Or enter custom days (e.g. 10)"
                  placeholderTextColor="#94a3b8"
                  value={timelineDays}
                  onChangeText={setTimelineDays}
                  keyboardType="numeric"
                  accessibilityLabel="Timeline in days"
                />
              </View>

              {/* Cover Letter */}
              <View>
                <View className="flex-row items-center justify-between mb-1.5">
                  <Text className="text-slate-700 text-xs font-bold">Cover Letter & Approach</Text>
                  <Text className="text-slate-400 text-xs">
                    {coverLetter.length} characters
                  </Text>
                </View>
                <TextInput
                  className="border border-slate-200 rounded-2xl p-3.5 text-slate-900 text-sm bg-slate-50"
                  style={{ minHeight: 120, textAlignVertical: 'top' }}
                  placeholder="Introduce yourself, highlight relevant past work, and explain how you will successfully deliver this project…"
                  placeholderTextColor="#94a3b8"
                  value={coverLetter}
                  onChangeText={setCoverLetter}
                  multiline
                  accessibilityLabel="Cover letter text"
                />
              </View>

              {/* Submit CTA */}
              <TouchableOpacity
                className={`py-4 rounded-2xl items-center flex-row justify-center gap-2 shadow-sm ${
                  submitting ? 'bg-primary/80' : 'bg-primary'
                }`}
                onPress={handleSubmitProposal}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Submit proposal"
              >
                {submitting ? (
                  <>
                    <ActivityIndicator color="#d8ff3e" size="small" />
                    <Text className="text-brandGreen font-black text-sm">Submitting Proposal…</Text>
                  </>
                ) : (
                  <>
                    <Send color="#d8ff3e" size={16} />
                    <Text className="text-brandGreen font-black text-sm">Submit Proposal Now</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {proposalSubmitted && (
            <View className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 items-center">
              <CheckCircle2 color="#16a34a" size={32} />
              <Text className="text-emerald-950 font-bold text-base mt-2 text-center">
                Proposal Submitted!
              </Text>
              <Text className="text-emerald-700 text-xs text-center mt-1">
                You will receive a notification if the client shortlists or accepts your bid.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Fixed Bottom CTA Bar ── */}
      {!showProposalForm && (
        <View
          className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 px-5 pt-3.5 flex-row items-center justify-between shadow-lg"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <View>
            <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              Project Budget
            </Text>
            <Text className="text-slate-900 font-black text-base">{formatBudget(gig)}</Text>
          </View>

          <TouchableOpacity
            className={`px-7 py-3.5 rounded-full flex-row items-center gap-2 shadow-md ${
              proposalSubmitted ? 'bg-emerald-600' : 'bg-primary'
            }`}
            onPress={() => {
              if (proposalSubmitted) {
                Toast.show({ type: 'info', text1: 'You have already submitted a proposal for this gig.' });
              } else {
                setShowProposalForm(true);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Submit proposal button"
          >
            {proposalSubmitted ? (
              <>
                <CheckCircle2 color="#ffffff" size={16} />
                <Text className="text-white font-black text-sm">Submitted</Text>
              </>
            ) : (
              <>
                <Send color="#d8ff3e" size={16} />
                <Text className="text-brandGreen font-black text-sm">Submit Proposal</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
