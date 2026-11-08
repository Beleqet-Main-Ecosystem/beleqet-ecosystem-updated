import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Card, Muted, Badge, Button, Field, Notice, Empty, Failed, Loading, Body } from '../components/ui';
import { fetchInterviews, respondToInterview, updateInterview, type Interview } from '../api/interviews';
import { startChat } from '../api/chat';
import { isEmployer, useAuth } from '../store/auth.store';
import { useTranslation } from '../lib/i18n';
import { useLoad } from '../lib/use-load';
import { errorText } from '../lib/api-error';
import { safeHttpUrl } from '../lib/format';

const TONE: Record<Interview['status'], 'warn' | 'good' | 'bad' | 'neutral'> = {
  SCHEDULED: 'warn',
  RESCHEDULED: 'warn',
  CONFIRMED: 'good',
  DECLINED: 'bad',
  COMPLETED: 'neutral',
  CANCELLED: 'neutral',
};

function whenText(iso: string, locale: string) {
  try {
    return new Date(iso).toLocaleString(locale === 'am' ? 'am-ET' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return new Date(iso).toISOString().replace('T', ' ').slice(0, 16);
  }
}

/** Candidates see and answer their interviews; employers set where and how they happen. */
export default function Interviews() {
  const { t, locale } = useTranslation();
  const me = useAuth((s) => s.user);
  const employer = isEmployer(me);
  const rows = useLoad(fetchInterviews, [], { refetchOnFocus: true });
  const [error, setError] = useState('');

  if (rows.loading) return <Screen title={t('dash.tabs.interviews')}><Loading /></Screen>;
  if (rows.error || !rows.data) return <Screen title={t('dash.tabs.interviews')}><Failed message={errorText(rows.error, t)} onRetry={rows.reload} /></Screen>;

  const mine = rows.data.filter((row) => (employer ? row.employerId === me?.id : row.candidateId === me?.id)).sort((a, b) => b.startTime.localeCompare(a.startTime));
  const replace = (updated: Interview) => rows.setData((list) => (list ?? []).map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));

  return (
    <Screen title={employer ? t('emp.interviewsTitle') : t('dash.tabs.interviews')} refreshing={rows.refreshing} onRefresh={rows.refresh}>
      {!employer ? <Muted>{t('dash.interviewsSub')}</Muted> : null}
      {error ? <Notice tone="bad" text={error} /> : null}
      {mine.length === 0 ? <Empty title={t('dash.noInterviews')} text={t('dash.noInterviewsText')} /> : null}
      {mine.map((row) =>
        employer ? <EmployerRow key={row.id} row={row} onSaved={replace} onError={setError} locale={locale} /> : <CandidateRow key={row.id} row={row} onAnswered={replace} onError={setError} locale={locale} />,
      )}
    </Screen>
  );
}

function CandidateRow({ row, onAnswered, onError, locale }: { row: Interview; onAnswered: (row: Interview) => void; onError: (message: string) => void; locale: string }) {
  const { t } = useTranslation();
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const link = safeHttpUrl(row.meetingLink);
  const canAnswer = new Date(row.startTime) > new Date() && ['SCHEDULED', 'RESCHEDULED', 'CONFIRMED'].includes(row.status);
  const employerId = row.application.job.company?.userId ?? row.employerId;

  async function respond(response: 'CONFIRMED' | 'DECLINED') {
    setBusy(true);
    onError('');
    try {
      const updated = await respondToInterview(row.id, response, note.trim() || undefined);
      onAnswered({ ...row, status: updated.status, candidateNote: updated.candidateNote });
      setDeclining(false);
      setNote('');
    } catch (failure) {
      onError(errorText(failure, t, 'dash.interview.answerFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <View className="flex-row items-start gap-3">
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-bold text-ink-900 dark:text-white">{row.application.job.title}</Text>
          <Muted>{row.application.job.company?.name ?? ''}</Muted>
        </View>
        <Badge label={t(`dash.interview.status.${row.status}`)} tone={TONE[row.status]} />
      </View>
      <Text className="text-[15px] font-semibold text-ink-900 dark:text-white">{whenText(row.startTime, locale)}</Text>
      {row.location ? <Muted>{`${t('dash.interview.where')}: ${row.location}`}</Muted> : null}
      {link ? <Button small variant="outline" label={t('dash.interview.link')} onPress={() => Linking.openURL(link)} /> : null}
      {row.notes ? <Body>{row.notes}</Body> : null}
      {canAnswer && !declining ? (
        <View className="flex-row gap-2">
          {row.status !== 'CONFIRMED' ? <Button className="flex-1" small label={t('dash.interview.confirm')} busy={busy} onPress={() => respond('CONFIRMED')} /> : null}
          <Button className="flex-1" small variant="outline" label={t('dash.interview.decline')} onPress={() => setDeclining(true)} />
        </View>
      ) : null}
      {declining ? (
        <>
          <Field label={t('dash.interview.declineNote')} value={note} onChangeText={setNote} multiline />
          <View className="flex-row gap-2">
            <Button className="flex-1" small variant="outline" label={t('postJob.cancel')} onPress={() => setDeclining(false)} />
            <Button className="flex-1" small variant="danger" label={t('dash.interview.sendDecline')} busy={busy} onPress={() => respond('DECLINED')} />
          </View>
        </>
      ) : null}
      {employerId ? (
        <Button
          small
          variant="ghost"
          label={t('dash.messageEmployer')}
          onPress={async () => {
            try {
              const room = await startChat(employerId);
              router.push(`/chat/${room.id}`);
            } catch (failure) {
              onError(errorText(failure, t, 'chat.startFailed'));
            }
          }}
        />
      ) : null}
    </Card>
  );
}

function EmployerRow({ row, onSaved, onError, locale }: { row: Interview; onSaved: (row: Interview) => void; onError: (message: string) => void; locale: string }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ location: row.location ?? '', meetingLink: row.meetingLink ?? '', notes: row.notes ?? '' });
  const [busy, setBusy] = useState(false);
  const name = row.candidate ? `${row.candidate.firstName} ${row.candidate.lastName}` : '';

  async function save() {
    onError('');
    if (draft.meetingLink.trim() && !safeHttpUrl(draft.meetingLink)) return onError(t('postJob.errUrl'));
    setBusy(true);
    try {
      const updated = await updateInterview(row.id, { location: draft.location.trim(), meetingLink: draft.meetingLink.trim(), notes: draft.notes.trim() });
      onSaved(updated);
      setEditing(false);
    } catch (failure) {
      onError(errorText(failure, t, 'dash.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <View className="flex-row items-start gap-3">
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-bold text-ink-900 dark:text-white">{name}</Text>
          <Muted>{row.application.job.title}</Muted>
        </View>
        <Badge label={t(`dash.interview.status.${row.status}`)} tone={TONE[row.status]} />
      </View>
      <Text className="text-[15px] font-semibold text-ink-900 dark:text-white">{whenText(row.startTime, locale)}</Text>
      {row.candidateNote ? <Body>{row.candidateNote}</Body> : null}
      {editing ? (
        <>
          <Field label={t('dash.interview.where')} value={draft.location} onChangeText={(location) => setDraft({ ...draft, location })} />
          <Field label={t('dash.interview.link')} value={draft.meetingLink} onChangeText={(meetingLink) => setDraft({ ...draft, meetingLink })} autoCapitalize="none" keyboardType="url" placeholder="https://" />
          <Field label={t('dash.interview.notes')} value={draft.notes} onChangeText={(notes) => setDraft({ ...draft, notes })} multiline />
          <View className="flex-row gap-2">
            <Button className="flex-1" small variant="outline" label={t('postJob.cancel')} onPress={() => setEditing(false)} />
            <Button className="flex-1" small label={t('postJob.save')} busy={busy} onPress={save} />
          </View>
        </>
      ) : (
        <>
          <Muted>{[row.location, safeHttpUrl(row.meetingLink) ? t('dash.interview.hasLink') : null].filter(Boolean).join(' · ') || t('emp.noPlaceYet')}</Muted>
          <Button small variant="outline" label={t('emp.setDetails')} onPress={() => setEditing(true)} />
        </>
      )}
    </Card>
  );
}
