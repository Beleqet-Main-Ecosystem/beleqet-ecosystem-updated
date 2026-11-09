import { useState } from 'react';
import { Alert, Linking, Pressable, Share, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Bookmark, BookmarkCheck, CheckCircle2, FileText, Share2 } from 'lucide-react-native';
import { Screen, Card, H1, H2, Body, Muted, Fact, Badge, Button, Field, Failed, Loading, Notice, Avatar, Empty } from '../../components/ui';
import {
  acceptBid,
  fetchGig,
  fetchGigBids,
  fetchSavedGigIds,
  findContractId,
  rejectBid,
  saveGig,
  submitBid,
  unsaveGig,
  type GigBid,
  type GigDetail,
} from '../../api/freelance';
import { isEmployer, useAuth } from '../../store/auth.store';
import { useTranslation } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';
import { useLoad } from '../../lib/use-load';
import { errorText, toApiError } from '../../lib/api-error';
import { fileName, formatBudget, monthYear, plainText, safeHttpUrl, shortName, timeAgo, money } from '../../lib/format';
import { SITE_URL } from '../../lib/config';

/** Same 10% as PLATFORM_FEE_PCT in the escrow service. */
const PLATFORM_FEE = 0.1;

export default function GigScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const gig = useLoad(() => fetchGig(id), [id]);
  const bids = useLoad(() => fetchGigBids(id), [id, user?.id], { enabled: Boolean(user), refetchOnFocus: true });
  const hired = Boolean(bids.data?.some((bid) => bid.status === 'ACCEPTED'));
  const contract = useLoad(() => findContractId(id), [id, hired, gig.data?.open], { enabled: Boolean(user) && (hired || gig.data?.open === false) });
  const saved = useLoad(() => fetchSavedGigIds(), [user?.id], { enabled: Boolean(user) && !isEmployer(user) });
  const [savedOverride, setSavedOverride] = useState<boolean | null>(null);

  if (gig.loading) return <Screen title=""><Loading /></Screen>;
  if (gig.error || !gig.data) return <Screen title=""><Failed message={errorText(gig.error, t)} onRetry={gig.reload} /></Screen>;

  const data = gig.data;
  const isOwner = Boolean(user && user.id === data.clientId);
  const isSaved = savedOverride ?? Boolean(saved.data?.includes(id));
  const hourly = data.pricingType === 'HOURLY';
  const open = data.open && !hired;

  async function toggleSave() {
    if (!user) return router.push({ pathname: '/(auth)/login', params: { next: `/gig/${id}` } });
    const next = !isSaved;
    setSavedOverride(next);
    try {
      await (next ? saveGig(id) : unsaveGig(id));
    } catch {
      setSavedOverride(!next);
    }
  }

  const right = (
    <View className="flex-row">
      <Pressable onPress={() => Share.share({ message: `${data.title} ${SITE_URL}/freelance/${id}` })} accessibilityRole="button" accessibilityLabel={t('job.share')} className="h-11 w-11 items-center justify-center rounded-full active:bg-white/10">
        <Share2 color="#fff" size={20} />
      </Pressable>
      {!isOwner && !isEmployer(user) ? (
        <Pressable onPress={toggleSave} accessibilityRole="button" accessibilityLabel={t(isSaved ? 'freelance.unsaveProject' : 'freelance.saveProject')} className="h-11 w-11 items-center justify-center rounded-full active:bg-white/10">
          {isSaved ? <BookmarkCheck color={colors.lime} size={22} /> : <Bookmark color="#fff" size={22} />}
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <Screen title={t('m.projectTitle')} right={right} refreshing={gig.refreshing} onRefresh={() => Promise.all([gig.refresh(), user ? bids.refresh() : undefined]).then(() => undefined)}>
      <View className="flex-row flex-wrap gap-2">
        {data.funded ? <Badge label={t('freelance.funded')} tone="good" /> : null}
        <Badge label={t(hourly ? 'freelance.hourly' : 'freelance.fixed')} />
        {!open ? <Badge label={t('m.closed')} tone="bad" /> : null}
      </View>
      <H1>{data.title}</H1>
      <Muted>{[timeAgo(data.createdAt, locale), t('m.bidCount', { count: bids.data?.length ?? data.bidCount }), data.clientName].filter(Boolean).join(' · ')}</Muted>
      <Card>
        <Fact label={t('freelance.gig.budget')} value={`${formatBudget(data)}${hourly ? ` / ${t('freelance.hour')}` : ''}`} />
        <Fact label={t('freelance.gig.pricing')} value={t(hourly ? 'freelance.hourly' : 'freelance.fixed')} />
        {data.deadlineDays ? <Fact label={t('freelance.gig.delivery')} value={t('freelance.gig.within', { days: data.deadlineDays })} /> : null}
        {data.experienceLevel ? <Fact label={t('freelance.gig.experience')} value={t(`freelance.post2.levels.${data.experienceLevel}`)} /> : null}
        {data.locationPreference ? <Fact label={t('m.location')} value={data.locationPreference} /> : null}
      </Card>
      <Card>
        <H2>{t('freelance.gig.description')}</H2>
        <Body>{plainText(data.description)}</Body>
        {data.skills.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {data.skills.map((skill) => <Badge key={skill} label={skill} />)}
          </View>
        ) : null}
        {data.attachments.length > 0 ? (
          <View className="gap-1 border-t border-ink-100 pt-3 dark:border-slate-800">
            <Text className="text-sm font-bold text-ink-900 dark:text-white">{t('freelance.gig.attachments')}</Text>
            {data.attachments.map(safeHttpUrl).filter((url): url is string => Boolean(url)).map((url) => (
              <Pressable key={url} onPress={() => Linking.openURL(url)} accessibilityRole="link" className="min-h-10 flex-row items-center gap-2">
                <FileText color={colors.accent} size={18} />
                <Text className="flex-1 text-sm font-semibold text-forest dark:text-limeAccent" numberOfLines={1}>{fileName(url)}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Card>

      {isOwner ? (
        <OwnerBids gig={data} bids={bids.data ?? null} failed={Boolean(bids.error)} onRetry={bids.reload} contractId={contract.data ?? null} onChange={(next) => bids.setData(next)} onContract={() => contract.reload()} />
      ) : (
        <BidPanel gig={data} open={open} myBid={bids.data?.find((bid) => bid.freelancer.id === user?.id) ?? null} contractId={contract.data ?? null} onSent={bids.reload} />
      )}

      <Card>
        <H2>{t('freelance.gig.aboutClient')}</H2>
        <View className="flex-row items-center gap-3">
          <Avatar name={data.clientName} />
          <View className="flex-1">
            <Text className="font-bold text-ink-900 dark:text-white">{data.clientName}</Text>
            <Muted>
              {[
                data.clientMemberSince ? t('freelance.memberSince', { date: monthYear(data.clientMemberSince, locale) }) : null,
                t(data.clientCompletedContracts === 1 ? 'freelance.oneCompleted' : 'freelance.completed', { count: data.clientCompletedContracts }),
              ].filter(Boolean).join(' · ')}
            </Muted>
          </View>
        </View>
        {data.funded ? <Text className="text-sm font-bold text-forest dark:text-limeAccent">✓ {t('freelance.gig.budgetInEscrow')}</Text> : null}
      </Card>
      <View className="gap-2 rounded-xl bg-obsidian p-4">
        <Text className="text-[15px] font-bold text-limeAccent">{t('freelance.gig.protectTitle')}</Text>
        {['fund', 'submit', 'hold', 'dispute'].map((point, index) => (
          <Text key={point} className="text-sm leading-5 text-white/85">
            {index + 1}. {t(`freelance.gig.protect.${point}`)}
          </Text>
        ))}
      </View>
    </Screen>
  );
}

/** The bid form for freelancers and job seekers, or what became of their bid. */
function BidPanel({ gig, open, myBid, contractId, onSent }: { gig: GigDetail; open: boolean; myBid: GigBid | null; contractId: string | null; onSent: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const [amount, setAmount] = useState('');
  const [days, setDays] = useState(gig.deadlineDays ? String(gig.deadlineDays) : '');
  const [letter, setLetter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cur = gig.currency;

  if (myBid) {
    const accepted = myBid.status === 'ACCEPTED';
    const rejected = myBid.status === 'REJECTED';
    return (
      <Card>
        <CheckCircle2 color={colors.accent} size={28} />
        <H2>{`${t(accepted ? 'freelance.gig.bidAccepted' : rejected ? 'freelance.gig.bidDeclined' : 'freelance.gig.bidSent')} · ${money(myBid.amount, cur)}`}</H2>
        {!accepted && !rejected ? <Muted>{t('freelance.gig.bidSentText')}</Muted> : null}
        {accepted && contractId ? (
          <Button label={t('freelance.gig.openContract')} onPress={() => router.push(`/contract/${contractId}`)} />
        ) : (
          <Button label={t('freelance.gig.myBids')} variant="outline" onPress={() => router.push('/bids')} />
        )}
      </Card>
    );
  }
  if (!open) {
    return (
      <Card>
        <H2>{t('freelance.gig.closedTitle')}</H2>
        <Muted>{t('freelance.gig.closedText')}</Muted>
      </Card>
    );
  }
  if (!user) {
    return (
      <Card>
        <H2>{t('freelance.gig.placeBid')}</H2>
        <Muted>{t('freelance.gig.signInText')}</Muted>
        <Button label={t('freelance.gig.signIn')} onPress={() => router.push({ pathname: '/(auth)/login', params: { next: `/gig/${gig.id}` } })} />
      </Card>
    );
  }
  if (isEmployer(user)) {
    return (
      <Card>
        <H2>{t('freelance.gig.placeBid')}</H2>
        <Muted>{t('freelance.gig.employerCantBid')}</Muted>
      </Card>
    );
  }

  const price = Number(amount);
  const validPrice = Number.isFinite(price) && price >= 1;
  const fee = validPrice ? Math.round(price * PLATFORM_FEE) : 0;
  const outside = validPrice && gig.budgetMax > 0 ? (price > gig.budgetMax ? 'aboveBudget' : price < gig.budgetMin ? 'belowBudget' : null) : null;

  async function send() {
    setError('');
    if (!validPrice || !(Number(days) >= 1) || !letter.trim()) {
      setError(t('freelance.gig.formInvalid'));
      return;
    }
    setBusy(true);
    try {
      await submitBid(gig.id, { amount: Math.round(price), timelineDays: Math.round(Number(days)), coverLetter: letter.trim() });
      onSent();
    } catch (failure) {
      const status = toApiError(failure).status;
      if (status === 409) onSent();
      else if (status === 404) setError(t('freelance.gig.bidClosed'));
      else setError(errorText(failure, t, 'freelance.gig.bidFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <H2>{t('freelance.gig.placeBid')}</H2>
      <Field label={t('freelance.gig.yourPrice', { currency: cur })} value={amount} onChangeText={(value) => setAmount(value.replace(/[^\d]/g, ''))} keyboardType="number-pad" hint={t('freelance.gig.clientBudget', { budget: formatBudget(gig) })} />
      {outside ? <Text className="text-[13px] font-semibold text-warn dark:text-amber-300">{t(`freelance.gig.${outside}`)}</Text> : null}
      {validPrice ? (
        <View className="gap-2 rounded-lg bg-ink-100 p-3 dark:bg-slate-800">
          <Fact label={t('freelance.gig.clientPays')} value={money(price, cur)} />
          <Fact label={t('freelance.gig.fee')} value={`− ${money(fee, cur)}`} />
          <Fact label={t('freelance.gig.youReceive')} value={money(price - fee, cur)} tone="text-forest dark:text-limeAccent" />
        </View>
      ) : null}
      <Field label={t('freelance.gig.deliveryDays')} value={days} onChangeText={(value) => setDays(value.replace(/[^\d]/g, ''))} keyboardType="number-pad" />
      <Field label={t('freelance.gig.coverLetter')} value={letter} onChangeText={setLetter} multiline placeholder={t('freelance.gig.coverPlaceholder')} />
      {error ? <Notice tone="bad" text={error} /> : null}
      <Button label={busy ? t('freelance.gig.sending') : t('freelance.gig.submitBid')} onPress={send} busy={busy} />
      <Muted>{t('freelance.gig.payNote')}</Muted>
    </Card>
  );
}

/** The project owner's view: every bid, with accept and decline. */
function OwnerBids({ gig, bids, failed, onRetry, contractId, onChange, onContract }: { gig: GigDetail; bids: GigBid[] | null; failed: boolean; onRetry: () => void; contractId: string | null; onChange: (bids: GigBid[]) => void; onContract: () => void }) {
  const { t, locale } = useTranslation();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  if (failed) return <Failed message={t('freelance.gig.bidsFailed')} onRetry={onRetry} />;
  if (!bids) return <Loading />;

  const accepted = bids.find((bid) => bid.status === 'ACCEPTED');

  async function decline(bid: GigBid) {
    setWorking(true);
    setError('');
    try {
      await rejectBid(bid.id);
      onChange(bids!.map((item) => (item.id === bid.id ? { ...item, status: 'REJECTED' } : item)));
    } catch (failure) {
      setError(errorText(failure, t, 'freelance.gig.actionFailed'));
    } finally {
      setWorking(false);
    }
  }

  function confirmAccept(bid: GigBid) {
    const name = shortName(bid.freelancer);
    Alert.alert(t('freelance.gig.confirmTitle', { name }), t('freelance.gig.confirmText', { amount: money(bid.amount, gig.currency) }), [
      { text: t('freelance.gig.cancel'), style: 'cancel' },
      {
        text: t('freelance.gig.confirmAccept'),
        onPress: async () => {
          setWorking(true);
          setError('');
          try {
            const contract = await acceptBid(bid.id);
            onChange(bids!.map((item) => ({ ...item, status: item.id === bid.id ? 'ACCEPTED' : item.status === 'PENDING' ? 'REJECTED' : item.status })));
            setNote(t('freelance.gig.acceptedNote', { name }));
            onContract();
            router.push(`/contract/${contract.id}`);
          } catch (failure) {
            setError(errorText(failure, t, 'freelance.gig.actionFailed'));
          } finally {
            setWorking(false);
          }
        },
      },
    ]);
  }

  return (
    <View className="gap-3">
      <H2>{t('freelance.gig.bidsReceived', { count: bids.length })}</H2>
      {note ? <Notice tone="good" text={note} /> : null}
      {error ? <Notice tone="bad" text={error} /> : null}
      {accepted && contractId ? <Button label={t('freelance.gig.openContract')} onPress={() => router.push(`/contract/${contractId}`)} /> : null}
      {bids.length === 0 ? <Empty title={t('freelance.gig.noBids')} /> : null}
      {bids.map((bid) => {
        const name = `${bid.freelancer.firstName} ${bid.freelancer.lastName}`;
        const portfolio = safeHttpUrl(bid.freelancer.portfolioUrl);
        return (
          <Card key={bid.id}>
            <View className="flex-row items-center gap-3">
              <Avatar name={name} />
              <View className="flex-1">
                <Text className="font-bold text-ink-900 dark:text-white">{shortName(bid.freelancer)}</Text>
                <Muted>
                  {[
                    bid.freelancer.memberSince ? t('freelance.memberSince', { date: monthYear(bid.freelancer.memberSince, locale) }) : null,
                    t((bid.freelancer.completedContracts ?? 0) === 1 ? 'freelance.oneCompleted' : 'freelance.completed', { count: bid.freelancer.completedContracts ?? 0 }),
                  ].filter(Boolean).join(' · ')}
                </Muted>
              </View>
              <View className="items-end">
                <Text className="text-base font-bold text-ink-900 dark:text-white">{money(bid.amount, gig.currency)}</Text>
                <Muted>{t('freelance.gig.days', { days: bid.timelineDays })}</Muted>
              </View>
            </View>
            <Body>{bid.coverLetter}</Body>
            {portfolio ? <Button label={t('freelance.viewPortfolio')} variant="ghost" small onPress={() => Linking.openURL(portfolio)} /> : null}
            {bid.status === 'PENDING' && !accepted ? (
              <View className="flex-row gap-2">
                <Button className="flex-1" label={t('freelance.gig.decline')} variant="outline" disabled={working} onPress={() => decline(bid)} />
                <Button className="flex-1" label={t('freelance.gig.accept')} disabled={working} onPress={() => confirmAccept(bid)} />
              </View>
            ) : (
              <Badge label={t(`dash.bidStatus.${bid.status}`)} tone={bid.status === 'ACCEPTED' ? 'good' : bid.status === 'REJECTED' ? 'bad' : 'neutral'} />
            )}
          </Card>
        );
      })}
    </View>
  );
}
