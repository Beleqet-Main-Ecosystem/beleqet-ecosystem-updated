import { useState, memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Clock, Bookmark, BookmarkCheck, Calendar, Users, ChevronRight } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import type { FreelanceJob } from '../api/freelance';
import { formatBudget, gigPostedAgo } from '../api/freelance';

interface Props {
  gig: FreelanceJob;
  onPress: () => void;
}

/**
 * Modern, elevated Freelance Gig Card for Beleqet Open Projects feed.
 */
function GigCard({ gig, onPress }: Props) {
  const [saved, setSaved] = useState(false);

  function toggleSave() {
    const next = !saved;
    setSaved(next);
    Toast.show({
      type: 'info',
      text1: next ? 'Gig Bookmarked' : 'Removed from Bookmarks',
      text2: next ? 'Saved to your profile bookmarks.' : undefined,
      visibilityTime: 2000,
    });
  }

  const clientName = (gig as any).client
    ? `${(gig as any).client.firstName ?? ''} ${(gig as any).client.lastName ?? ''}`.trim() || 'Verified Client'
    : (gig as any).clientName ?? 'Verified Client';

  const initials = clientName.substring(0, 2).toUpperCase() || 'CL';
  const bidCount = (gig as any).bidCount ?? (gig as any)._count?.bids ?? 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      className="bg-white rounded-3xl p-4 border border-black/5 shadow-sm shadow-black/5 mb-3"
      accessibilityRole="button"
      accessibilityLabel={`Gig: ${gig.title}`}
    >
      {/* Top Header: Client Avatar + Title + Save */}
      <View className="flex-row items-start gap-3">
        {/* Client Avatar with Escrow shield indicator */}
        <View className="w-12 h-12 rounded-2xl bg-primary items-center justify-center shadow-sm">
          <Text className="text-brandGreen text-sm font-black tracking-wider">
            {initials}
          </Text>
        </View>

        {/* Title & Client Name */}
        <View className="flex-1 pr-1">
          <Text className="text-ink text-base font-bold leading-5" numberOfLines={2}>
            {gig.title}
          </Text>
          <View className="flex-row items-center gap-1.5 mt-1">
            <Text className="text-muted text-xs font-semibold" numberOfLines={1}>
              {clientName}
            </Text>
            <View className="w-1 h-1 rounded-full bg-slate-300" />
            <Text className="text-emerald-700 text-[11px] font-bold">Verified Escrow</Text>
          </View>
        </View>

        {/* Bookmark Action */}
        <TouchableOpacity
          onPress={toggleSave}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          className="p-1.5 rounded-full bg-slate-50 border border-black/5"
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove saved gig' : 'Save gig'}
        >
          {saved ? (
            <BookmarkCheck color="#041603" size={16} fill="#041603" />
          ) : (
            <Bookmark color="#94a3b8" size={16} />
          )}
        </TouchableOpacity>
      </View>

      {/* Skills Badges */}
      {gig.skills && gig.skills.length > 0 && (
        <View className="flex-row flex-wrap gap-1.5 mt-3.5">
          {gig.skills.slice(0, 3).map((skill) => (
            <View
              key={skill}
              className="bg-slate-100/90 border border-slate-200/50 px-2.5 py-1 rounded-full"
            >
              <Text className="text-slate-700 text-[11px] font-bold">{skill}</Text>
            </View>
          ))}
          {gig.skills.length > 3 && (
            <View className="bg-slate-100/90 border border-slate-200/50 px-2 py-1 rounded-full">
              <Text className="text-slate-600 text-[11px] font-semibold">
                +{gig.skills.length - 3}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Meta Indicators: Duration & Bids */}
      <View className="flex-row items-center gap-3 mt-3">
        {gig.deadlineDays ? (
          <View className="flex-row items-center gap-1">
            <Calendar color="#64748b" size={12} />
            <Text className="text-slate-500 text-xs font-semibold">
              {gig.deadlineDays} days delivery
            </Text>
          </View>
        ) : null}

        <View className="flex-row items-center gap-1">
          <Users color="#64748b" size={12} />
          <Text className="text-slate-500 text-xs font-semibold">
            {bidCount} {bidCount === 1 ? 'proposal' : 'proposals'}
          </Text>
        </View>

        <View className="flex-row items-center gap-1">
          <Clock color="#64748b" size={12} />
          <Text className="text-slate-500 text-xs font-semibold">
            {gigPostedAgo(gig)}
          </Text>
        </View>
      </View>

      {/* Card Footer: Budget + Escrow + View Action */}
      <View className="flex-row items-center justify-between pt-3 mt-3 border-t border-slate-100">
        <View>
          <Text className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Budget (Escrow Held)
          </Text>
          <Text className="text-primary text-sm font-black mt-0.5">
            {formatBudget(gig)}
          </Text>
        </View>

        <View className="flex-row items-center gap-1">
          <Text className="text-xs font-bold text-primary">Submit bid</Text>
          <ChevronRight color="#041603" size={14} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default memo(GigCard);
