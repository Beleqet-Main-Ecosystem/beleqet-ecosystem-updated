import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Screen, Card, H2, Muted, Toggle, Chips, Fact } from '../components/ui';
import { calculateTax, EMPLOYEE_PENSION, EMPLOYER_PENSION } from '../features/tax-calculate';
import { useTranslation } from '../lib/i18n';
import { useTheme } from '../lib/theme';

/** Take-home pay after income tax and pension, from the same bands as the website. */
export default function Tax() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [raw, setRaw] = useState('');
  const [pensionOn, setPensionOn] = useState(true);
  const [period, setPeriod] = useState('monthly');
  const yearly = period === 'yearly';
  const gross = Math.max(0, Number(raw.replace(/[^0-9.]/g, '')) || 0);
  const { rows, tax, pension, net, top } = calculateTax(gross, pensionOn);
  const money = (value: number) => `ETB ${Math.round(value * (yearly ? 12 : 1)).toLocaleString('en-US')}`;
  const percent = (value: number) => (gross > 0 ? `${((value / gross) * 100).toFixed(1)}%` : '0%');
  const share = (value: number) => (gross > 0 ? Math.max(0, (value / gross) * 100) : 0);
  const range = (from: number, to: number) => (to === Infinity ? t('tax.over', { amount: from.toLocaleString('en-US') }) : `${from.toLocaleString('en-US')} – ${to.toLocaleString('en-US')}`);

  return (
    <Screen title={t('tax.title')}>
      <Muted>{t('tax.sub')}</Muted>
      <Card>
        <Text className="text-sm font-bold text-ink-900 dark:text-white">{t('tax.gross')}</Text>
        <View className="min-h-14 flex-row items-center gap-2 rounded-lg border border-ink-300 bg-surface px-3.5 dark:border-slate-700 dark:bg-slate-950">
          <Text className="text-sm font-bold text-ink-500 dark:text-slate-400">ETB</Text>
          <TextInput value={raw} onChangeText={setRaw} keyboardType="decimal-pad" placeholderTextColor={colors.muted} className="flex-1 text-lg font-bold text-ink-900 dark:text-white" accessibilityLabel={t('tax.gross')} />
        </View>
        <Muted>{t('tax.grossHint')}</Muted>
        <Toggle label={t('tax.pension')} hint={t('tax.pensionHint')} value={pensionOn} onChange={setPensionOn} />
        <Muted>{t('tax.estimate')}</Muted>
      </Card>

      <Card>
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-sm font-bold text-ink-500 dark:text-slate-400">{t('tax.takeHome')}</Text>
          <Chips value={period} onChange={setPeriod} options={[{ value: 'monthly', label: t('tax.monthly') }, { value: 'yearly', label: t('tax.yearly') }]} />
        </View>
        <Text className="text-[32px] font-extrabold text-ink-900 dark:text-white">{money(net)}</Text>
        <Muted>{t(yearly ? 'tax.aYear' : 'tax.aMonth')}</Muted>
        {gross > 0 ? (
          <>
            <View className="h-3 flex-row overflow-hidden rounded-full">
              <View style={{ width: `${share(net)}%` }} className="bg-forest dark:bg-limeAccent" />
              <View style={{ width: `${share(tax)}%`, backgroundColor: '#D8A100' }} />
              <View style={{ width: `${share(pension)}%` }} className="bg-ink-400" />
            </View>
            <Fact label={t('tax.keep')} value={money(net)} />
            <Fact label={`${t('tax.incomeTax')} · ${percent(tax)}`} value={money(tax)} />
            <Fact label={`${t('tax.pensionShort')} · ${pensionOn ? `${EMPLOYEE_PENSION * 100}%` : t('tax.off')}`} value={money(pension)} />
          </>
        ) : (
          <Muted>{t('tax.enterSalary')}</Muted>
        )}
      </Card>

      <Card>
        <H2>{t('tax.howTitle')}</H2>
        <Muted>{t('tax.howText')}</Muted>
        <View className="flex-row border-b border-ink-200 pb-2 dark:border-slate-800">
          <Text className="flex-[2] text-[13px] font-bold text-ink-500 dark:text-slate-400">{t('tax.band')}</Text>
          <Text className="flex-1 text-right text-[13px] font-bold text-ink-500 dark:text-slate-400">{t('tax.rate')}</Text>
          <Text className="flex-[1.5] text-right text-[13px] font-bold text-ink-500 dark:text-slate-400">{t('tax.taxOnBand')}</Text>
        </View>
        {rows.map((row) => {
          const isTop = top && row.from === top.from;
          return (
            <View key={row.from} className={`flex-row rounded-md px-1 py-1.5 ${isTop ? 'bg-green-50 dark:bg-forest/20' : ''}`}>
              <Text className={`flex-[2] text-sm text-ink-800 dark:text-slate-200 ${isTop ? 'font-bold' : ''}`}>{range(row.from, row.to)}</Text>
              <Text className="flex-1 text-right text-sm text-ink-800 dark:text-slate-200">{`${row.rate * 100}%`}</Text>
              <Text className="flex-[1.5] text-right text-sm text-ink-800 dark:text-slate-200">{money(row.tax)}</Text>
            </View>
          );
        })}
        {top ? <Muted>{`${t('tax.topBand')} ${Math.round(top.rate * 100)}%`}</Muted> : null}
        {gross > 0 ? <Muted>{t('tax.employerPension', { amount: money(gross * EMPLOYER_PENSION) })}</Muted> : null}
      </Card>
    </Screen>
  );
}
