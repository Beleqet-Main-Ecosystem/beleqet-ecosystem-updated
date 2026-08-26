import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Clock, Shield, Star, Bookmark, BookmarkCheck } from 'lucide-react-native';
import type { Gig } from '../api/freelance';
import { formatBudget, gigPostedAgo } from '../api/freelance';
import EscrowBadge from './EscrowBadge';

interface Props {
  gig: Gig;
  onPress: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  FIXED: 'Fixed',
  HOURLY: 'Hourly',
  RETAINER: 'Retainer',
};

const TYPE_COLORS: Record<string, string> = {
  FIXED: 'bg-blue-50',
  HOURLY: 'bg-purple-50',
  RETAINER: 'bg-amber-50',
};

const TYPE_TEXT_COLORS: Record<string, string> = {
  FIXED: 'text-blue-700',
  HOURLY: 'text-purple-700',
  RETAINER: 'text-amber-700',
};

/**
 * Freelance gig card with budget, type badge, escrow badge, and save toggle.
 */
export default function GigCard({ gig, onPress }: Props) {
  const [saved, setSaved] = useState(false);

  const typeColor = (gig.type && TYPE_COLORS[gig.type]) ?? 'bg-gray-50';
  const typeText = (gig.type && TYPE_TEXT_COLORS[gig.type]) ?? 'text-gray-700';
  const typeLabel = (gig.type && TYPE_LABELS[gig.type]) ?? gig.type ?? '';

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-white rounded-2xl p-4 border border-black/5 active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel={`Gig: ${gig.title}`}
    >
      {/* Header */}
      <View className="flex-row items-start justify-between gap-3">
        <View className="w-11 h-11 bg-primary rounded-xl items-center justify-center shrink-0">
          <Text className="text-brandGreen text-sm font-black">
            {(gig.clientName ?? 'CL').substring(0, 2).toUpperCase()}
          </Text>
        </View>

        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            setSaved((v) => !v);
          }}
          className="w-8 h-8 items-center justify-center"
          accessibilityLabel={saved ? 'Unsave gig' : 'Save gig'}
        >
          {saved ? (
            <BookmarkCheck color="#d8ff3e" size={18} />
          ) : (
            <Bookmark color="#9ca3af" size={18} />
          )}
        </TouchableOpacity>
      </View>

      {/* Title */}
      <Text className="text-ink text-sm font-bold mt-3 leading-snug" numberOfLines={2}>
        {gig.title}
      </Text>
      <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
        {gig.clientName ?? 'Anonymous Client'}
      </Text>

      {/* Skills */}
      {gig.skills.length > 0 && (
        <View className="flex-row flex-wrap gap-1.5 mt-3">
          {gig.skills.slice(0, 3).map((skill) => (
            <View key={skill} className="bg-surface px-2.5 py-1 rounded-full">
              <Text className="text-muted text-[11px] font-semibold">{skill}</Text>
            </View>
          ))}
          {gig.skills.length > 3 && (
            <View className="bg-surface px-2.5 py-1 rounded-full">
              <Text className="text-muted text-[11px] font-semibold">+{gig.skills.length - 3}</Text>
            </View>
          )}
        </View>
      )}

      {/* Footer */}
      <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-black/5">
        <View>
          <Text className="text-ink text-sm font-black">{formatBudget(gig)}</Text>
          <View className="flex-row items-center gap-1 mt-0.5">
            <Clock color="#9ca3af" size={10} />
            <Text className="text-muted/70 text-[11px]">{gigPostedAgo(gig)}</Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          {typeLabel ? (
            <View className={`${typeColor} px-2.5 py-1 rounded-full`}>
              <Text className={`${typeText} text-[11px] font-bold`}>{typeLabel}</Text>
            </View>
          ) : null}
          {gig.escrowEnabled && <EscrowBadge compact />}
        </View>
      </View>

      {/* Rating */}
      {gig.rating != null && (
        <View className="flex-row items-center gap-1 mt-2">
          <Star color="#f59e0b" size={11} fill="#f59e0b" />
          <Text className="text-amber-500 text-[11px] font-semibold">
            {gig.rating.toFixed(1)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
