import { escapeTelegramMarkdown } from '../../common/utils/telegram-escape';
import type { TelegramPayload } from '../notifications/notifications.processor';

/** The two languages the Jobs bot speaks; anything else is English. */
type BotLanguage = 'en' | 'am';

function botLanguage(value: string | null | undefined): BotLanguage {
  return value === 'am' ? 'am' : 'en';
}

/** 'RECEIVED' when someone applies, otherwise the application's new status. */
export type ApplicantEvent =
  'RECEIVED' | 'SCREENING' | 'SHORTLISTED' | 'INTERVIEW_SCHEDULED' | 'OFFERED' | 'REJECTED';

type Words = { job: string; company: string };

/** Uses the same words as the Mini App's tracker: Sent → Reviewed → Shortlisted → Interview. */
const APPLICANT_MESSAGES: Record<ApplicantEvent, Record<BotLanguage, (w: Words) => string>> = {
  RECEIVED: {
    en: ({ job, company }) =>
      `✅ Application sent: *${job}* at ${company}.\nWe'll message you here when the employer reviews it.`,
    am: ({ job, company }) => `✅ ማመልከቻዎ ተልኳል፦ *${job}* (${company})።\nአሰሪው ሲገመግመው እዚህ እናሳውቅዎታለን።`,
  },
  SCREENING: {
    en: ({ job, company }) => `👀 Your application for *${job}* at ${company} is being reviewed.`,
    am: ({ job, company }) => `👀 ለ*${job}* (${company}) ያስገቡት ማመልከቻ እየተገመገመ ነው።`,
  },
  SHORTLISTED: {
    en: ({ job, company }) => `⭐ Good news: you're on the shortlist for *${job}* at ${company}.`,
    am: ({ job, company }) => `⭐ መልካም ዜና፦ ለ*${job}* (${company}) በእጩዎች ዝርዝር ውስጥ ገብተዋል።`,
  },
  INTERVIEW_SCHEDULED: {
    en: ({ job, company }) =>
      `📅 ${company} wants to interview you for *${job}*. See your applications for the details.`,
    am: ({ job, company }) =>
      `📅 ${company} ለ*${job}* ቃለ መጠይቅ ሊያደርግልዎ ይፈልጋል። ዝርዝሩን በማመልከቻዎችዎ ውስጥ ይመልከቱ።`,
  },
  OFFERED: {
    en: ({ job, company }) => `🎉 Congratulations! ${company} has offered you the job: *${job}*.`,
    am: ({ job, company }) => `🎉 እንኳን ደስ አለዎት! ${company} ለ*${job}* የስራ ቅጥር ጥያቄ አቅርቦልዎታል።`,
  },
  REJECTED: {
    en: ({ job, company }) =>
      `Thank you for applying for *${job}* at ${company}. You weren't selected this time. New jobs are posted every day, so keep applying.`,
    am: ({ job, company }) =>
      `ለ*${job}* (${company}) ስላመለከቱ እናመሰግናለን። በዚህ ጊዜ አልተመረጡም። አዳዲስ ስራዎች በየቀኑ ይለጠፋሉ፤ ማመልከትዎን ይቀጥሉ።`,
  },
};

/** The applicant fields needed to reach them in the Jobs bot. */
export interface TelegramApplicant {
  telegramId: string | null;
  notificationPreference: { telegramEnabled: boolean; language: string } | null;
}

/**
 * The Jobs bot message telling a job seeker about one of their applications, in their language,
 * with a button that opens My applications in the Mini App. Null when they have no Telegram,
 * turned Telegram notifications off, or the status isn't one people are told about
 * (SUBMITTED, WITHDRAWN).
 */
export function applicantTelegram(
  user: TelegramApplicant,
  event: string,
  jobTitle: string,
  companyName: string,
  frontendUrl: string,
): TelegramPayload | null {
  const messages = APPLICANT_MESSAGES[event as ApplicantEvent];
  if (!messages || !user.telegramId || user.notificationPreference?.telegramEnabled === false) {
    return null;
  }
  const language = botLanguage(user.notificationPreference?.language);
  return {
    telegramId: user.telegramId,
    message: messages[language]({
      job: escapeTelegramMarkdown(jobTitle),
      company: escapeTelegramMarkdown(companyName),
    }),
    button: {
      text: language === 'am' ? 'ማመልከቻዎቼን ይከታተሉ' : 'Track my applications',
      url: `${frontendUrl}/tg/applications`,
    },
  };
}

/**
 * The employer's "new application" message: a link to the job's applicants on the website, and a
 * button that opens them in the Mini App.
 */
export function employerNewApplicationTelegram(
  employer: TelegramApplicant,
  jobId: string,
  jobTitle: string,
  applicantName: string,
  frontendUrl: string,
): TelegramPayload | null {
  if (!employer.telegramId || employer.notificationPreference?.telegramEnabled === false) {
    return null;
  }
  const job = escapeTelegramMarkdown(jobTitle);
  const name = escapeTelegramMarkdown(applicantName);
  const website = `${frontendUrl}/employer?tab=applicants&job=${encodeURIComponent(jobId)}`;
  const am = botLanguage(employer.notificationPreference?.language) === 'am';
  return {
    telegramId: employer.telegramId,
    message: am
      ? `📋 አዲስ ማመልከቻ ለ*${job}*\nአመልካች፦ ${name}\n\nበድረ-ገጹ ለማየት፦ ${website}`
      : `📋 New application for *${job}*\nApplicant: ${name}\n\nOn the website: ${website}`,
    button: {
      text: am ? 'አመልካቾችን ይመልከቱ' : 'Review applicants',
      url: `${frontendUrl}/tg/employer/jobs/${encodeURIComponent(jobId)}`,
    },
  };
}
