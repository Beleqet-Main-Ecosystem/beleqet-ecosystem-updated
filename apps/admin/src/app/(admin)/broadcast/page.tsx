'use client';

import { useState } from 'react';
import { Dialog, Field, Heading, Notice, Segmented, card, input, muted, solid, useAction, useDebounced, useResource } from '@/components/ui';
import { api, query } from '@/lib/api';
import { fullName } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

type Audience = 'all' | 'role' | 'people';
type Person = { id: string; firstName: string; lastName: string; email: string };
const ROLES = ['JOB_SEEKER', 'EMPLOYER', 'FREELANCER', 'ADMIN'] as const;

/** An in-app notification to everyone, one role, or chosen people. */
export default function BroadcastPage() {
  const { t } = useI18n();
  const [audience, setAudience] = useState<Audience>('all');
  const [role, setRole] = useState<string>('JOB_SEEKER');
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [confirming, setConfirming] = useState(false);
  const action = useAction();
  const settled = useDebounced(search.trim());

  const matches = useResource(
    (signal) => (settled.length < 2 ? Promise.resolve({ data: [] as Person[] }) : api<{ data: Person[] }>(`/admin/users${query({ search: settled, status: 'active', limit: 8 })}`, { signal })),
    settled,
  );

  const valid = title.trim().length >= 3 && body.trim().length >= 5 && (audience !== 'people' || people.length > 0);
  const who = audience === 'all' ? t('broadcast.everyone') : audience === 'role' ? t(`roles.${role}`) : t('broadcast.peopleCount', { count: people.length });

  async function send() {
    const payload = {
      title: title.trim(),
      body: body.trim(),
      ...(audience === 'role' ? { role } : {}),
      ...(audience === 'people' ? { userIds: people.map((p) => p.id) } : {}),
    };
    let delivered = 0;
    const ok = await action.run(async () => {
      delivered = (await api<{ delivered: number }>('/admin/notifications/broadcast', { method: 'POST', body: payload })).delivered;
    }, '');
    if (ok) {
      action.setNotice({ kind: 'ok', text: t('broadcast.sent', { count: delivered }) });
      setConfirming(false);
      setTitle('');
      setBody('');
      setPeople([]);
    }
  }

  return (
    <>
      <Heading title={t('nav.broadcast')} sub={t('broadcast.sub')} />
      <Notice notice={action.notice} onClose={() => action.setNotice(null)} />
      <section className={`${card} flex max-w-[720px] flex-col gap-4`}>
        <Field label={t('broadcast.to')}>
          <Segmented
            label={t('broadcast.to')}
            value={audience}
            onChange={setAudience}
            options={(['all', 'role', 'people'] as const).map((value) => ({ value, label: t(`broadcast.audience.${value}`) }))}
          />
        </Field>
        {audience === 'role' && (
          <Field label={t('users.role')}>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={input}>
              {ROLES.map((value) => <option key={value} value={value}>{t(`roles.${value}`)}</option>)}
            </select>
          </Field>
        )}
        {audience === 'people' && (
          <div className="flex flex-col gap-2">
            {people.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {people.map((person) => (
                  <li key={person.id} className="flex items-center gap-1 rounded-full bg-ink-100 py-1 pl-3 pr-1 text-sm dark:bg-slate-800">
                    {fullName(person)}
                    <button type="button" aria-label={t('broadcast.remove', { name: fullName(person) })} onClick={() => setPeople(people.filter((p) => p.id !== person.id))} className="grid h-6 w-6 place-items-center rounded-full font-bold hover:bg-ink-200 dark:hover:bg-slate-700">×</button>
                  </li>
                ))}
              </ul>
            )}
            <Field label={t('broadcast.find')}>
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('users.search')} className={input} />
            </Field>
            {(matches.data?.data ?? []).filter((m) => !people.some((p) => p.id === m.id)).map((match) => (
              <button key={match.id} type="button" onClick={() => { setPeople([...people, match]); setSearch(''); }} className="flex flex-col rounded-lg border border-ink-200 px-3 py-2 text-left text-sm hover:border-forest dark:border-slate-800 dark:hover:border-limeAccent">
                <b className="text-ink-900 dark:text-white">{fullName(match)}</b>
                <span className={muted}>{match.email}</span>
              </button>
            ))}
          </div>
        )}
        <Field label={t('broadcast.title')}><input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className={input} /></Field>
        <Field label={t('broadcast.body')}><textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} className={`${input} py-2`} /></Field>
        <div><button type="button" disabled={!valid} className={solid} onClick={() => setConfirming(true)}>{t('broadcast.send')}</button></div>
      </section>
      {confirming && (
        <Dialog title={t('broadcast.confirmTitle', { who })} text={`${title.trim()} — ${body.trim()}`} confirm={t('broadcast.send')} busy={action.busy} onCancel={() => setConfirming(false)} onConfirm={send} />
      )}
    </>
  );
}
