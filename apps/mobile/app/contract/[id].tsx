import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { FileText, MessageSquare } from 'lucide-react-native';
import { Screen, Card, H1, H2, Body, Muted, Fact, Badge, Button, Field, DateField, Failed, Loading, Notice, Progress, Sheet } from '../../components/ui';
import {
  acceptMilestone,
  addMilestone,
  declineMilestone,
  fetchContract,
  fundEscrow,
  raiseDispute,
  releaseMilestone,
  requestRevision,
  submitWork,
  type Contract,
  type ContractEvent,
  type Milestone,
} from '../../api/freelance';
import { startChat } from '../../api/chat';
import { uploadFile, type PickedFile } from '../../lib/api';
import { useAuth } from '../../store/auth.store';
import { useTranslation } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';
import { useLoad } from '../../lib/use-load';
import { errorText } from '../../lib/api-error';
import { fullDate, money as fmt, safeHttpUrl, shortName } from '../../lib/format';
import { openCheckout, pollUntil } from '../../lib/checkout';

const FEE = 0.1;
const MIN_DISPUTE = 20;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

type Dialog =
  | { kind: 'add'; left: number }
  | { kind: 'submit'; milestone: Milestone; number: number }
  | { kind: 'revision'; milestone: Milestone }
  | { kind: 'release'; milestone: Milestone }
  | { kind: 'dispute' };

const BADGE: Record<string, 'neutral' | 'good' | 'warn' | 'bad' | 'info'> = {
  PROPOSED: 'info',
  PENDING: 'neutral',
  IN_PROGRESS: 'neutral',
  SUBMITTED: 'warn',
  REVISION_REQUESTED: 'bad',
  APPROVED: 'good',
};

/** Same rules as the website's ContractWorkspace: who can do what, and when. */
export default function ContractScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useTranslation();
  const user = useAuth((s) => s.user);
  const load = useLoad(() => fetchContract(id), [id], { refetchOnFocus: true });
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [funding, setFunding] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  if (load.loading) return <Screen title={t('freelance.contract.contracts')}><Loading /></Screen>;
  if (load.error || !load.data || !user) return <Screen title={t('freelance.contract.contracts')}><Failed message={errorText(load.error, t)} onRetry={load.reload} /></Screen>;

  const contract = load.data;
  const isClient = user.id === contract.clientId;
  const other = isClient ? contract.freelancer : contract.client;
  const escrow = contract.freelanceJob.escrowTx;
  const disputed = contract.status === 'DISPUTED';
  const funded = escrow?.status === 'FUNDED';
  const moneyIn = funded || disputed;
  const active = contract.status === 'ACTIVE';
  const money = (value: number) => fmt(value, contract.currency);
  const released = contract.milestones.filter((item) => item.status === 'APPROVED').reduce((sum, item) => sum + item.amount, 0);
  const planned = contract.milestones.reduce((sum, item) => sum + item.amount, 0);
  const shownReleased = moneyIn ? released : 0;
  const percent = Math.min(100, Math.round((shownReleased / Math.max(1, contract.agreedAmount)) * 100));

  async function act(run: () => Promise<unknown>, done?: string) {
    setError('');
    setNote('');
    try {
      await run();
      if (done) setNote(done);
      await load.reload();
    } catch (failure) {
      setError(errorText(failure, t, 'freelance.gig.actionFailed'));
    }
  }

  async function fund() {
    setFunding(true);
    setError('');
    try {
      const { checkoutUrl } = await fundEscrow(contract.freelanceJobId);
      if (checkoutUrl) {
        await openCheckout(checkoutUrl);
        // Chapa tells the API; wait for it, as the website's return page does.
        const paid = await pollUntil(async () => (await fetchContract(id)).freelanceJob.escrowTx?.status === 'FUNDED');
        if (!paid) setNote(t('m.contract.paymentPending'));
      }
      await load.reload();
    } catch (failure) {
      setError(errorText(failure, t, 'freelance.contract.fundFailed'));
    } finally {
      setFunding(false);
    }
  }

  async function message() {
    try {
      const room = await startChat(other.id);
      router.push(`/chat/${room.id}`);
    } catch (failure) {
      setError(errorText(failure, t, 'chat.startFailed'));
    }
  }

  const activity = buildActivity(contract, t, money);

  return (
    <Screen
      title={contract.freelanceJob.title}
      refreshing={load.refreshing}
      onRefresh={load.refresh}
      right={
        <Pressable onPress={message} accessibilityRole="button" accessibilityLabel={t('freelance.contract.chat')} className="h-11 w-11 items-center justify-center rounded-full active:bg-white/10">
          <MessageSquare color="#fff" size={20} />
        </Pressable>
      }
    >
      <View className="gap-1">
        <H1>{contract.freelanceJob.title}</H1>
        <Muted>{t('freelance.contract.parties', { client: shortName(contract.client), freelancer: shortName(contract.freelancer), date: fullDate(contract.startedAt, locale) })}</Muted>
        <Badge label={t(`freelance.contract.status.${contract.status}`)} tone={disputed ? 'bad' : active ? 'good' : 'neutral'} />
      </View>

      {active && !funded ? (
        <View className="gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <Text className="text-base font-bold text-amber-900 dark:text-amber-100">{t(isClient ? 'freelance.contract.fundTitle' : 'freelance.contract.waitTitle')}</Text>
          <Text className="text-sm leading-5 text-amber-900 dark:text-amber-200">{t(isClient ? 'freelance.contract.fundText' : 'freelance.contract.waitText', { amount: money(contract.agreedAmount), name: shortName(other) })}</Text>
          {isClient ? <Button label={funding ? t('freelance.contract.funding') : t('freelance.contract.fund', { amount: money(contract.agreedAmount) })} onPress={fund} busy={funding} /> : null}
        </View>
      ) : null}
      {disputed ? <Notice tone="bad" text={`${t('freelance.contract.disputeTitle')}. ${t('freelance.contract.disputeText')}`} /> : null}
      {error ? <Notice tone="bad" text={error} /> : null}
      {note ? <Notice tone="good" text={note} /> : null}

      <Card>
        <View className="flex-row flex-wrap gap-y-3">
          {[
            [t('freelance.contract.value'), money(contract.agreedAmount)],
            [t('freelance.contract.inEscrow'), money(moneyIn ? contract.agreedAmount - released : 0)],
            [t('freelance.contract.released'), money(shownReleased)],
            [t('freelance.contract.fee'), money(Math.round(shownReleased * FEE))],
          ].map(([key, value]) => (
            <View key={key} className="w-1/2 gap-0.5">
              <Muted>{key}</Muted>
              <Text className="text-lg font-extrabold text-ink-900 dark:text-white">{value}</Text>
            </View>
          ))}
        </View>
        <Progress value={percent} />
        <Muted>{t('freelance.contract.feeNote')}</Muted>
      </Card>

      <View className="flex-row items-end justify-between gap-3">
        <View className="flex-1">
          <H2>{t('freelance.contract.milestones')}</H2>
          <Muted>{t('freelance.contract.planned', { planned: money(planned), total: money(contract.agreedAmount) })}</Muted>
        </View>
        {!isClient && funded && planned < contract.agreedAmount ? (
          <Button small variant="outline" label={`+ ${t('freelance.contract.addMilestone')}`} onPress={() => setDialog({ kind: 'add', left: contract.agreedAmount - planned })} />
        ) : null}
      </View>
      {contract.milestones.length === 0 ? <Card><Muted>{t(isClient ? 'freelance.contract.noMilestonesClient' : 'freelance.contract.noMilestones')}</Muted></Card> : null}
      {contract.milestones.map((item, index) => {
        const waitingOnClient = item.status === 'SUBMITTED';
        const work = item.deliverables?.[item.deliverables.length - 1];
        const link = safeHttpUrl(work?.fileUrl);
        return (
          <Card key={item.id} className={waitingOnClient || item.status === 'REVISION_REQUESTED' ? 'border-lime-400 dark:border-limeAccent/40' : ''}>
            <View className="flex-row items-start gap-3">
              <View className={`h-9 w-9 items-center justify-center rounded-full ${item.status === 'APPROVED' ? 'bg-forest' : 'bg-obsidian'}`}>
                <Text className={`text-sm font-extrabold ${item.status === 'APPROVED' ? 'text-white' : 'text-limeAccent'}`}>{index + 1}</Text>
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-base font-bold text-ink-900 dark:text-white">{item.title}</Text>
                <Muted>{t('freelance.contract.due', { date: fullDate(item.deadline, locale) })}</Muted>
              </View>
              <View className="items-end gap-1">
                <Text className="text-base font-bold text-ink-900 dark:text-white">{money(item.amount)}</Text>
                <Badge label={t(`freelance.contract.badge.${item.status}`)} tone={BADGE[item.status] ?? 'neutral'} />
              </View>
            </View>
            {work && waitingOnClient ? (
              <View className="gap-1 rounded-lg bg-canvas p-3 dark:bg-slate-800">
                <Text className="text-[13px] font-bold text-ink-500 dark:text-slate-300">{t('freelance.contract.submitted')}</Text>
                {link ? (
                  <Pressable onPress={() => Linking.openURL(link)} accessibilityRole="link">
                    <Text className="text-sm font-semibold text-forest dark:text-limeAccent">{link} ↗</Text>
                  </Pressable>
                ) : null}
                {work.notes ? <Body>{work.notes}</Body> : null}
              </View>
            ) : null}
            {item.status === 'REVISION_REQUESTED' && item.revisionNote ? (
              <View className="gap-1 rounded-lg bg-red-50 p-3 dark:bg-red-950">
                <Text className="text-[13px] font-bold text-red-800 dark:text-red-200">{t('freelance.contract.revisionAsked')}</Text>
                <Body>{item.revisionNote}</Body>
              </View>
            ) : null}
            {item.approvedAt ? <Muted>{t('freelance.contract.approvedNote', { date: fullDate(item.approvedAt, locale), amount: money(Math.round(item.amount * (1 - FEE))) })}</Muted> : null}
            {waitingOnClient && !isClient ? <Muted>{t('freelance.contract.waitingReview')}</Muted> : null}
            {isClient && funded && waitingOnClient ? (
              <View className="flex-row gap-2">
                <Button className="flex-1" small variant="outline" label={t('freelance.contract.requestRevision')} onPress={() => setDialog({ kind: 'revision', milestone: item })} />
                <Button className="flex-1" small label={t('freelance.contract.approve', { amount: money(item.amount) })} onPress={() => setDialog({ kind: 'release', milestone: item })} />
              </View>
            ) : null}
            {item.status === 'PROPOSED' && !isClient ? <Muted>{t('freelance.contract.waitingAccept', { name: shortName(contract.client) })}</Muted> : null}
            {item.status === 'PROPOSED' && isClient ? (
              <>
                <Muted>{t('freelance.contract.proposedText')}</Muted>
                <View className="flex-row gap-2">
                  <Button className="flex-1" small variant="outline" label={t('freelance.contract.declineMilestone')} onPress={() => act(() => declineMilestone(item.id))} />
                  <Button className="flex-1" small label={t('freelance.contract.acceptMilestone')} onPress={() => act(() => acceptMilestone(item.id))} />
                </View>
              </>
            ) : null}
            {!isClient && funded && !waitingOnClient && item.status !== 'APPROVED' && item.status !== 'PROPOSED' ? (
              <Button small label={t('freelance.contract.submitWork')} onPress={() => setDialog({ kind: 'submit', milestone: item, number: index + 1 })} />
            ) : null}
          </Card>
        );
      })}

      <Card>
        <H2>{t('freelance.contract.activity')}</H2>
        {activity.map((entry, index) => (
          <View key={`${entry.at}-${index}`} className="gap-0.5 border-t border-ink-100 py-2 dark:border-slate-800">
            <Text className="text-sm text-ink-800 dark:text-slate-200">{entry.text}</Text>
            <Muted>{fullDate(entry.at, locale)}</Muted>
          </View>
        ))}
      </Card>

      {active ? (
        <Card>
          <H2>{t('freelance.contract.wrongTitle')}</H2>
          <Muted>{t('freelance.contract.wrongText')}</Muted>
          <Button variant="danger" label={t('freelance.contract.openDispute')} onPress={() => setDialog({ kind: 'dispute' })} />
        </Card>
      ) : null}

      <MilestoneSheet
        dialog={dialog}
        contract={contract}
        onClose={() => setDialog(null)}
        onDone={async (message) => {
          setDialog(null);
          setNote(message);
          await load.reload();
        }}
      />
    </Screen>
  );
}

function buildActivity(contract: Contract, t: (key: string, vars?: Record<string, string | number>) => string, money: (value: number) => string) {
  const escrow = contract.freelanceJob.escrowTx;
  const logText = (event: ContractEvent): string | null => {
    const title = event.milestone ?? '';
    switch (event.type) {
      case 'milestone.proposed': return t('freelance.contract.logProposed', { title });
      case 'milestone.accepted': return t('freelance.contract.logAccepted', { title });
      case 'milestone.submitted': return t('freelance.contract.logSubmitted', { title });
      case 'milestone.revision_requested': return t('freelance.contract.logRevision', { title });
      case 'milestone.approved':
      case 'milestone.dual_confirmed': return t('freelance.contract.logApproved', { title });
      case 'escrow.funded': return escrow ? t('freelance.contract.logFunded', { amount: money(escrow.grossAmount) }) : null;
      case 'dispute.raised': return t('freelance.contract.logDisputed');
      case 'dispute.resolved': return t('freelance.contract.logResolved');
      default: return null;
    }
  };
  return [
    { text: t('freelance.contract.logCreated', { name: shortName(contract.freelancer) }), at: contract.startedAt },
    ...(contract.activity ?? []).map((event) => {
      const text = logText(event);
      return text ? { text, at: event.at } : null;
    }),
  ]
    .filter((item): item is { text: string; at: string } => Boolean(item))
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** Add a milestone, submit work, ask for a revision, release payment, or open a dispute. */
function MilestoneSheet({ dialog, contract, onClose, onDone }: { dialog: Dialog | null; contract: Contract; onClose: () => void; onDone: (message: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const money = (value: number) => fmt(value, contract.currency);

  function close() {
    setText('');
    setLink('');
    setFile(null);
    setTitle('');
    setAmount('');
    setDeadline('');
    setError('');
    onClose();
  }

  if (!dialog) return null;

  const heading =
    dialog.kind === 'release' ? t('freelance.contract.releaseTitle')
    : dialog.kind === 'revision' ? t('freelance.contract.revisionTitle')
    : dialog.kind === 'submit' ? t('freelance.contract.submitTitle', { number: dialog.number })
    : dialog.kind === 'dispute' ? t('freelance.contract.wrongTitle')
    : t('freelance.contract.addMilestone');
  const confirm =
    dialog.kind === 'release' ? t('freelance.contract.releaseConfirm', { amount: money(dialog.milestone.amount) })
    : dialog.kind === 'revision' ? t('freelance.contract.sendRequest')
    : dialog.kind === 'submit' ? t('freelance.contract.submitConfirm')
    : dialog.kind === 'dispute' ? t('freelance.contract.submitDispute')
    : t('freelance.contract.addConfirm');

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if ((asset.size ?? 0) > MAX_FILE_BYTES) return setError(t('freelance.post2.fileTooBig'));
    setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size });
  }

  async function submit() {
    if (!dialog) return;
    setError('');
    if (dialog.kind === 'revision' && !text.trim()) return setError(t('freelance.contract.errRevision'));
    if (dialog.kind === 'dispute' && text.trim().length < MIN_DISPUTE) return setError(t('freelance.contract.min20'));
    if (dialog.kind === 'submit') {
      if (!text.trim()) return setError(t('freelance.contract.errNotes'));
      if (link.trim() && !safeHttpUrl(link)) return setError(t('job.apply.portfolioInvalid'));
    }
    const value = Number(amount);
    if (dialog.kind === 'add') {
      if (title.trim().length < 3 || !deadline) return setError(t('freelance.contract.errMilestone'));
      if (!(value >= 1) || value > dialog.left) return setError(t('freelance.contract.errAmount', { left: money(dialog.left) }));
    }
    setBusy(true);
    try {
      if (dialog.kind === 'release') await releaseMilestone(dialog.milestone.id);
      else if (dialog.kind === 'revision') await requestRevision(dialog.milestone.id, text.trim());
      else if (dialog.kind === 'dispute') await raiseDispute(contract.id, text.trim());
      else if (dialog.kind === 'submit') {
        const fileUrl = file ? await uploadFile(file) : safeHttpUrl(link) ?? undefined;
        await submitWork(dialog.milestone.id, { fileUrl, notes: text.trim() });
      } else {
        await addMilestone(contract.id, { title: title.trim(), amount: Math.round(value), deadline: new Date(`${deadline}T12:00:00`).toISOString() });
      }
      const done = { release: 'm.contract.released', revision: 'm.contract.revisionSent', dispute: 'm.contract.disputeOpened', submit: 'm.contract.workSent', add: 'm.contract.milestoneAdded' }[dialog.kind];
      close();
      onDone(t(done));
    } catch (failure) {
      setError(errorText(failure, t, 'freelance.gig.actionFailed'));
    } finally {
      setBusy(false);
    }
  }

  const tomorrow = new Date(Date.now() + 86400000);
  return (
    <Sheet visible title={heading} onClose={close}>
      <View className="gap-4 p-4">
        {dialog.kind === 'release' ? (
          <>
            <View className="gap-2 rounded-lg bg-ink-100 p-3 dark:bg-slate-800">
              <Fact label={t('freelance.contract.releasedFrom')} value={money(dialog.milestone.amount)} />
              <Fact label={t('freelance.gig.fee')} value={`− ${money(Math.round(dialog.milestone.amount * FEE))}`} />
              <Fact label={t('freelance.contract.receives', { name: shortName(contract.freelancer) })} value={money(Math.round(dialog.milestone.amount * (1 - FEE)))} tone="text-forest dark:text-limeAccent" />
            </View>
            <Muted>{t('freelance.contract.releaseNote')}</Muted>
          </>
        ) : null}
        {dialog.kind === 'revision' ? <Field label={t('freelance.contract.whatChange')} value={text} onChangeText={setText} multiline maxLength={2000} /> : null}
        {dialog.kind === 'dispute' ? (
          <>
            <Muted>{t('freelance.contract.wrongText')}</Muted>
            <Field label={t('freelance.contract.whatWrong')} value={text} onChangeText={setText} multiline placeholder={t('freelance.contract.min20')} />
          </>
        ) : null}
        {dialog.kind === 'submit' ? (
          <>
            <Field label={t('freelance.contract.workLink')} value={link} onChangeText={setLink} autoCapitalize="none" keyboardType="url" />
            <Button variant="outline" label={file ? file.name : t('freelance.contract.workFile')} icon={<FileText color={colors.text} size={18} />} onPress={pickFile} />
            <Field label={t('freelance.contract.notes')} value={text} onChangeText={setText} multiline />
          </>
        ) : null}
        {dialog.kind === 'add' ? (
          <>
            <Field label={t('freelance.contract.milestoneTitle')} value={title} onChangeText={setTitle} />
            <Field label={t('freelance.contract.amount', { currency: contract.currency })} value={amount} onChangeText={(value) => setAmount(value.replace(/\D/g, ''))} keyboardType="number-pad" hint={t('freelance.contract.left', { left: money(dialog.left) })} />
            <DateField label={t('freelance.contract.dueDate')} value={deadline} onChange={setDeadline} minimumDate={tomorrow} />
          </>
        ) : null}
        {error ? <Notice tone="bad" text={error} /> : null}
        <View className="flex-row gap-3">
          <Button className="flex-1" variant="outline" label={t('freelance.gig.cancel')} onPress={close} />
          <Button className="flex-1" variant={dialog.kind === 'dispute' ? 'danger' : 'solid'} label={confirm} onPress={submit} busy={busy} />
        </View>
      </View>
    </Sheet>
  );
}
