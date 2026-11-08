import { Alert, Image, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import {
  Bell,
  Bookmark,
  BookmarkCheck,
  Brain,
  Briefcase,
  Building2,
  Calculator,
  CalendarDays,
  CircleUser,
  CreditCard,
  FileCheck2,
  FilePen,
  Handshake,
  Info,
  LayoutTemplate,
  LogOut,
  Mail,
  Megaphone,
  Mic,
  Settings,
  Shield,
  Sparkles,
  Tag,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { Screen, Card, Button, MenuRow, Divider, Avatar, Muted, Chips } from '../../components/ui';
import { VerifyEmailBanner } from '../../components/verify-banner';
import { isEmployer, useAuth } from '../../store/auth.store';
import { useTranslation, type Locale } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';
import { safeHttpUrl } from '../../lib/format';
import { SITE_URL } from '../../lib/config';
import * as WebBrowser from 'expo-web-browser';

/** A screen in the app, or (url) a website page opened in the in-app browser. */
type Item = { label: string; href?: Href; url?: string; Icon: LucideIcon };

/** Everything that isn't a tab, grouped like the website's dashboard menus, by role. */
export default function Me() {
  const { t, locale, setLocale } = useTranslation();
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);

  const icon = (Icon: LucideIcon) => <Icon color={colors.accent} size={20} />;
  const section = (title: string, items: Item[]) => (
    <View className="gap-1.5">
      <Text className="px-1 text-[13px] font-bold uppercase text-ink-500 dark:text-slate-400">{title}</Text>
      <View className="overflow-hidden rounded-xl border border-ink-200 bg-surface dark:border-slate-800 dark:bg-slate-900">
        {items.map((item, index) => (
          <View key={String(item.href ?? item.url)}>
            {index > 0 ? <Divider /> : null}
            <MenuRow icon={icon(item.Icon)} label={item.label} onPress={() => (item.url ? void WebBrowser.openBrowserAsync(item.url, { toolbarColor: '#041603' }) : router.push(item.href!))} />
          </View>
        ))}
      </View>
    </View>
  );

  const tools: Item[] = [
    { label: t('m.tools.cvMaker'), href: '/cv-maker', Icon: FilePen },
    { label: t('resumeBrain.title'), href: '/resume-brain', Icon: Brain },
    { label: t('m.tools.portfolio'), href: '/portfolio', Icon: LayoutTemplate },
    { label: t('m.tools.chatToText'), href: '/chat-to-text', Icon: Mic },
    { label: t('m.tools.forum'), href: '/forum', Icon: Megaphone },
    { label: t('m.tools.tax'), href: '/tax', Icon: Calculator },
  ];
  const about: Item[] = [
    { label: t('m.about.pricing'), href: '/pricing', Icon: Tag },
    { label: t('m.about.about'), url: `${SITE_URL}/about`, Icon: Info },
    { label: t('m.about.contact'), href: '/contact', Icon: Mail },
    { label: t('footer.privacy'), url: `${SITE_URL}/privacy`, Icon: Shield },
  ];
  const language = (
    <Card>
      <Text className="text-sm font-semibold text-ink-900 dark:text-white">{t('dash.language')}</Text>
      <Chips value={locale} onChange={(value) => setLocale(value as Locale)} options={[{ value: 'en', label: 'English' }, { value: 'am', label: 'አማርኛ' }]} />
    </Card>
  );

  if (!user) {
    return (
      <Screen title={t('m.tabs.me')} back={false}>
        <Card>
          <Text className="text-xl font-extrabold text-ink-900 dark:text-white">{t('m.me.guestTitle')}</Text>
          <Muted>{t('m.me.guestText')}</Muted>
          <Button label={t('auth.signIn')} onPress={() => router.push('/(auth)/login')} />
          <Button label={t('auth.createAccount')} variant="outline" onPress={() => router.push('/(auth)/register')} />
        </Card>
        {language}
        {section(t('m.me.tools'), tools.filter((item) => ['/tax', '/forum'].includes(String(item.href))))}
        {section(t('m.me.about'), about)}
      </Screen>
    );
  }

  const employer = isEmployer(user);
  const name = `${user.firstName} ${user.lastName}`.trim();
  const photo = safeHttpUrl(user.avatarUrl);

  const work: Item[] = employer
    ? [
        { label: t('emp.tabs.company'), href: '/company', Icon: Building2 },
        { label: t('emp.tabs.plan'), href: '/plan', Icon: CreditCard },
        { label: t('emp.tabs.applicants'), href: '/applicants', Icon: FileCheck2 },
        { label: t('emp.interviewsTitle'), href: '/interviews', Icon: CalendarDays },
        { label: t('dash.tabs.contracts'), href: '/contracts', Icon: Handshake },
      ]
    : [
        { label: t('dash.tabs.profile'), href: '/profile', Icon: CircleUser },
        { label: t('dash.tabs.applications'), href: '/applications', Icon: Briefcase },
        { label: t('dash.tabs.saved'), href: '/saved-jobs', Icon: Bookmark },
        { label: t('dash.tabs.interviews'), href: '/interviews', Icon: CalendarDays },
        { label: t('dash.jobsForYou'), href: '/feed', Icon: Sparkles },
        { label: t('dash.alerts.title'), href: '/alerts', Icon: Bell },
      ];
  const freelance: Item[] = [
    { label: t('dash.tabs.bids'), href: '/bids', Icon: FileCheck2 },
    { label: t('dash.tabs.contracts'), href: '/contracts', Icon: Handshake },
    { label: t('dash.tabs.wallet'), href: '/wallet', Icon: Wallet },
    { label: t('m.savedProjects'), href: '/saved-projects', Icon: BookmarkCheck },
  ];

  function confirmSignOut() {
    Alert.alert(t('auth.logout'), t('m.me.signOutText'), [
      { text: t('postJob.cancel'), style: 'cancel' },
      { text: t('auth.logout'), style: 'destructive', onPress: () => void signOut().then(() => router.replace('/(tabs)/home')) },
    ]);
  }

  return (
    <Screen title={t('m.tabs.me')} back={false}>
      <View className="flex-row items-center gap-3">
        {photo ? <Image source={{ uri: photo }} className="h-14 w-14 rounded-full" accessibilityIgnoresInvertColors /> : <Avatar name={name} size={56} tone="lime" />}
        <View className="flex-1">
          <Text className="text-lg font-bold text-ink-900 dark:text-white">{name}</Text>
          <Muted>{user.email}</Muted>
          <Muted>{t(`auth.roles.${user.role}.short`)}</Muted>
        </View>
      </View>
      <VerifyEmailBanner />
      {section(employer ? t('m.me.hiring') : t('m.me.jobs'), work)}
      {!employer ? section(t('m.tabs.freelance'), freelance) : null}
      {section(t('m.me.tools'), employer ? tools.filter((item) => ['/forum', '/tax', '/chat-to-text'].includes(String(item.href))) : tools)}
      {section(t('m.me.account'), [{ label: t('dash.tabs.settings'), href: '/settings', Icon: Settings }, { label: t('m.notifications'), href: '/notifications', Icon: Bell }])}
      {section(t('m.me.about'), about)}
      <Button variant="danger" label={t('auth.logout')} icon={<LogOut color={colors.danger} size={18} />} onPress={confirmSignOut} />
    </Screen>
  );
}
