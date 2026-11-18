'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import {
  Badge, Dialog, Empty, Failed, Field, Heading, Loading, Notice, Pager, card, input, muted, outline, row, solid,
  useAction, useDebounced, useResource,
} from '@/components/ui';
import { ApiError, api, query } from '@/lib/api';
import { formatDate, fullName } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

const ROLES = ['JOB_SEEKER', 'EMPLOYER', 'FREELANCER', 'ADMIN'] as const;
const LIMIT = 25;

type User = {
  id: string;
  /** Null for accounts made in Telegram without an email. */
  email: string | null;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  kycVerified: boolean;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  signupMethod?: 'EMAIL' | 'TELEGRAM_BOT' | 'TELEGRAM' | 'GOOGLE' | 'LINKEDIN';
  signInMethods?: ('PASSWORD' | 'GOOGLE' | 'LINKEDIN' | 'TELEGRAM')[];
  phone?: string | null;
  telegramUsername?: string | null;
  gender?: 'MALE' | 'FEMALE' | null;
  country?: string | null;
  city?: string | null;
};
type Page = { data: User[]; total: number; page: number; limit: number };
type Pending =
  | { kind: 'role'; user: User; role: string }
  | { kind: 'status'; user: User }
  | { kind: 'delete'; user: User }
  | { kind: 'erase'; user: User; reason: string }
  | { kind: 'add' };

export default function UsersPage() {
  const { t, locale } = useI18n();
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<Pending | null>(null);
  const settled = useDebounced(search.trim());
  const action = useAction();

  const path = `/admin/users${query({ page, limit: LIMIT, search: settled, role, status })}`;
  const users = useResource((signal) => api<Page>(path, { signal }), path);

  const filter = (apply: () => void) => {
    apply();
    setPage(1);
  };

  async function confirm() {
    if (!pending) return;
    let ok = false;
    if (pending.kind === 'role') {
      ok = await action.run(
        () => api(`/admin/users/${pending.user.id}`, { method: 'PATCH', body: { role: pending.role } }),
        t('users.done.role', { name: fullName(pending.user), role: t(`roles.${pending.role}`) }),
      );
    } else if (pending.kind === 'status') {
      ok = await action.run(
        () => api(`/admin/users/${pending.user.id}`, { method: 'PATCH', body: { isActive: !pending.user.isActive } }),
        pending.user.isActive ? t('users.done.suspended') : t('users.done.reactivated'),
      );
    } else if (pending.kind === 'delete') {
      try {
        await api(`/admin/users/${pending.user.id}`, { method: 'DELETE' });
        action.setNotice({ kind: 'ok', text: t('users.done.deleted') });
        ok = true;
      } catch (failure) {
        // Accounts with history can't be deleted; offer to erase their personal data instead.
        if (failure instanceof ApiError && failure.status === 409 && failure.message.includes('activity')) {
          setPending({ kind: 'erase', user: pending.user, reason: '' });
          return;
        }
        action.setNotice({ kind: 'error', text: failure instanceof Error ? failure.message : String(failure) });
        ok = true;
      }
    } else if (pending.kind === 'erase') {
      ok = await action.run(
        () => api('/v1/compliance/gdpr/erase', { method: 'POST', body: { userId: pending.user.id, reason: pending.reason.trim() } }),
        t('users.done.erased'),
      );
    }
    if (ok) {
      setPending(null);
      users.reload();
    }
  }

  return (
    <>
      <Heading title={t('nav.users')} sub={users.data ? t('users.count', { total: users.data.total }) : undefined}>
        <button type="button" className={solid} onClick={() => setPending({ kind: 'add' })}>
          <UserPlus className="h-4 w-4" aria-hidden="true" /> {t('users.add')}
        </button>
      </Heading>

      <Notice notice={action.notice} onClose={() => action.setNotice(null)} />

      <div className="grid gap-3 sm:grid-cols-[1fr_180px_160px]">
        <input type="search" value={search} onChange={(e) => filter(() => setSearch(e.target.value))} placeholder={t('users.search')} aria-label={t('users.search')} className={input} />
        <select value={role} onChange={(e) => filter(() => setRole(e.target.value))} aria-label={t('users.role')} className={input}>
          <option value="">{t('users.allRoles')}</option>
          {ROLES.map((value) => <option key={value} value={value}>{t(`roles.${value}`)}</option>)}
        </select>
        <select value={status} onChange={(e) => filter(() => setStatus(e.target.value))} aria-label={t('users.status')} className={input}>
          <option value="">{t('users.anyStatus')}</option>
          <option value="active">{t('users.active')}</option>
          <option value="suspended">{t('users.suspended')}</option>
        </select>
      </div>

      <section className={card}>
        {users.error && <Failed message={users.error} onRetry={users.reload} />}
        {users.loading && <Loading />}
        {users.data?.data.length === 0 && <Empty title={t('users.none')} />}
        {users.data?.data.map((person) => {
          const self = person.id === me?.id;
          return (
            <div key={person.id} data-user={person.email ?? person.id} className={row}>
              <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <b className="text-ink-900 dark:text-white">{fullName(person)}</b>
                  {self && <Badge>{t('users.you')}</Badge>}
                  {!person.isActive && <Badge tone="red">{t('users.suspended')}</Badge>}
                </span>
                <span className={`${muted} break-all`}>{person.email ?? t('users.noEmail')}</span>
                {(person.phone || person.telegramUsername || person.city || person.gender) && (
                  <span className={`${muted} break-all`}>
                    {[
                      person.phone,
                      person.telegramUsername && `@${person.telegramUsername}`,
                      [person.city, person.country].filter(Boolean).join(', '),
                      person.gender && t(`users.gender.${person.gender}`),
                    ].filter(Boolean).join(' · ')}
                  </span>
                )}
                {person.signupMethod && (
                  <span className={muted}>
                    {t('users.signedUpVia', { method: t(`users.signup.${person.signupMethod}`) })}
                    {person.signInMethods?.length
                      ? ` · ${t('users.signsInWith', { methods: person.signInMethods.map((method) => t(`users.method.${method}`)).join(', ') })}`
                      : ''}
                  </span>
                )}
                <span className="flex flex-wrap gap-1.5">
                  <Badge tone={person.role === 'ADMIN' ? 'amber' : 'gray'}>{t(`roles.${person.role}`)}</Badge>
                  {person.twoFactorEnabled && <Badge tone="green">{t('users.twoStep')}</Badge>}
                  {person.kycVerified && <Badge tone="green">{t('users.kyc')}</Badge>}
                  {person.email && !person.emailVerified && <Badge>{t('users.emailUnverified')}</Badge>}
                </span>
              </div>
              <span className={`${muted} w-[110px] pt-1`}>{t('users.joined', { date: formatDate(person.createdAt, locale) })}</span>
              <div className="flex flex-wrap gap-2">
                <select
                  value={person.role}
                  disabled={self}
                  aria-label={t('users.changeRoleFor', { name: fullName(person) })}
                  onChange={(e) => setPending({ kind: 'role', user: person, role: e.target.value })}
                  className={`${input} !w-auto`}
                >
                  {ROLES.map((value) => <option key={value} value={value}>{t(`roles.${value}`)}</option>)}
                </select>
                <button type="button" disabled={action.busy} className={outline} onClick={() =>
                  action.run(() => api(`/admin/users/${person.id}`, { method: 'PATCH', body: { kycVerified: !person.kycVerified } }), t('users.done.kyc')).then(users.reload)
                }>
                  {person.kycVerified ? t('users.unverifyKyc') : t('users.verifyKyc')}
                </button>
                <button type="button" disabled={self} className={outline} onClick={() => setPending({ kind: 'status', user: person })}>
                  {person.isActive ? t('users.suspend') : t('users.reactivate')}
                </button>
                <button type="button" disabled={self} className={outline} onClick={() => setPending({ kind: 'delete', user: person })}>
                  {t('users.delete')}
                </button>
              </div>
            </div>
          );
        })}
        {users.data && (
          <Pager page={page} pages={Math.max(1, Math.ceil(users.data.total / LIMIT))} total={users.data.total} onPage={setPage} />
        )}
      </section>

      {pending?.kind === 'role' && (
        <Dialog
          title={pending.role === 'ADMIN' ? t('users.makeAdminTitle', { name: fullName(pending.user) }) : t('users.roleTitle', { name: fullName(pending.user) })}
          text={pending.role === 'ADMIN' ? t('users.makeAdminText') : t('users.roleText', { from: t(`roles.${pending.user.role}`), to: t(`roles.${pending.role}`) })}
          confirm={pending.role === 'ADMIN' ? t('users.makeAdmin') : t('users.changeRole')}
          tone={pending.role === 'ADMIN' ? 'danger' : 'solid'}
          busy={action.busy}
          onCancel={() => setPending(null)}
          onConfirm={confirm}
        />
      )}
      {pending?.kind === 'status' && (
        <Dialog
          title={pending.user.isActive ? t('users.suspendTitle', { name: fullName(pending.user) }) : t('users.reactivateTitle', { name: fullName(pending.user) })}
          text={pending.user.isActive ? t('users.suspendText') : t('users.reactivateText')}
          confirm={pending.user.isActive ? t('users.suspend') : t('users.reactivate')}
          tone={pending.user.isActive ? 'danger' : 'solid'}
          busy={action.busy}
          onCancel={() => setPending(null)}
          onConfirm={confirm}
        />
      )}
      {pending?.kind === 'delete' && (
        <Dialog
          title={t('users.deleteTitle', { name: fullName(pending.user) })}
          text={t('users.deleteText')}
          confirm={t('users.delete')}
          tone="danger"
          busy={action.busy}
          onCancel={() => setPending(null)}
          onConfirm={confirm}
        />
      )}
      {pending?.kind === 'erase' && (
        <Dialog
          title={t('users.eraseTitle')}
          text={t('users.eraseText', { name: fullName(pending.user) })}
          confirm={t('users.erase')}
          tone="danger"
          busy={action.busy}
          disabled={pending.reason.trim().length < 5}
          onCancel={() => setPending(null)}
          onConfirm={confirm}
        >
          <Field label={t('users.eraseReason')} hint={t('users.eraseHint')}>
            <textarea rows={2} value={pending.reason} onChange={(e) => setPending({ ...pending, reason: e.target.value })} className={`${input} py-2`} />
          </Field>
        </Dialog>
      )}
      {pending?.kind === 'add' && <AddUser onClose={() => setPending(null)} onAdded={(text) => { setPending(null); action.setNotice({ kind: 'ok', text }); users.reload(); }} />}
    </>
  );
}

function AddUser({ onClose, onAdded }: { onClose: () => void; onAdded: (text: string) => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'JOB_SEEKER' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });
  const valid = form.firstName.trim().length >= 2 && form.lastName.trim().length >= 2 && form.email.includes('@') && form.password.length >= 8;

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await api('/admin/users', { method: 'POST', body: form });
      onAdded(t('users.done.added', { email: form.email }));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title={t('users.addTitle')} confirm={t('users.add')} busy={busy} disabled={!valid} onCancel={onClose} onConfirm={submit} tone={form.role === 'ADMIN' ? 'danger' : 'solid'}>
      {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('users.firstName')}><input value={form.firstName} onChange={set('firstName')} className={input} /></Field>
        <Field label={t('users.lastName')}><input value={form.lastName} onChange={set('lastName')} className={input} /></Field>
      </div>
      <Field label={t('login.email')}><input type="email" value={form.email} onChange={set('email')} className={input} /></Field>
      <Field label={t('users.tempPassword')} hint={t('users.tempPasswordHint')}><input type="password" autoComplete="new-password" value={form.password} onChange={set('password')} className={input} /></Field>
      <Field label={t('users.role')}>
        <select value={form.role} onChange={set('role')} className={input}>
          {ROLES.map((value) => <option key={value} value={value}>{t(`roles.${value}`)}</option>)}
        </select>
      </Field>
      {form.role === 'ADMIN' && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 dark:bg-red-950 dark:text-red-200">{t('users.makeAdminText')}</p>}
    </Dialog>
  );
}
