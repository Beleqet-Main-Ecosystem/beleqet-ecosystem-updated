'use client';

import { useState } from 'react';
import { Badge, Dialog, Empty, Failed, Field, Heading, Loading, Notice, card, input, muted, outline, row, solid, useAction, useResource } from '@/components/ui';
import { api } from '@/lib/api';
import { formatMinor } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { parseFeatures } from '@/lib/rules';

type Plan = {
  id: string;
  name: string;
  description: string | null;
  priceAmount: number;
  currency: string;
  interval: 'MONTHLY' | 'YEARLY';
  features: Record<string, unknown>;
  isActive: boolean;
  paypalPlanId: string | null;
};
type Draft = { id?: string; name: string; description: string; price: string; currency: string; interval: 'MONTHLY' | 'YEARLY'; features: string; paypalPlanId: string };

const blank: Draft = { name: '', description: '', price: '', currency: 'ETB', interval: 'MONTHLY', features: '{\n  "maxJobPosts": 5\n}', paypalPlanId: '' };

/** Plans people subscribe to. Prices are typed in birr and stored in santim. */
export default function PlansPage() {
  const { t, locale } = useI18n();
  const plans = useResource((signal) => api<Plan[]>('/plans?includeInactive=true', { signal }), 'plans');
  const action = useAction();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toggling, setToggling] = useState<Plan | null>(null);

  const features = draft ? parseFeatures(draft.features) : null;
  const price = draft ? Math.round(Number(draft.price) * 100) : 0;
  const valid = !!draft && draft.name.trim().length >= 2 && Number.isFinite(price) && price > 0 && features !== null;

  async function save() {
    if (!draft || !features) return;
    const body = {
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      priceAmount: price,
      currency: draft.currency,
      interval: draft.interval,
      features,
      paypalPlanId: draft.paypalPlanId.trim() || undefined,
    };
    const ok = await action.run(
      () => (draft.id ? api(`/plans/${draft.id}`, { method: 'PATCH', body }) : api('/plans', { method: 'POST', body })),
      draft.id ? t('plans.saved', { name: body.name }) : t('plans.created', { name: body.name }),
    );
    if (ok) {
      setDraft(null);
      plans.reload();
    }
  }

  const edit = (plan: Plan) =>
    setDraft({
      id: plan.id,
      name: plan.name,
      description: plan.description ?? '',
      price: String(plan.priceAmount / 100),
      currency: plan.currency,
      interval: plan.interval,
      features: JSON.stringify(plan.features ?? {}, null, 2),
      paypalPlanId: plan.paypalPlanId ?? '',
    });

  return (
    <>
      <Heading title={t('nav.plans')} sub={t('plans.sub')}>
        <button type="button" className={solid} onClick={() => setDraft({ ...blank })}>{t('plans.add')}</button>
      </Heading>
      <Notice notice={action.notice} onClose={() => action.setNotice(null)} />
      <section className={card}>
        {plans.error && <Failed message={plans.error} onRetry={plans.reload} />}
        {plans.loading && <Loading />}
        {plans.data?.length === 0 && <Empty title={t('plans.none')} />}
        {plans.data?.map((plan) => (
          <div key={plan.id} className={row}>
            <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-1 text-sm">
              <span className="flex flex-wrap items-center gap-2">
                <b className="text-ink-900 dark:text-white">{plan.name}</b>
                <Badge tone={plan.isActive ? 'green' : 'gray'}>{plan.isActive ? t('plans.active') : t('plans.hidden')}</Badge>
                {plan.priceAmount > 0 && <Badge tone={plan.paypalPlanId ? 'green' : 'amber'}>{plan.paypalPlanId ? t('plans.paypalReady') : t('plans.paypalMissing')}</Badge>}
              </span>
              {plan.description && <span className="text-ink-700 dark:text-slate-300">{plan.description}</span>}
              <span className={muted}>
                {plan.priceAmount === 0 ? t('plans.free') : `${formatMinor(plan.priceAmount, plan.currency, locale)} / ${t(`plans.interval.${plan.interval}`)}`}
                {' · '}
                {Object.entries(plan.features ?? {}).map(([key, value]) => `${key}: ${String(value)}`).join(', ')}
              </span>
            </div>
            <div className="flex gap-2">
              <button type="button" className={outline} onClick={() => edit(plan)}>{t('plans.edit')}</button>
              <button type="button" className={outline} onClick={() => setToggling(plan)}>{plan.isActive ? t('plans.hide') : t('plans.show')}</button>
            </div>
          </div>
        ))}
      </section>

      {draft && (
        <Dialog title={draft.id ? t('plans.editTitle') : t('plans.addTitle')} confirm={t('plans.save')} busy={action.busy} disabled={!valid} onCancel={() => setDraft(null)} onConfirm={save}>
          <Field label={t('plans.name')}><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={input} /></Field>
          <Field label={t('plans.description')}><input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={input} /></Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('plans.price')}><input type="number" min="0" step="0.01" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} className={input} /></Field>
            <Field label={t('plans.currency')}>
              <select value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} className={input}>
                {['ETB', 'USD'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label={t('plans.every')}>
              <select value={draft.interval} onChange={(e) => setDraft({ ...draft, interval: e.target.value as Draft['interval'] })} className={input}>
                <option value="MONTHLY">{t('plans.interval.MONTHLY')}</option>
                <option value="YEARLY">{t('plans.interval.YEARLY')}</option>
              </select>
            </Field>
          </div>
          <Field label={t('plans.features')} hint={features === null ? t('plans.featuresInvalid') : t('plans.featuresHint')}>
            <textarea rows={5} value={draft.features} onChange={(e) => setDraft({ ...draft, features: e.target.value })} className={`${input} py-2 font-mono text-xs`} />
          </Field>
          <Field label={t('plans.paypalId')} hint={t('plans.paypalHint')}>
            <input value={draft.paypalPlanId} onChange={(e) => setDraft({ ...draft, paypalPlanId: e.target.value })} placeholder="P-..." className={input} />
          </Field>
        </Dialog>
      )}
      {toggling && (
        <Dialog
          title={toggling.isActive ? t('plans.hideTitle', { name: toggling.name }) : t('plans.showTitle', { name: toggling.name })}
          text={toggling.isActive ? t('plans.hideText') : t('plans.showText')}
          confirm={toggling.isActive ? t('plans.hide') : t('plans.show')}
          busy={action.busy}
          onCancel={() => setToggling(null)}
          onConfirm={() =>
            action.run(() => api(`/plans/${toggling.id}`, { method: 'PATCH', body: { isActive: !toggling.isActive } }), t('plans.saved', { name: toggling.name })).then((ok) => {
              if (ok) {
                setToggling(null);
                plans.reload();
              }
            })
          }
        />
      )}
    </>
  );
}
