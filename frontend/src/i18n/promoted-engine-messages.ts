/** Keys used by the Promoted Engine UI (Boost modal + campaigns dashboard) and kept separate from component markup. */
export type PromotedEngineMessageKey =
  | 'promotedEngine.boostNow'
  | 'promotedEngine.modalTitle'
  | 'promotedEngine.cpcBidLabel'
  | 'promotedEngine.dailyBudgetLabel'
  | 'promotedEngine.totalBudgetLabel'
  | 'promotedEngine.totalBudgetOptional'
  | 'promotedEngine.endDateLabel'
  | 'promotedEngine.endDateOptional'
  | 'promotedEngine.submit'
  | 'promotedEngine.submitting'
  | 'promotedEngine.cancel'
  | 'promotedEngine.createError'
  | 'promotedEngine.insufficientFunds'
  | 'promotedEngine.dashboardTitle'
  | 'promotedEngine.noCampaigns'
  | 'promotedEngine.status'
  | 'promotedEngine.impressions'
  | 'promotedEngine.clicks'
  | 'promotedEngine.ctr'
  | 'promotedEngine.spent'
  | 'promotedEngine.pause'
  | 'promotedEngine.resume'
  | 'promotedEngine.cancelCampaign'
  | 'promotedEngine.confirmCancel';

/** Currently shipped UI locales; new locale bundles can be added without changing components. */
export type SupportedLocale = 'en' | 'am';

const promotedEngineMessages: Record<SupportedLocale, Record<PromotedEngineMessageKey, string>> = {
  en: {
    'promotedEngine.boostNow': 'Boost Now',
    'promotedEngine.modalTitle': 'Boost your visibility',
    'promotedEngine.cpcBidLabel': 'Cost per click',
    'promotedEngine.dailyBudgetLabel': 'Daily budget',
    'promotedEngine.totalBudgetLabel': 'Total budget',
    'promotedEngine.totalBudgetOptional': 'Total budget (optional)',
    'promotedEngine.endDateLabel': 'End date',
    'promotedEngine.endDateOptional': 'End date (optional)',
    'promotedEngine.submit': 'Start campaign',
    'promotedEngine.submitting': 'Starting…',
    'promotedEngine.cancel': 'Cancel',
    'promotedEngine.createError': "Couldn't start the campaign",
    'promotedEngine.insufficientFunds': 'Insufficient wallet balance to fund this campaign.',
    'promotedEngine.dashboardTitle': 'My Campaigns',
    'promotedEngine.noCampaigns': "You haven't started any campaigns yet.",
    'promotedEngine.status': 'Status',
    'promotedEngine.impressions': 'Impressions',
    'promotedEngine.clicks': 'Clicks',
    'promotedEngine.ctr': 'CTR',
    'promotedEngine.spent': 'Spent',
    'promotedEngine.pause': 'Pause',
    'promotedEngine.resume': 'Resume',
    'promotedEngine.cancelCampaign': 'Cancel campaign',
    'promotedEngine.confirmCancel': 'Cancel this campaign? This cannot be undone.',
  },
  am: {
    'promotedEngine.boostNow': 'አሁን አስተዋውቅ',
    'promotedEngine.modalTitle': 'ታይነትዎን ያሳድጉ',
    'promotedEngine.cpcBidLabel': 'በክሊክ ዋጋ',
    'promotedEngine.dailyBudgetLabel': 'የቀን በጀት',
    'promotedEngine.totalBudgetLabel': 'ጠቅላላ በጀት',
    'promotedEngine.totalBudgetOptional': 'ጠቅላላ በጀት (አማራጭ)',
    'promotedEngine.endDateLabel': 'የማብቂያ ቀን',
    'promotedEngine.endDateOptional': 'የማብቂያ ቀን (አማራጭ)',
    'promotedEngine.submit': 'ዘመቻ ጀምር',
    'promotedEngine.submitting': 'በመጀመር ላይ…',
    'promotedEngine.cancel': 'ይቅር',
    'promotedEngine.createError': 'ዘመቻውን መጀመር አልተቻለም',
    'promotedEngine.insufficientFunds': 'ይህን ዘመቻ ለመደገፍ በቂ ቀሪ ሂሳብ የለም።',
    'promotedEngine.dashboardTitle': 'የእኔ ዘመቻዎች',
    'promotedEngine.noCampaigns': 'እስካሁን ምንም ዘመቻ አልጀመሩም።',
    'promotedEngine.status': 'ሁኔታ',
    'promotedEngine.impressions': 'ዕይታዎች',
    'promotedEngine.clicks': 'ክሊኮች',
    'promotedEngine.ctr': 'CTR',
    'promotedEngine.spent': 'ወጪ',
    'promotedEngine.pause': 'አቁም',
    'promotedEngine.resume': 'ቀጥል',
    'promotedEngine.cancelCampaign': 'ዘመቻ ይቅር',
    'promotedEngine.confirmCancel': 'ይህን ዘመቻ ይቅር? ይህ መልሶ ሊቀር አይችልም።',
  },
};

/**
 * Returns a translated Promoted Engine label with English as the stable fallback.
 *
 * @param locale - requested document locale
 * @param key - extractable message key
 * @param vars - optional `{token}` substitutions applied to the resolved string
 */
export function translatePromotedEngineMessage(
  locale: string,
  key: PromotedEngineMessageKey,
  vars?: Record<string, string | number>,
): string {
  const supportedLocale: SupportedLocale = locale === 'am' ? 'am' : 'en';
  let message = promotedEngineMessages[supportedLocale][key];

  if (vars) {
    for (const [token, value] of Object.entries(vars)) {
      message = message.replace(`{${token}}`, String(value));
    }
  }

  return message;
}