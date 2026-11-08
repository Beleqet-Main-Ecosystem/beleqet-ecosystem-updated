import { Tabs } from 'expo-router';
import { Briefcase, BriefcaseBusiness, House, Laptop, MessageSquare, User, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isEmployer, useAuth } from '../../store/auth.store';
import { useTranslation } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';

/**
 * Tabs by role, like the website's two dashboards:
 *  - people looking for work: Home, Jobs, Freelance, Messages, Me
 *  - employers: Home, Hiring, Projects, Messages, Me
 * Guests get the looking-for-work tabs, minus Messages.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.user);
  const employer = isEmployer(user);
  const hide = { href: null } as const;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.lime,
        tabBarInactiveTintColor: '#9aa6b2',
        tabBarStyle: { backgroundColor: colors.header, borderTopColor: '#172C1D', height: 60 + insets.bottom, paddingBottom: Math.max(insets.bottom, 8), paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="home" options={{ title: t('m.tabs.home'), tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
      <Tabs.Screen name="jobs" options={employer ? hide : { title: t('m.tabs.jobs'), tabBarIcon: ({ color, size }) => <Briefcase color={color} size={size} /> }} />
      <Tabs.Screen name="freelance" options={employer ? hide : { title: t('m.tabs.freelance'), tabBarIcon: ({ color, size }) => <Laptop color={color} size={size} /> }} />
      <Tabs.Screen name="hiring" options={employer ? { title: t('m.tabs.hiring'), tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> } : hide} />
      <Tabs.Screen name="projects" options={employer ? { title: t('m.tabs.projects'), tabBarIcon: ({ color, size }) => <BriefcaseBusiness color={color} size={size} /> } : hide} />
      <Tabs.Screen name="messages" options={user ? { title: t('m.tabs.messages'), tabBarIcon: ({ color, size }) => <MessageSquare color={color} size={size} /> } : hide} />
      <Tabs.Screen name="me" options={{ title: t('m.tabs.me'), tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs>
  );
}
