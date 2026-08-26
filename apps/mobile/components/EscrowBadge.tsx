import { View, Text } from 'react-native';
import { Shield } from 'lucide-react-native';

interface Props {
  /** Compact mode shows only the icon + short label. Default is full badge. */
  compact?: boolean;
}

/**
 * Visual indicator that a gig is protected by BeleqetSafe Escrow.
 */
export default function EscrowBadge({ compact = false }: Props) {
  if (compact) {
    return (
      <View className="flex-row items-center gap-1 bg-brandGreen/15 px-2 py-1 rounded-full">
        <Shield color="#041603" size={10} />
        <Text className="text-primary text-[10px] font-black">Escrow</Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-2 bg-brandGreen/10 border border-brandGreen/20 rounded-xl px-3 py-2">
      <Shield color="#041603" size={14} />
      <View>
        <Text className="text-primary text-xs font-black">BeleqetSafe Escrow</Text>
        <Text className="text-primary/60 text-[11px]">
          Payment held until work is approved
        </Text>
      </View>
    </View>
  );
}
