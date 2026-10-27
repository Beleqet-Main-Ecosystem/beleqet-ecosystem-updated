import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';

interface Props {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
  count?: number;
}

/**
 * Horizontal filter pill used in Jobs and Freelance tab headers.
 */
export default function CategoryPill({ label, active, onPress, icon, count }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className={`flex-row items-center gap-1.5 px-4 py-2.5 rounded-full border transition-all ${
        active
          ? 'bg-brandGreen border-brandGreen shadow-sm shadow-brandGreen/30'
          : 'bg-white/10 border-white/15'
      }`}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      {icon}
      <Text
        className={`text-xs font-black tracking-wide ${
          active ? 'text-primary' : 'text-white/80'
        }`}
      >
        {label}
      </Text>
      {typeof count === 'number' && count > 0 && (
        <View
          className={`px-1.5 py-0.2 rounded-full ${
            active ? 'bg-primary/20' : 'bg-white/20'
          }`}
        >
          <Text
            className={`text-[10px] font-bold ${
              active ? 'text-primary' : 'text-white'
            }`}
          >
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
