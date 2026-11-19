'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useTranslation } from '@/lib/i18n';
import { safeHttpUrl } from '@/features/jobs/format';
import { acceptMilestone, declineMilestone, fetchContract, fundEscrow, raiseDispute, type Contract, type ContractEvent, type Milestone } from '../contract';
import MilestoneDialog, { type DialogRequest } from './MilestoneDialog';
import { errorText } from '@/lib/api-error';

const card = 'rounded-xl border border-ink-200 bg-surface p-5 dark:border-slate-800 dark:bg-slate-900';
const outline = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-ink-300 bg-surface px-3.5 text-sm font-bold text-ink-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white';
const solid = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-obsidian px-3.5 text-sm font-bold text-white disabled:opacity-60 dark:bg-limeAccent dark:text-obsidian';
const BADGES: Record<Milestone['status'], string> = {
  PENDING: 'bg-[#EAF1FB] text-[#1D4E89] dark:bg-slate-800 dark:text-slate-200',
  IN_PROGRESS: 'bg-[#EAF1FB] text-[#1D4E89] dark:bg-slate-800 dark:text-slate-200',
  PROPOSED: 'bg-[#F1F4F6] text-ink-700 dark:bg-slate-800 dark:text-slate-200',
  SUBMITTED: 'bg-[#FFF7E6] text-[#7A4B00] dark:bg-amber-900/30 dark:text-amber-200',
  APPROVED: 'bg-[#EEF5EF] text-forest dark:bg-forest/30 dark:text-limeAccent',
  REVISION_REQUESTED: 'bg-[#FDECEC] text-[#9B2C2C] dark:bg-red-900/30 dark:text-red-200',
};
const MIN_DISPUTE = 20;
const FEE = 0.1;

const short = (person: { firstName: string; lastName: string }) => `${person.firstName} ${person.lastName.charAt(0)}.`.trim();

export default function ContractWorkspace({ id }: { id: string }) {
  const { t, locale } = useTranslation();
  const { user, ready } = useAuth();
  const router = useRouter();
  const [contract, setContract] = useState<Contract | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [funding, setFunding] = useState(false);
  const [error, setError] = useState('');
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [disputing, setDisputing] = useState(false);

  const load = useCallback(async () => {
    try {
      const found = await fetchContract(id);
      setContract(found);
      setState(found ? 'ready' : 'missing');
    } catch {
      setState('failed');
    }
  }, [id]);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(`/freelance/contracts/${id}`)}`);
    else void load();
  }, [ready, user, id, router, load]);

  if (state === 'loading' || !user) return <div className="min-h-[60vh]" />;

  if (state !== 'ready' || !contract) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-[560px] flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-2xl font-extrabold text-ink-900 dark:text-white">{t(state === 'missing' ? 'freelance.contract.missingTitle' : 'freelance.contract.failedTitle')}</h1>
        <p className="text-[15px] text-ink-500 dark:text-slate-300">{t(state === 'missing' ? 'freelance.contract.missingText' : 'freelance.errorText')}</p>
        {state === 'failed' ? (
          <button type="button" onClick={load} className={solid}>{t('freelance.retry')}</button>
        ) : (
          <Link href="/freelance" className={solid}>{t('freelance.gig.browse')}</Link>
        )}
      </div>
    );
  }

  const isClient = user.id === contract.clientId;
  const other = isClient ? contract.freelancer : contract.client;
  const escrow = contract.freelanceJob.escrowTx;
  const disputed = contract.status === 'DISPUTED';
  const funded = escrow?.status === 'FUNDED';
  const moneyIn = funded || disputed;
  const active = contract.status === 'ACTIVE';
  const money = (value: number) => `${contract.currency} ${value.toLocaleString('en-US')}`;
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale === 'am' ? 'am-ET' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const released = contract.milestones.filter((item) => item.status === 'APPROVED').reduce((sum, item) => sum + item.amount, 0);
  const planned = contract.milestones.reduce((sum, item) => sum + item.amount, 0);
  const shownReleased = moneyIn ? released : 0;
  const percent = Math.min(100, Math.round((shownReleased / contract.agreedAmount) * 100));
  const summary = [
    { key: t('freelance.contract.value'), value: money(contract.agreedAmount), tone: 'text-ink-900 dark:text-white' },
    { key: t('freelance.contract.inEscrow'), value: money(moneyIn ? contract.agreedAmount - released : 0), tone: disputed ? 'text-[#9B2C2C] dark:text-red-300' : 'text-ink-900 dark:text-white' },
    { key: t('freelance.contract.released'), value: money(shownReleased), tone: 'text-forest dark:text-limeAccent' },
    { key: t('freelance.contract.fee'), value: money(Math.round(shownReleased * FEE)), tone: 'text-ink-500 dark:text-slate-300' },
  ];

  // The API's event log has the full story (proposals, disputes); older API versions don't send it.
  const logText = (event: ContractEvent): string | null => {
    const title = event.milestone ?? '';
    switch (event.type) {
      case 'milestone.proposed': return t('freelance.contract.logProposed').replace('{title}', title);
      case 'milestone.accepted': return t('freelance.contract.logAccepted').replace('{title}', title);
      case 'milestone.submitted': return t('freelance.contract.logSubmitted').replace('{title}', title);
      case 'milestone.revision_requested': return t('freelance.contract.logRevision').replace('{title}', title);
      case 'milestone.approved':
      case 'milestone.dual_confirmed': return t('freelance.contract.logApproved').replace('{title}', title);
      case 'escrow.funded': return escrow ? t('freelance.contract.logFunded').replace('{amount}', money(escrow.grossAmount)) : null;
      case 'dispute.raised': return t('freelance.contract.logDisputed');
      case 'dispute.resolved': return t('freelance.contract.logResolved');
      default: return null;
    }
  };
  const activity = [
    { text: t('freelance.contract.logCreated').replace('{name}', short(contract.freelancer)), at: contract.startedAt },
    ...(contract.activity
      ? contract.activity.map((event) => {
          const text = logText(event);
          return text ? { text, at: event.at } : null;
        })
      : [
          escrow?.fundedAt ? { text: t('freelance.contract.logFunded').replace('{amount}', money(escrow.grossAmount)), at: escrow.fundedAt } : null,
          ...contract.milestones.flatMap((item) => [
            ...(item.deliverables ?? []).map((work) => ({ text: t('freelance.contract.logSubmitted').replace('{title}', item.title), at: work.submittedAt })),
            item.revisionRequestedAt ? { text: t('freelance.contract.logRevision').replace('{title}', item.title), at: item.revisionRequestedAt } : null,
            item.approvedAt ? { text: t('freelance.contract.logReleased').replace('{amount}', money(item.amount)).replace('{title}', item.title), at: item.approvedAt } : null,
          ]),
        ]),
  ]
    .filter((item): item is { text: string; at: string } => Boolean(item))
    .sort((a, b) => b.at.localeCompare(a.at));

  async function answerProposal(item: Milestone, accept: boolean) {
    setError('');
    try {
      await (accept ? acceptMilestone(item.id) : declineMilestone(item.id));
      await load();
    } catch (problem) {
      setError(errorText(problem, t, 'freelance.gig.actionFailed'));
    }
  }

  async function fund() {
    setFunding(true);
    setError('');
    try {
      const { checkoutUrl } = await fundEscrow(contract!.freelanceJobId);
      const target = safeHttpUrl(checkoutUrl);
      if (target) window.location.href = target;
      else await load();
    } catch (problem) {
      setError(errorText(problem, t, 'freelance.contract.fundFailed'));
      setFunding(false);
    }
  }

  async function dispute() {
    setDisputing(true);
    setError('');
    try {
      await raiseDispute(contract!.id, reason.trim());
      setDisputeOpen(false);
      setReason('');
      await load();
    } catch (problem) {
      setError(errorText(problem, t, 'freelance.gig.actionFailed'));
    } finally {
      setDisputing(false);
    }
  }

  return (
    <>
      <section className="bg-obsidian text-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-end justify-between gap-4 px-4 pb-6 pt-3 md:px-[clamp(16px,4vw,40px)] md:pb-8">
          <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-3">
            <nav aria-label={t('freelance.contract.breadcrumb')} className="text-[13px] text-white/70">
              <Link href={isClient ? '/employer?tab=projects' : '/dashboard?tab=contracts'} className="hover:underline">{t('freelance.contract.contracts')}</Link> / <span aria-current="page">{contract.freelanceJob.title}</span>
            </nav>
            <span className="flex flex-wrap gap-2">
              <span className={`rounded-md px-2 py-[3px] text-[11px] font-extrabold uppercase tracking-[0.04em] ${disputed ? 'bg-[#FDECEC] text-[#9B2C2C]' : 'bg-limeAccent text-obsidian'}`}>
                {t(`freelance.contract.status.${contract.status}`)}
              </span>
              <span className="rounded-md bg-white/10 px-2 py-[3px] text-[11px] font-bold uppercase tracking-[0.04em]">BeleqetSafe</span>
            </span>
            <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.03em] md:text-[clamp(26px,3vw,34px)]">{contract.freelanceJob.title}</h1>
            <p className="text-sm text-white/70">
              {t('freelance.contract.parties').replace('{client}', short(contract.client)).replace('{freelancer}', short(contract.freelancer)).replace('{date}', date(contract.startedAt))}
            </p>
          </div>
          <Link href={`/messages?contractId=${contract.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 px-4 text-sm font-bold text-white">
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            {t('freelance.contract.chat')}
          </Link>
        </div>
      </section>

      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 pb-14 pt-4 md:gap-5 md:px-[clamp(16px,4vw,40px)] md:pb-16 md:pt-6">
        {active && !funded && (
          <div className="flex flex-wrap items-center gap-3.5 rounded-xl border border-[#F0D9A8] bg-[#FFF7E6] p-4 md:p-5 dark:border-amber-900 dark:bg-amber-900/20">
            <span className="flex flex-[1_1_360px] flex-col gap-1">
              <b className="text-base text-[#5C3A00] dark:text-amber-100">{t(isClient ? 'freelance.contract.fundTitle' : 'freelance.contract.waitTitle')}</b>
              <span className="text-sm leading-normal text-[#7A4B00] dark:text-amber-200">
                {t(isClient ? 'freelance.contract.fundText' : 'freelance.contract.waitText').replace('{amount}', money(contract.agreedAmount)).replace('{name}', short(other))}
              </span>
            </span>
            {isClient && (
              <button type="button" disabled={funding} onClick={fund} className={solid}>
                {funding ? t('freelance.contract.funding') : t('freelance.contract.fund').replace('{amount}', money(contract.agreedAmount))}
              </button>
            )}
          </div>
        )}
        {disputed && (
          <div role="status" className="flex flex-col gap-1 rounded-xl border border-[#F3C6C6] bg-[#FDECEC] p-4 md:p-5 dark:border-red-900 dark:bg-red-900/20">
            <b className="text-base text-[#8A1C1C] dark:text-red-200">{t('freelance.contract.disputeTitle')}</b>
            <span className="text-sm leading-normal text-[#9B2C2C] dark:text-red-200">{t('freelance.contract.disputeText')}</span>
          </div>
        )}
        {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}

        <section aria-label={t('freelance.contract.summary')} className={`${card} flex flex-col gap-3.5`}>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {summary.map((item) => (
              <div key={item.key} className="flex flex-col gap-1">
                <span className="text-[13px] text-ink-500 dark:text-slate-400">{item.key}</span>
                <b className={`text-[22px] tracking-[-0.02em] ${item.tone}`}>{item.value}</b>
              </div>
            ))}
          </div>
          <div role="img" aria-label={t('freelance.contract.progress').replace('{percent}', String(percent))} className="h-2 overflow-hidden rounded-full bg-[#F1F4F6] dark:bg-slate-800">
            <div className="h-2 bg-forest dark:bg-limeAccent" style={{ width: `${percent}%` }} />
          </div>
          <span className="text-[13px] text-ink-500 dark:text-slate-400">{t('freelance.contract.feeNote')}</span>
        </section>

        <div className="flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <span className="flex flex-col gap-0.5">
                <h2 className="text-xl font-extrabold text-ink-900 dark:text-white">{t('freelance.contract.milestones')}</h2>
                <span className="text-[13px] text-ink-500 dark:text-slate-400">
                  {t('freelance.contract.planned').replace('{planned}', money(planned)).replace('{total}', money(contract.agreedAmount))}
                </span>
              </span>
              {!isClient && funded && planned < contract.agreedAmount && (
                <button type="button" onClick={() => setDialog({ kind: 'add', left: contract.agreedAmount - planned })} className={outline}>
                  + {t('freelance.contract.addMilestone')}
                </button>
              )}
            </div>

            {contract.milestones.length === 0 && (
              <p className={`${card} text-sm text-ink-500 dark:text-slate-300`}>{t(isClient ? 'freelance.contract.noMilestonesClient' : 'freelance.contract.noMilestones')}</p>
            )}

            {contract.milestones.map((item, index) => {
              const waitingOnClient = item.status === 'SUBMITTED';
              const work = item.deliverables?.[item.deliverables.length - 1];
              const link = safeHttpUrl(work?.fileUrl);
              return (
                <article key={item.id} className={`flex flex-col gap-3 rounded-xl border bg-surface p-4 md:p-5 dark:bg-slate-900 ${waitingOnClient || item.status === 'REVISION_REQUESTED' ? 'border-[#B9D88A] dark:border-limeAccent/40' : 'border-ink-200 dark:border-slate-800'}`}>
                  <div className="flex flex-wrap items-start gap-3.5">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold ${item.status === 'APPROVED' ? 'bg-forest text-white' : 'bg-obsidian text-limeAccent'}`} aria-hidden="true">{index + 1}</span>
                    <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                      <h3 className="text-base font-bold text-ink-900 dark:text-white">{item.title}</h3>
                      <span className="text-sm text-ink-500 dark:text-slate-400">{t('freelance.contract.due').replace('{date}', date(item.deadline))}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <b className="text-[17px] text-ink-900 dark:text-white">{money(item.amount)}</b>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${BADGES[item.status]}`}>{t(`freelance.contract.badge.${item.status}`)}</span>
                    </div>
                  </div>

                  {work && waitingOnClient && (
                    <div className="flex flex-col gap-1 rounded-lg bg-[#F6F7F4] p-3 dark:bg-slate-800">
                      <span className="text-[13px] font-bold text-ink-500 dark:text-slate-300">{t('freelance.contract.submitted')}</span>
                      {link && (
                        <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-sm font-semibold text-forest hover:underline dark:text-limeAccent">{link} ↗</a>
                      )}
                      {work.notes && <p className="whitespace-pre-line text-sm leading-normal text-ink-700 dark:text-slate-300">{work.notes}</p>}
                    </div>
                  )}

                  {item.status === 'REVISION_REQUESTED' && item.revisionNote && (
                    <div className="flex flex-col gap-1 rounded-lg bg-[#FDECEC] p-3 dark:bg-red-900/20">
                      <span className="text-[13px] font-bold text-[#9B2C2C] dark:text-red-200">{t('freelance.contract.revisionAsked')}</span>
                      <p className="whitespace-pre-line text-sm leading-normal text-ink-900 dark:text-slate-200">{item.revisionNote}</p>
                    </div>
                  )}

                  {item.approvedAt && (
                    <span className="text-[13px] text-ink-500 dark:text-slate-400">
                      {t('freelance.contract.approvedNote').replace('{date}', date(item.approvedAt)).replace('{amount}', money(Math.round(item.amount * (1 - FEE))))}
                    </span>
                  )}
                  {waitingOnClient && !isClient && <span className="text-[13px] text-ink-500 dark:text-slate-400">{t('freelance.contract.waitingReview')}</span>}

                  {isClient && funded && waitingOnClient && (
                    <div className="flex flex-wrap justify-end gap-2">
                      <button type="button" onClick={() => setDialog({ kind: 'revision', milestone: item })} className={outline}>{t('freelance.contract.requestRevision')}</button>
                      <button type="button" onClick={() => setDialog({ kind: 'release', milestone: item })} className={solid}>
                        {t('freelance.contract.approve').replace('{amount}', money(item.amount))}
                      </button>
                    </div>
                  )}
                  {item.status === 'PROPOSED' && !isClient && (
                    <span className="text-[13px] text-ink-500 dark:text-slate-400">{t('freelance.contract.waitingAccept').replace('{name}', short(contract.client))}</span>
                  )}
                  {item.status === 'PROPOSED' && isClient && (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <span className="mr-auto text-[13px] text-ink-500 dark:text-slate-400">{t('freelance.contract.proposedText')}</span>
                      <button type="button" onClick={() => answerProposal(item, false)} className={outline}>{t('freelance.contract.declineMilestone')}</button>
                      <button type="button" onClick={() => answerProposal(item, true)} className={solid}>{t('freelance.contract.acceptMilestone')}</button>
                    </div>
                  )}
                  {!isClient && funded && !waitingOnClient && item.status !== 'APPROVED' && item.status !== 'PROPOSED' && (
                    <div className="flex justify-end">
                      <button type="button" onClick={() => setDialog({ kind: 'submit', milestone: item, number: index + 1 })} className={solid}>{t('freelance.contract.submitWork')}</button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <aside className="flex w-full min-w-0 flex-[1_1_320px] flex-col gap-4 md:max-w-[400px]">
            <section aria-labelledby="act-h" className={card}>
              <h2 id="act-h" className="mb-3 text-base font-bold text-ink-900 dark:text-white">{t('freelance.contract.activity')}</h2>
              <ol className="flex flex-col gap-3">
                {activity.map((item, index) => (
                  <li key={`${item.at}-${index}`} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-forest dark:bg-limeAccent" aria-hidden="true" />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm leading-[1.45] text-ink-900 dark:text-slate-200">{item.text}</span>
                      <span className="text-xs text-ink-500 dark:text-slate-400">{date(item.at)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            {active && (
              <section aria-labelledby="disp-h" className={`${card} flex flex-col gap-3`}>
                <h2 id="disp-h" className="text-base font-bold text-ink-900 dark:text-white">{t('freelance.contract.wrongTitle')}</h2>
                <p className="text-sm leading-normal text-ink-500 dark:text-slate-300">{t('freelance.contract.wrongText')}</p>
                {disputeOpen ? (
                  <>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-semibold text-ink-900 dark:text-white">{t('freelance.contract.whatWrong')}</span>
                      <textarea
                        rows={4}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder={t('freelance.contract.min20')}
                        className="resize-y rounded-lg border border-ink-300 bg-surface p-3 text-base text-ink-900 focus:outline-none focus:ring-2 focus:ring-forest dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />
                    </label>
                    <span className="flex justify-end gap-2">
                      <button type="button" onClick={() => setDisputeOpen(false)} className={outline}>{t('freelance.gig.cancel')}</button>
                      <button type="button" disabled={disputing || reason.trim().length < MIN_DISPUTE} onClick={dispute} className={solid}>{t('freelance.contract.submitDispute')}</button>
                    </span>
                  </>
                ) : (
                  <button type="button" onClick={() => setDisputeOpen(true)} className={outline}>{t('freelance.contract.openDispute')}</button>
                )}
              </section>
            )}
          </aside>
        </div>
      </div>

      {dialog && (
        <MilestoneDialog
          request={dialog}
          contractId={contract.id}
          freelancerName={short(contract.freelancer)}
          currency={contract.currency}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            void load();
          }}
        />
      )}
    </>
  );
}
