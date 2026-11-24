import { escapeTelegramMarkdown } from '../../../common/utils/telegram-escape';
import type { Notice } from './user-notifier';

/**
 * What people are told when something happens to them, for the bell, their phone and the Jobs
 * bot (English and Amharic). Anything someone typed is escaped for Telegram's Markdown here.
 */

/** Someone's text for Telegram: escaped, and cut short so a message stays readable. */
function said(text: string, max = 300): string {
  const trimmed = text.trim();
  return escapeTelegramMarkdown(trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed);
}

const money = (amount: number, currency: string) => `${currency} ${amount.toLocaleString('en-US')}`;

const CONTRACT_BUTTON = { en: 'Open the contract', am: 'ውሉን ይክፈቱ' };

// ── Chat ──────────────────────────────────────────────────────────────────

/** A new message in a conversation they haven't read. A file or call shows as such. */
export function chatMessageNotice(senderName: string, preview: string, roomId: string): Notice {
  const name = said(senderName, 80);
  const text = said(preview, 160);
  return {
    type: 'CHAT_MESSAGE',
    title: `New message from ${senderName}`,
    body: preview.slice(0, 160),
    metadata: { roomId },
    telegram: {
      en: `💬 New message from *${name}*:\n${text}`,
      am: `💬 ከ*${name}* አዲስ መልዕክት፦\n${text}`,
    },
    button: {
      text: { en: 'Open the chat', am: 'ውይይቱን ይክፈቱ' },
      web: `/messages?room=${encodeURIComponent(roomId)}`,
    },
  };
}

// ── Jobs and companies (employers) ────────────────────────────────────────

export function jobLiveNotice(job: { id: string; title: string }): Notice {
  const title = said(job.title, 150);
  return {
    type: 'JOB_APPROVED',
    title: 'Your job is live',
    body: `"${job.title}" was approved and is now open for applications.`,
    metadata: { jobId: job.id, path: `/job/${job.id}` },
    telegram: {
      en: `✅ Your job *${title}* is live and open for applications.`,
      am: `✅ የለጠፉት ስራ *${title}* ጸድቋል፤ አሁን ማመልከቻዎችን እየተቀበለ ነው።`,
    },
    button: {
      text: { en: 'See the job', am: 'ስራውን ይመልከቱ' },
      miniApp: `/tg/employer/jobs/${encodeURIComponent(job.id)}`,
    },
  };
}

export function jobNeedsChangesNotice(job: { id: string; title: string }, note: string): Notice {
  const title = said(job.title, 150);
  return {
    type: 'JOB_REJECTED',
    title: 'Your job needs changes',
    body: `"${job.title}" was not approved: ${note}`,
    metadata: { jobId: job.id, path: '/hiring' },
    telegram: {
      en: `✏️ Your job *${title}* needs changes before it can go live:\n${said(note)}`,
      am: `✏️ የለጠፉት ስራ *${title}* ከመታተሙ በፊት ማስተካከያ ያስፈልገዋል፦\n${said(note)}`,
    },
    button: {
      text: { en: 'Edit the job', am: 'ስራውን ያስተካክሉ' },
      miniApp: `/tg/post-job?edit=${encodeURIComponent(job.id)}`,
    },
  };
}

export function licenceVerifiedNotice(company: string): Notice {
  const name = said(company, 150);
  return {
    type: 'COMPANY_VERIFIED',
    title: 'Trade licence verified',
    body: `${company} now shows as a verified company.`,
    metadata: { path: '/company' },
    telegram: {
      en: `✅ The trade licence of *${name}* is verified. Your company now shows as verified.`,
      am: `✅ የ*${name}* የንግድ ፈቃድ ተረጋግጧል። ድርጅትዎ አሁን እንደተረጋገጠ ይታያል።`,
    },
    button: {
      text: { en: 'See your company', am: 'ድርጅትዎን ይመልከቱ' },
      miniApp: '/tg/employer/company',
    },
  };
}

export function licenceRejectedNotice(company: string, note: string): Notice {
  const name = said(company, 150);
  return {
    type: 'COMPANY_VERIFICATION_REJECTED',
    title: 'Trade licence not accepted',
    body: `${company}: ${note}`,
    metadata: { path: '/company' },
    telegram: {
      en: `❌ The trade licence of *${name}* wasn't accepted:\n${said(note)}\n\nUpload a clear, current one to try again.`,
      am: `❌ የ*${name}* የንግድ ፈቃድ ተቀባይነት አላገኘም፦\n${said(note)}\n\nእንደገና ለመሞከር ግልጽና ወቅታዊ ፈቃድ ይጫኑ።`,
    },
    button: {
      text: { en: 'Upload the licence', am: 'ፈቃዱን ይጫኑ' },
      miniApp: '/tg/employer/company',
    },
  };
}

// ── Plan payments ─────────────────────────────────────────────────────────

const PLAN_BUTTON = {
  text: { en: 'See your plan', am: 'እቅድዎን ይመልከቱ' },
  web: '/employer?tab=plan',
};

/** amount in santim, as payments are kept. */
export function transferApprovedNotice(
  payment: { id: string; amount: number; currency: string },
  planName: string | null,
): Notice {
  const paid = money(payment.amount / 100, payment.currency);
  const plan = planName ? said(planName, 80) : null;
  return {
    type: 'PAYMENT_RECEIVED',
    title: 'Payment Approved',
    body: `Your payment of ${paid} has been approved.`,
    metadata: { paymentId: payment.id },
    telegram: {
      en: `✅ Your bank transfer of ${paid} was approved.${plan ? ` Your *${plan}* plan has started.` : ''}`,
      am: `✅ የ${paid} የባንክ ዝውውርዎ ጸድቋል።${plan ? ` የ*${plan}* እቅድዎ ተጀምሯል።` : ''}`,
    },
    button: PLAN_BUTTON,
  };
}

export function transferRejectedNotice(
  payment: { id: string; amount: number; currency: string },
  reason: string | undefined,
): Notice {
  const paid = money(payment.amount / 100, payment.currency);
  const why = reason?.trim() ? `\n${said(reason)}` : '';
  return {
    type: 'PAYMENT_RECEIVED',
    title: 'Payment Rejected',
    body: `Your payment of ${paid} was rejected.${reason ? ` Reason: ${reason}` : ''}`,
    metadata: { paymentId: payment.id },
    telegram: {
      en: `❌ Your bank transfer of ${paid} wasn't approved.${why}\n\nIf you did pay, contact us with your receipt.`,
      am: `❌ የ${paid} የባንክ ዝውውርዎ አልጸደቀም።${why}\n\nክፍያ ፈጽመው ከሆነ ደረሰኝዎን ይዘው ያግኙን።`,
    },
    button: PLAN_BUTTON,
  };
}

/** A plan paid by Chapa (Telebirr, CBE Birr, card) has started. */
export function planPaidNotice(paymentId: string, planName: string, until: Date | null): Notice {
  const plan = said(planName, 80);
  const date = until?.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return {
    type: 'PAYMENT_RECEIVED',
    title: 'Payment received',
    body: `Your ${planName} plan is active${date ? ` until ${date}` : ''}.`,
    metadata: { paymentId },
    telegram: {
      en: `✅ Payment received. Your *${plan}* plan is active${date ? ` until ${date}` : ''}.`,
      am: `✅ ክፍያዎ ደርሷል። የ*${plan}* እቅድዎ${date ? ` እስከ ${date} ድረስ` : ''} ይሰራል።`,
    },
    button: PLAN_BUTTON,
  };
}

// ── Freelance ─────────────────────────────────────────────────────────────

type Project = { id: string; title: string; currency: string };

export function newBidNotice(project: Project, bidder: string, amount: number): Notice {
  const title = said(project.title, 150);
  const name = said(bidder, 80);
  const offer = money(amount, project.currency);
  return {
    type: 'FREELANCE_BID',
    title: 'New bid on your project',
    body: `${bidder} bid ${offer} on "${project.title}".`,
    metadata: { freelanceJobId: project.id },
    telegram: {
      en: `📨 New bid on *${title}* from ${name}: ${offer}.`,
      am: `📨 ለ*${title}* ከ${name} አዲስ ጨረታ ቀርቧል፦ ${offer}።`,
    },
    button: {
      text: { en: 'See the bids', am: 'ጨረታዎቹን ይመልከቱ' },
      web: `/freelance/${encodeURIComponent(project.id)}`,
    },
  };
}

export function bidAcceptedNotice(project: { title: string }, contractId: string): Notice {
  const title = said(project.title, 150);
  return {
    type: 'FREELANCE_BID_ACCEPTED',
    title: 'Your bid was accepted',
    body: `Your bid on "${project.title}" was accepted. The contract has started.`,
    metadata: { contractId },
    telegram: {
      en: `🎉 Your bid on *${title}* was accepted. The contract has started: agree the milestones with the client.`,
      am: `🎉 ለ*${title}* ያቀረቡት ጨረታ ተቀባይነት አግኝቷል። ውሉ ተጀምሯል፤ የስራ ደረጃዎችን ከደንበኛው ጋር ይስማሙ።`,
    },
    button: {
      text: CONTRACT_BUTTON,
      web: `/freelance/contracts/${encodeURIComponent(contractId)}`,
    },
  };
}

export function bidNotChosenNotice(project: { id: string; title: string }): Notice {
  const title = said(project.title, 150);
  return {
    type: 'FREELANCE_BID_REJECTED',
    title: 'Your bid was not chosen',
    body: `Your bid on "${project.title}" wasn't chosen this time.`,
    metadata: { freelanceJobId: project.id },
    telegram: {
      en: `Your bid on *${title}* wasn't chosen this time. New projects are posted every day.`,
      am: `ለ*${title}* ያቀረቡት ጨረታ በዚህ ጊዜ አልተመረጠም። አዳዲስ ፕሮጀክቶች በየቀኑ ይለጠፋሉ።`,
    },
    button: { text: { en: 'Find projects', am: 'ፕሮጀክቶችን ይፈልጉ' }, web: '/freelance' },
  };
}

type Step = { contractId: string; project: string; milestone: string };

/** For the client: the freelancer proposed a milestone, which the client accepts first. */
export function milestoneProposedNotice(
  step: Step,
  freelancer: string,
  amount: number,
  currency: string,
): Notice {
  const project = said(step.project, 150);
  const milestone = said(step.milestone, 150);
  const name = said(freelancer, 80);
  const value = money(amount, currency);
  return {
    type: 'MILESTONE_PROPOSED',
    title: 'New milestone to review',
    body: `${freelancer} proposed "${step.milestone}" (${value}) on "${step.project}".`,
    metadata: { contractId: step.contractId },
    telegram: {
      en: `🧩 ${name} proposed a milestone on *${project}*: ${milestone} (${value}). Accept it before work on it starts.`,
      am: `🧩 ${name} ለ*${project}* የስራ ደረጃ አቅርቧል፦ ${milestone} (${value})። ስራው ከመጀመሩ በፊት ይቀበሉት።`,
    },
    button: {
      text: CONTRACT_BUTTON,
      web: `/freelance/contracts/${encodeURIComponent(step.contractId)}`,
    },
  };
}

/** For the freelancer: the client accepted or declined their proposed milestone. */
export function milestoneDecisionNotice(step: Step, accepted: boolean): Notice {
  const project = said(step.project, 150);
  const milestone = said(step.milestone, 150);
  return {
    type: accepted ? 'MILESTONE_ACCEPTED' : 'MILESTONE_DECLINED',
    title: accepted ? 'Milestone accepted' : 'Milestone declined',
    body: accepted
      ? `The client accepted "${step.milestone}" on "${step.project}".`
      : `The client declined "${step.milestone}" on "${step.project}". You can propose another.`,
    metadata: { contractId: step.contractId },
    telegram: accepted
      ? {
          en: `✅ The client accepted your milestone ${milestone} on *${project}*. You can start work on it.`,
          am: `✅ ደንበኛው በ*${project}* ላይ ያቀረቡትን የስራ ደረጃ (${milestone}) ተቀብሏል። ስራውን መጀመር ይችላሉ።`,
        }
      : {
          en: `The client declined your milestone ${milestone} on *${project}*. You can propose another one.`,
          am: `ደንበኛው በ*${project}* ላይ ያቀረቡትን የስራ ደረጃ (${milestone}) አልተቀበለም። ሌላ ማቅረብ ይችላሉ።`,
        },
    button: {
      text: CONTRACT_BUTTON,
      web: `/freelance/contracts/${encodeURIComponent(step.contractId)}`,
    },
  };
}

/** For the client: work was delivered for a milestone. */
export function workDeliveredNotice(step: Step, freelancer: string): Notice {
  const project = said(step.project, 150);
  const milestone = said(step.milestone, 150);
  const name = said(freelancer, 80);
  return {
    type: 'MILESTONE_SUBMITTED',
    title: 'Work delivered',
    body: `${freelancer} delivered "${step.milestone}" on "${step.project}". Review it.`,
    metadata: { contractId: step.contractId },
    telegram: {
      en: `📦 ${name} delivered the work for ${milestone} on *${project}*. Review it, then approve it or ask for changes.`,
      am: `📦 ${name} በ*${project}* ላይ የ${milestone} ስራን አስረክቧል። ይገምግሙትና ያጽድቁት ወይም ማስተካከያ ይጠይቁ።`,
    },
    button: {
      text: CONTRACT_BUTTON,
      web: `/freelance/contracts/${encodeURIComponent(step.contractId)}`,
    },
  };
}

/** For the freelancer: the client sent the work back with what to change. */
export function revisionRequestedNotice(step: Step, note: string): Notice {
  const project = said(step.project, 150);
  const milestone = said(step.milestone, 150);
  return {
    type: 'MILESTONE_REVISION_REQUESTED',
    title: 'Changes requested',
    body: `The client asked for changes to "${step.milestone}": ${note}`,
    metadata: { contractId: step.contractId },
    telegram: {
      en: `✏️ The client asked for changes to ${milestone} on *${project}*:\n${said(note)}`,
      am: `✏️ ደንበኛው በ*${project}* ላይ ${milestone} እንዲስተካከል ጠይቋል፦\n${said(note)}`,
    },
    button: {
      text: CONTRACT_BUTTON,
      web: `/freelance/contracts/${encodeURIComponent(step.contractId)}`,
    },
  };
}

/** For the other side of the contract: a dispute holds its payments until an admin decides. */
export function disputeOpenedNotice(contractId: string, projectTitle: string): Notice {
  const project = said(projectTitle, 150);
  return {
    type: 'DISPUTE_OPENED',
    title: 'A dispute was opened',
    body: `A dispute was opened on "${projectTitle}". Payments are on hold until an admin reviews it.`,
    metadata: { contractId },
    telegram: {
      en: `⚠️ A dispute was opened on *${project}*. Payments on this contract are on hold until an admin reviews it.`,
      am: `⚠️ በ*${project}* ላይ ክርክር ተከፍቷል። አስተዳዳሪ እስኪመረምረው ድረስ የዚህ ውል ክፍያዎች ተይዘዋል።`,
    },
    button: {
      text: CONTRACT_BUTTON,
      web: `/freelance/contracts/${encodeURIComponent(contractId)}`,
    },
  };
}
