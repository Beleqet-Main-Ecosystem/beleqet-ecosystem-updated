import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Shield, Clock, Tag, Users } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { fetchGig, submitProposal, formatBudget, gigPostedAgo, type Gig } from '../../api/freelance';
import { useAuthStore } from '../../store/auth.store';
import EscrowBadge from '../../components/EscrowBadge';

const TYPE_LABELS: Record<string, string> = {
  FIXED: 'Fixed Price',
  HOURLY: 'Hourly',
  RETAINER: 'Retainer',
};

export default function GigDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [gig, setGig] = useState<Gig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [proposedBudget, setProposedBudget] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchGig(id).then((g) => {
      setGig(g);
      setLoading(false);
    });
  }, [id]);

  async function handleSubmitProposal() {
    if (!gig) return;
    if (!user) { router.push('/(auth)/login'); return; }
    if (!coverLetter.trim()) {
      Toast.show({ type: 'error', text1: 'Write a cover letter first' });
      return;
    }
    const budget = parseFloat(proposedBudget);
    if (!proposedBudget || isNaN(budget) || budget <= 0) {
      Toast.show({ type: 'error', text1: 'Enter a valid budget' });
      return;
    }
    setSubmitting(true);
    try {
      await submitProposal(gig.id, { coverLetter: coverLetter.trim(), proposedBudget: budget });
      Toast.show({ type: 'success', text1: 'Proposal submitted! 🎉' });
      setShowProposalForm(false);
      setCoverLetter('');
      setProposedBudget('');
    } catch {
      Toast.show({ type: 'error', text1: 'Could not submit proposal' });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color="#041603" size="large" />
      </View>
    );
  }

  if (!gig) {
    return (
      <View className="flex-1 bg-surface items-center justify-center px-8">
        <Text className="text-ink font-bold text-base">Gig not found</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-brandGreen font-semibold">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Hero */}
        <View className="bg-primary px-5 pt-6 pb-8">
          <View className="w-14 h-14 bg-brandGreen rounded-2xl items-center justify-center mb-4">
            <Text className="text-primary text-xl font-black">
              {(gig.clientName ?? 'CL').substring(0, 2).toUpperCase()}
            </Text>
          </View>
          <Text className="text-white text-2xl font-black leading-tight">{gig.title}</Text>
          <Text className="text-white/50 mt-1 text-base">{gig.clientName ?? 'Anonymous Client'}</Text>

          {/* Chips */}
          <View className="flex-row flex-wrap gap-2 mt-4">
            <View className="flex-row items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full">
              <Tag color="#d8ff3e" size={12} />
              <Text className="text-white/80 text-xs font-semibold">{formatBudget(gig)}</Text>
            </View>
            {gig.type ? (
              <View className="flex-row items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full">
                <Text className="text-white/80 text-xs font-semibold">{TYPE_LABELS[gig.type] ?? gig.type}</Text>
              </View>
            ) : null}
            <View className="flex-row items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full">
              <Clock color="#d8ff3e" size={12} />
              <Text className="text-white/80 text-xs font-semibold">{gigPostedAgo(gig)}</Text>
            </View>
            {gig.proposalCount != null ? (
              <View className="flex-row items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full">
                <Users color="#d8ff3e" size={12} />
                <Text className="text-white/80 text-xs font-semibold">{gig.proposalCount} proposals</Text>
              </View>
            ) : null}
          </View>

          {gig.escrowEnabled && (
            <View className="mt-3">
              <EscrowBadge />
            </View>
          )}
        </View>

        {/* Body */}
        <View className="px-5 pt-6 gap-4">
          {gig.description ? (
            <View className="bg-white rounded-2xl p-4 border border-black/5">
              <Text className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Description</Text>
              <Text className="text-ink text-sm leading-7">{gig.description}</Text>
            </View>
          ) : null}

          {gig.skills.length > 0 ? (
            <View className="bg-white rounded-2xl p-4 border border-black/5">
              <Text className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Required Skills</Text>
              <View className="flex-row flex-wrap gap-2">
                {gig.skills.map((s) => (
                  <View key={s} className="bg-primary/5 px-3 py-1.5 rounded-full">
                    <Text className="text-ink text-xs font-semibold">{s}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Proposal form */}
          {showProposalForm && (
            <View className="bg-white rounded-2xl p-4 border border-black/5 gap-4">
              <Text className="text-xs font-bold uppercase tracking-widest text-muted">Your Proposal</Text>
              <View>
                <Text className="text-ink text-xs font-semibold mb-1.5">Cover letter</Text>
                <TextInput
                  className="border border-black/10 rounded-xl px-3 py-3 text-ink text-sm"
                  style={{ minHeight: 100, textAlignVertical: 'top' }}
                  placeholder="Describe your approach and why you're the right fit…"
                  placeholderTextColor="#9ca3af"
                  value={coverLetter}
                  onChangeText={setCoverLetter}
                  multiline
                  accessibilityLabel="Cover letter"
                />
              </View>
              <View>
                <Text className="text-ink text-xs font-semibold mb-1.5">Your bid (ETB)</Text>
                <TextInput
                  className="border border-black/10 rounded-xl px-3 py-3 text-ink text-sm"
                  placeholder="e.g. 15000"
                  placeholderTextColor="#9ca3af"
                  value={proposedBudget}
                  onChangeText={setProposedBudget}
                  keyboardType="numeric"
                  accessibilityLabel="Proposed budget"
                />
              </View>
              <TouchableOpacity
                className="bg-primary rounded-xl py-3.5 items-center"
                onPress={handleSubmitProposal}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#d8ff3e" />
                ) : (
                  <Text className="text-brandGreen font-black text-sm">Submit Proposal</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* CTA */}
      {!showProposalForm && (
        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-black/5 px-5 py-4">
          <TouchableOpacity
            className="bg-primary rounded-2xl py-4 items-center"
            onPress={() => setShowProposalForm(true)}
            accessibilityRole="button"
            accessibilityLabel="Submit a proposal"
          >
            <Text className="text-brandGreen font-black text-base">Submit Proposal</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
