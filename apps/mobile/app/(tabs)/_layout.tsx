import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Briefcase, Zap, Mic, User } from 'lucide-react-native';

const ACTIVE = '#d8ff3e';
const INACTIVE = '#6b7280';
const BG = '#041603';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: BG,
          borderTopColor: '#1a3a17',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color, size }) => (
            <Briefcase color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="freelance"
        options={{
          title: 'Freelance',
          tabBarIcon: ({ color, size }) => (
            <Zap color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat-to-Text',
          tabBarIcon: ({ color, size }) => (
            <Mic color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <User color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
