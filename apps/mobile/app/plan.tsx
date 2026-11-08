import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { FileText } from 'lucide-react-native';
import { Screen, Card, H2, Muted, Field, Select, Button, Notice, Failed, Loading, Badge, Progress, Fact } from '../components/ui';
import {
  cancelSubscription,
  checkoutPlan,
  fetchManualPayments,
  fetchPlanPayment,
  fetchPlans,
  fetchSubscription,
  planMoney,
  sendReceipt,
  startManualPayment,
  type ManualPayment,
} from '../api/plans';
import { fetchQuota } from '../api/employer';
import type { PickedFile } from '../lib/api';
import { useTranslation } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { useLoad } from '../lib/use-load';
import { errorText } from '../lib/api-error';
import { shortDate } from '../lib/format';
import { openCheckout, pollUntil } from '../lib/checkout';
import { BANK_DETAILS } from '../lib/config';

/** Plan & billing: the current plan and usage, paying with Chapa, and paying by bank transfer. */
export default function PlanScreen() {
  const { t, locale } = useTranslation();
  const load = useLoad(() => Promise.all([fetchSubscription(), fetchQuota().catch(() => null), fetchPlans().catch(() => [])]), [], { refetchOnFocus: true });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [paymentState, setPaymentState] = useState<'' | 'checking' | 'paid' | 'failed' | 'slow'>('');

  if (load.loading) return <Screen title={t('emp.tabs.plan')}><Loading /></Screen>;
  if (load.error || !load.data) return <Screen title={t('emp.tabs.plan')}><Failed message={errorText(load.error, t)} onRetry={load.reload} /></Screen>;

  const [subscription, quota, plans] = load.data;
  const plan = subscription?.plan;
  const active = Boolean(subscription && !subscription.cancelAtPeriodEnd && subscription.status === 'ACTIVE');
  const paid = plans.filter((item) => item.priceAmount > 0 && item.isActive !== false);

  async function buy(planId: string) {
    setBusy(planId);
    setError('');
    setPaymentState('');
    try {
      const { checkoutUrl, paymentId } = await checkoutPlan(planId);
      await openCheckout(checkoutUrl);
      if (paymentId) {
        setPaymentState('checking');
        let final = '';
        const done = await pollUntil(async () => {
          final = (await fetchPlanPayment(paymentId)).status;
          return final === 'SUCCEEDED' || final === 'FAILED';
        }, 20, 3000);
        setPaymentState(!done ? 'slow' : final === 'SUCCEEDED' ? 'paid' : 'failed');
      }
      await load.reload();
    } catch (failure) {
      setError(errorText(failure, t, 'checkout.failed'));
    } finally {
      setBusy('');
    }
  }

  function cancel() {
    Alert.alert(t('dash.cancelTitle'), t('dash.cancelText'), [
      { text: t('dash.keepPlan'), style: 'cancel' },
      {
        text: t('dash.cancelPlan'),
        style: 'destructive',
        onPress: async () => {
          setError('');
          try {
            await cancelSubscription(subscription!.id);
            await load.reload();
          } catch (failure) {
            setError(errorText(failure, t, 'freelance.gig.actionFailed'));
          }
        },
      },
    ]);
  }

  return (
    <Screen title={t('emp.tabs.plan')} refreshing={load.refreshing} onRefresh={load.refresh}>
      {error ? <Notice tone="bad" text={error} /> : null}
      {paymentState ? <Notice tone={paymentState === 'failed' ? 'bad' : 'good'} text={t(`emp.payment.${paymentState}`)} /> : null}

      <Card>
        <Text className="text-xl font-extrabold text-ink-900 dark:text-white">{plan?.name ?? 'Free'}</Text>
        {plan?.priceAmount ? <Muted>{`${planMoney(plan.priceAmount, plan.currency)} / ${t('pricing.month')}`}</Muted> : null}
        {subscription?.currentPeriodEnd ? (
          <Muted>{t(active && subscription.provider === 'PAYPAL' ? 'dash.renews' : active ? 'emp.paidUntil' : 'dash.ends', { date: shortDate(subscription.currentPeriodEnd, locale) })}</Muted>
        ) : null}
        {quota ? (
          <View className="gap-1.5">
            <Fact label={t('pricing.rowPosts')} value={quota.max === null ? `${quota.used} / ∞` : t('postJob.postsUsed', { used: quota.used, max: quota.max })} />
            {quota.max ? <Progress value={(quota.used / quota.max) * 100} /> : null}
          </View>
        ) : null}
        {active && subscription!.provider !== 'PAYPAL' && subscription!.planId && plan?.priceAmount ? (
          <Button label={t('emp.payNextPeriod')} busy={busy === subscription!.planId} onPress={() => buy(subscription!.planId!)} />
        ) : null}
        {active && subscription!.provider === 'PAYPAL' ? <Button variant="danger" label={t('dash.cancelPlan')} onPress={cancel} /> : null}
      </Card>

      <H2>{t('emp.changePlan')}</H2>
      {paid.map((item) => (
        <Card key={item.id}>
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-lg font-bold text-ink-900 dark:text-white">{item.name}</Text>
            {plan?.name === item.name && active ? <Badge label={t('m.plan.current')} tone="good" /> : null}
          </View>
          <Text className="text-base font-bold text-ink-900 dark:text-white">{`${planMoney(item.priceAmount, item.currency)} / ${t('pricing.month')}`}</Text>
          {item.description ? <Muted>{item.description}</Muted> : null}
          {item.features?.maxJobPosts !== undefined ? <Muted>{`${t('pricing.rowPosts')}: ${item.features.maxJobPosts ?? '∞'}`}</Muted> : null}
          <Button label={t('m.plan.payChapa')} busy={busy === item.id} disabled={Boolean(busy)} onPress={() => buy(item.id)} />
        </Card>
      ))}
      <Muted>{t('m.plan.chapaNote')}</Muted>

      <BankTransfer plans={paid} />
    </Screen>
  );
}

/** Pay by bank transfer: start a payment, transfer, then send the receipt and the bank's reference. */
function BankTransfer({ plans }: { plans: { id: string; name: string; priceAmount: number; currency: string }[] }) {
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
  const payments = useLoad(fetchManualPayments, []);
  const [planId, setPlanId] = useState('');
  const [pendingOverride, setPendingOverride] = useState<ManualPayment | null | undefined>(undefined);
  const [reference, setReference] = useState('');
  const [receipt, setReceipt] = useState<PickedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pending = pendingOverride !== undefined ? pendingOverride : (payments.data ?? []).find((row) => row.status === 'PENDING') ?? null;
  const planName = (payment: ManualPayment) => plans.find((plan) => plan.id === payment.metadata?.planId)?.name;

  async function start() {
    if (!planId) return;
    setBusy(true);
    setError('');
    try {
      setPendingOverride(await startManualPayment(planId));
    } catch (failure) {
      setError(errorText(failure, t, 'emp.bank.startFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function pickReceipt() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if ((asset.size ?? 0) > 10 * 1024 * 1024) return setError(t('emp.fileTooBig'));
    setReceipt({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size });
  }

  async function send() {
    if (!pending || !reference.trim() || !receipt) return setError(t('emp.bank.needBoth'));
    setBusy(true);
    setError('');
    try {
      await sendReceipt(pending.id, reference.trim(), receipt);
      setNotice(t('emp.bank.sent'));
      setPendingOverride(null);
      setReference('');
      setReceipt(null);
      await payments.reload();
    } catch (failure) {
      setError(errorText(failure, t, 'emp.bank.receiptFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <H2>{t('emp.bank.title')}</H2>
        <Muted>{t('emp.bank.text')}</Muted>
        {error ? <Notice tone="bad" text={error} /> : null}
        {notice ? <Notice tone="good" text={notice} /> : null}
        {pending ? (
          <>
            {BANK_DETAILS ? (
              <View className="gap-1 rounded-lg bg-canvas p-3 dark:bg-slate-800">
                <Text className="text-sm font-bold text-ink-900 dark:text-white">{t('emp.bank.pay', { amount: planMoney(pending.amount, pending.currency) })}</Text>
                <Text selectable className="text-sm text-ink-800 dark:text-slate-200">{BANK_DETAILS}</Text>
              </View>
            ) : (
              <Notice tone="info" text={`${t('emp.bank.askDetails')} ${t('pricing.contact')}`} />
            )}
            <Field label={t('emp.bank.reference')} value={reference} onChangeText={setReference} autoCapitalize="characters" />
            <Button variant="outline" label={receipt ? receipt.name : t('emp.bank.receipt')} icon={<FileText color={colors.text} size={18} />} onPress={pickReceipt} />
            <Button label={t('emp.bank.send')} busy={busy} onPress={send} />
          </>
        ) : (
          <>
            <Select label={t('emp.bank.plan')} value={planId} onChange={setPlanId} placeholder={t('emp.bank.choose')} options={plans.map((plan) => ({ value: plan.id, label: `${plan.name} · ${planMoney(plan.priceAmount, plan.currency)}` }))} />
            <Button label={t('emp.bank.start')} variant="outline" busy={busy} disabled={!planId} onPress={start} />
          </>
        )}
      </Card>
      <H2>{t('emp.bank.history')}</H2>
      {(payments.data ?? []).length === 0 ? <Muted>{t('emp.bank.noPayments')}</Muted> : null}
      {(payments.data ?? []).map((payment) => (
        <Card key={payment.id}>
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text className="font-bold text-ink-900 dark:text-white">{planName(payment) ?? t('emp.bank.payment')}</Text>
              <Muted>{`${planMoney(payment.amount, payment.currency)} · ${shortDate(payment.createdAt, locale)}`}</Muted>
            </View>
            <Badge label={t(`emp.bank.status.${payment.status}`)} tone={payment.status === 'SUCCEEDED' ? 'good' : payment.status === 'FAILED' ? 'bad' : 'warn'} />
          </View>
        </Card>
      ))}
    </>
  );
}
