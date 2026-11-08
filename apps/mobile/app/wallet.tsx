import { useState } from 'react';
import { Text, View } from 'react-native';
import { Screen, Card, H2, Muted, Field, Select, Button, Notice, Failed, Loading, Badge } from '../components/ui';
import { fetchBanks, fetchWallet, stepUp, withdraw, withdrawalState } from '../api/freelance';
import { useAuth } from '../store/auth.store';
import { useTranslation } from '../lib/i18n';
import { useLoad } from '../lib/use-load';
import { errorText, toApiError } from '../lib/api-error';
import { dateTime } from '../lib/format';

/** Earnings: available, on hold, history, and withdrawing to a Chapa bank. Same rules as the website. */
export default function Wallet() {
  const { t, locale } = useTranslation();
  const user = useAuth((s) => s.user);
  const wallet = useLoad(fetchWallet, [], { refetchOnFocus: true });
  const banks = useLoad(() => fetchBanks().catch(() => []), []);
  const [bankCode, setBankCode] = useState('');
  const [accountName, setAccountName] = useState(user ? `${user.firstName} ${user.lastName}`.trim() : '');
  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [code, setCode] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  if (wallet.loading) return <Screen title={t('dash.tabs.wallet')}><Loading /></Screen>;
  if (wallet.error || !wallet.data) return <Screen title={t('dash.tabs.wallet')}><Failed message={errorText(wallet.error, t)} onRetry={wallet.reload} /></Screen>;

  const data = wallet.data;
  const money = (value: number) => `${data.currency ?? 'ETB'} ${value.toLocaleString('en-US')}`;
  const bank = banks.data?.find((b) => b.code === bankCode);

  async function submit() {
    setError('');
    setNotice('');
    const value = Number(amount);
    const digits = accountNumber.replace(/[\s-]/g, '');
    if (!bank) return setError(t('dash.wallet.pickBank'));
    if (accountName.trim().length < 2) return setError(t('dash.wallet.needName'));
    if (bank.accountLength && digits.length !== bank.accountLength) return setError(t('dash.wallet.badLength', { bank: bank.name, n: bank.accountLength }));
    if (!Number.isInteger(value) || value < 1) return setError(t('dash.wallet.badAmount'));
    if (value > data.availableBalance) return setError(t('dash.wallet.tooMuch'));
    if (needsCode && !/^\d{6}$/.test(code.trim())) return setError(t('dash.wallet.needCode'));

    setBusy(true);
    try {
      let pass: string | undefined;
      if (needsCode) {
        try {
          pass = await stepUp('wallet_withdraw', code.trim());
        } catch (failure) {
          setError(toApiError(failure).serverMessage || t('dash.wallet.codeWrong'));
          return;
        }
      }
      await withdraw({ amount: value, bankCode, accountName: accountName.trim(), accountNumber: digits }, pass);
      setNotice(t('dash.wallet.sent', { amount: money(value), bank: bank.name }));
      setAmount('');
      setCode('');
      setNeedsCode(false);
      await wallet.reload();
    } catch (failure) {
      const problem = toApiError(failure);
      if (problem.status === 401 && problem.body?.requiresStepUp) {
        setNeedsCode(true);
        setError(t('dash.wallet.enterCode'));
      } else {
        setError(errorText(failure, t, 'dash.wallet.failed'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title={t('dash.tabs.wallet')} refreshing={wallet.refreshing} onRefresh={wallet.refresh}>
      <Muted>{t('dash.wallet.sub')}</Muted>
      <View className="flex-row gap-3">
        <Card className="flex-1">
          <Muted>{t('dash.wallet.available')}</Muted>
          <Text className="text-2xl font-extrabold text-ink-900 dark:text-white">{money(data.availableBalance)}</Text>
        </Card>
        <Card className="flex-1">
          <Muted>{t('dash.wallet.onHold')}</Muted>
          <Text className="text-2xl font-extrabold text-ink-900 dark:text-white">{money(data.pendingBalance)}</Text>
        </Card>
      </View>
      <Muted>{t('dash.wallet.onHoldText')}</Muted>

      <Card>
        <H2>{t('dash.wallet.withdrawTitle')}</H2>
        <Select
          label={t('dash.wallet.bank')}
          value={bankCode}
          onChange={setBankCode}
          placeholder={t('dash.wallet.chooseBank')}
          options={(banks.data ?? []).map((b) => ({ value: b.code, label: b.name }))}
        />
        {banks.data && banks.data.length === 0 && !banks.loading ? <Notice tone="warn" text={t('dash.wallet.noBanks')} /> : null}
        <Field label={t('dash.wallet.accountName')} value={accountName} onChangeText={setAccountName} autoComplete="name" />
        <Field
          label={bank?.mobileMoney ? t('dash.wallet.phone') : t('dash.wallet.accountNumber')}
          value={accountNumber}
          onChangeText={setAccountNumber}
          keyboardType="number-pad"
          hint={bank?.accountLength ? t('dash.wallet.digits', { n: bank.accountLength }) : undefined}
        />
        <Field label={t('dash.wallet.amount')} value={amount} onChangeText={(value) => setAmount(value.replace(/\D/g, ''))} keyboardType="number-pad" hint={t('m.wallet.max', { amount: money(data.availableBalance) })} />
        {needsCode ? <Field label={t('dash.wallet.code')} value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" /> : null}
        {error ? <Notice tone="bad" text={error} /> : null}
        {notice ? <Notice tone="good" text={notice} /> : null}
        <Button label={busy ? t('m.wallet.sending') : t('dash.wallet.withdraw')} onPress={submit} busy={busy} disabled={data.availableBalance < 1} />
        <Muted>{t('dash.wallet.checkName')}</Muted>
      </Card>

      <H2>{t('dash.wallet.history')}</H2>
      {data.transactions.length === 0 ? <Muted>{t('dash.wallet.noHistory')}</Muted> : null}
      {data.transactions.map((tx) => {
        const out = tx.type.includes('WITHDRAW') || tx.amount < 0;
        const state = out ? withdrawalState(tx.note) : null;
        return (
          <Card key={tx.id}>
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1 gap-0.5">
                <Text className="font-bold text-ink-900 dark:text-white">{t(`dash.wallet.type.${tx.type}`)}</Text>
                <Muted>{dateTime(tx.createdAt, locale)}</Muted>
              </View>
              <Text className={`text-base font-bold ${out ? 'text-ink-900 dark:text-white' : 'text-forest dark:text-limeAccent'}`}>
                {out ? '−' : '+'} {money(Math.abs(tx.amount))}
              </Text>
            </View>
            {state ? <Badge label={t(`dash.wallet.state.${state}`)} tone={state === 'sent' ? 'good' : state === 'failed' ? 'bad' : 'warn'} /> : null}
          </Card>
        );
      })}
    </Screen>
  );
}
