import { TouchableOpacity, Text } from 'react-native';

interface Props {
  label: string;
  active: boolean;
  onPress: () => void;
}

/**
 * Horizontal filter pill used in Jobs and Freelance tab headers.
 */
export default function CategoryPill({ label, active, onPress }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`px-4 py-2 rounded-full border ${
        active
          ? 'bg-brandGreen border-brandGreen'
          : 'bg-white/10 border-white/20'
      }`}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Text
        className={`text-xs font-bold ${active ? 'text-primary' : 'text-white/70'}`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
