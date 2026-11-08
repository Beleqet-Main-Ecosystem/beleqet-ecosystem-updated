import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Card, H2, Muted, Button, Badge, Loading, Failed } from '../components/ui';
import { fetchPlans, planMoney, type Plan } from '../api/plans';
import { isEmployer, useAuth } from '../store/auth.store';
import { useTranslation } from '../lib/i18n';
import { useLoad } from '../lib/use-load';
import { errorText } from '../lib/api-error';

const FAQS = ['needPlan', 'howPay', 'limit', 'cancel', 'expires', 'escrow'] as const;
type Features = { maxJobPosts?: number; maxFreelanceBids?: number; featuredListing?: boolean; apiAccess?: boolean; support?: string };

/** Plans and what each includes, from the same data and text as the website's pricing page. */
export default function Pricing() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const plans = useLoad(fetchPlans, []);
  const [openFaq, setOpenFaq] = useState(0);

  const limit = (value?: number) => (value === undefined ? '—' : value < 0 ? t('pricing.unlimited') : String(value));
  const features = (plan: Plan) => (plan.features ?? {}) as Features;
  const list = (plan: Plan) => {
    const f = features(plan);
    return [
      t(f.maxJobPosts === 1 ? 'pricing.jobPost' : 'pricing.jobPosts', { count: limit(f.maxJobPosts) }),
      t('pricing.bids', { count: limit(f.maxFreelanceBids) }),
      f.featuredListing ? t('pricing.featuredListings') : null,
      f.apiAccess ? t('pricing.api') : null,
      f.support ? t('pricing.supportLine', { level: t(`pricing.support.${f.support}`) }) : null,
    ].filter(Boolean) as string[];
  };
  const rows = (plans.data ?? []).filter((plan) => plan.isActive !== false);
  const recommended = rows.length === 3 ? 1 : -1;

  function choose(plan: Plan) {
    if (!user) return router.push({ pathname: '/(auth)/register', params: { role: 'EMPLOYER' } });
    if (isEmployer(user)) return router.push('/plan');
    router.push({ pathname: '/(auth)/register', params: { role: 'EMPLOYER' } });
  }

  return (
    <Screen title={t('pricing.title')} refreshing={plans.refreshing} onRefresh={plans.refresh}>
      <Muted>{t('pricing.sub')}</Muted>
      {plans.loading ? <Loading /> : plans.error ? <Failed message={errorText(plans.error, t, 'pricing.unavailable')} onRetry={plans.reload} /> : null}
      {rows.map((plan, index) => (
        <Card key={plan.id} className={index === recommended ? 'border-2 border-forest dark:border-limeAccent' : ''}>
          <View className="flex-row items-center justify-between">
            <H2>{plan.name}</H2>
            {index === recommended ? <Badge label={t('pricing.recommended')} tone="good" /> : null}
          </View>
          <Text className="text-2xl font-extrabold text-ink-900 dark:text-white">
            {plan.priceAmount > 0 ? planMoney(plan.priceAmount, plan.currency) : 'Free'}
            {plan.priceAmount > 0 ? <Text className="text-sm font-normal text-ink-500"> / {t('pricing.month')}</Text> : null}
          </Text>
          {list(plan).map((line) => <Text key={line} className="text-sm text-ink-700 dark:text-slate-300">✓ {line}</Text>)}
          <Button label={plan.priceAmount > 0 ? t('pricing.subscribe') : t('pricing.createFree')} variant={index === recommended ? 'solid' : 'outline'} onPress={() => choose(plan)} />
        </Card>
      ))}
      <View className="gap-1 rounded-xl bg-obsidian p-4">
        <Text className="text-base font-bold text-limeAccent">{t('pricing.escrowTitle')}</Text>
        <Text className="text-sm leading-5 text-white/80">{t('pricing.escrowText')}</Text>
      </View>
      <H2>{t('pricing.questions')}</H2>
      <Card>
        {FAQS.map((faq, index) => (
          <Pressable key={faq} onPress={() => setOpenFaq(openFaq === index ? -1 : index)} accessibilityRole="button" accessibilityState={{ expanded: openFaq === index }} className="gap-1.5 border-b border-ink-100 py-3 last:border-0 dark:border-slate-800">
            <Text className="text-[15px] font-bold text-ink-900 dark:text-white">{t(`pricing.faq.${faq}.q`)}</Text>
            {openFaq === index ? <Muted>{t(`pricing.faq.${faq}.a`)}</Muted> : null}
          </Pressable>
        ))}
      </Card>
      <Button variant="ghost" label={t('pricing.moreQuestions')} onPress={() => router.push('/contact')} />
    </Screen>
  );
}
