import { applicantTelegram, employerNewApplicationTelegram } from './application-telegram';

describe('application Telegram messages', () => {
  const site = 'https://beleqetjobs.com';
  const seeker = (language = 'en', telegramEnabled = true, telegramId: string | null = '42') => ({
    telegramId,
    notificationPreference: { telegramEnabled, language },
  });

  it('confirms an application in the Jobs bot, with a button to My applications', () => {
    expect(applicantTelegram(seeker(), 'RECEIVED', 'Accountant', 'Abay PLC', site)).toEqual({
      telegramId: '42',
      message:
        "✅ Application sent: *Accountant* at Abay PLC.\nWe'll message you here when the employer reviews it.",
      button: { text: 'Track my applications', url: 'https://beleqetjobs.com/tg/applications' },
    });
  });

  it('speaks Amharic to people who chose it', () => {
    const payload = applicantTelegram(seeker('am'), 'SHORTLISTED', 'Accountant', 'Abay', site);
    expect(payload?.message).toBe('⭐ መልካም ዜና፦ ለ*Accountant* (Abay) በእጩዎች ዝርዝር ውስጥ ገብተዋል።');
    expect(payload?.button?.text).toBe('ማመልከቻዎቼን ይከታተሉ');
  });

  it('has a message for every status people are told about', () => {
    for (const status of [
      'SCREENING',
      'SHORTLISTED',
      'INTERVIEW_SCHEDULED',
      'OFFERED',
      'REJECTED',
    ]) {
      expect(applicantTelegram(seeker(), status, 'Job', 'Co', site)?.message).toContain('*Job*');
      expect(applicantTelegram(seeker('am'), status, 'Job', 'Co', site)?.message).toContain(
        '*Job*',
      );
    }
  });

  it('sends nothing without Telegram, with Telegram notices off, or for SUBMITTED and WITHDRAWN', () => {
    expect(applicantTelegram(seeker('en', true, null), 'RECEIVED', 'Job', 'Co', site)).toBeNull();
    expect(applicantTelegram(seeker('en', false), 'RECEIVED', 'Job', 'Co', site)).toBeNull();
    expect(applicantTelegram(seeker(), 'SUBMITTED', 'Job', 'Co', site)).toBeNull();
    expect(applicantTelegram(seeker(), 'WITHDRAWN', 'Job', 'Co', site)).toBeNull();
  });

  it('treats a missing preference as English with Telegram on', () => {
    const payload = applicantTelegram(
      { telegramId: '42', notificationPreference: null },
      'OFFERED',
      'Job',
      'Co',
      site,
    );
    expect(payload?.message).toBe('🎉 Congratulations! Co has offered you the job: *Job*.');
  });

  it('escapes Markdown in employer-written titles and names', () => {
    const payload = applicantTelegram(seeker(), 'SCREENING', 'Data_Entry *Clerk*', 'A_B', site);
    expect(payload?.message).toContain('*Data\\_Entry \\*Clerk\\**');
    expect(payload?.message).toContain('A\\_B');
  });

  it("links the employer to the job's applicants, on the website and in the Mini App", () => {
    expect(employerNewApplicationTelegram(seeker(), 'job-1', 'Driver', 'Abebe K', site)).toEqual({
      telegramId: '42',
      message:
        '📋 New application for *Driver*\nApplicant: Abebe K\n\nOn the website: https://beleqetjobs.com/employer?tab=applicants&job=job-1',
      button: { text: 'Review applicants', url: 'https://beleqetjobs.com/tg/employer/jobs/job-1' },
    });
    expect(
      employerNewApplicationTelegram(seeker('am'), 'job-1', 'Driver', 'Abebe', site)?.button?.text,
    ).toBe('አመልካቾችን ይመልከቱ');
    expect(
      employerNewApplicationTelegram(seeker('en', false), 'job-1', 'Driver', 'Abebe', site),
    ).toBeNull();
  });
});
