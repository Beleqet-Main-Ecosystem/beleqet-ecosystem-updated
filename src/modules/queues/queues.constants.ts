// =============================================================================
// Beleqet - BullMQ Queue & Job Type Constants
// All queue names and job types in one place to prevent typos across modules.
// =============================================================================

export const QUEUE_NAMES = {
  APPLICATION: 'application-processing',
  NOTIFICATIONS: 'notifications',
  ANALYTICS: 'analytics',
  ESCROW: 'escrow',
  WALLET: 'wallet',
  SEARCH_INDEX: 'search-index',
  SCHEDULED: 'scheduled',
  REFERRALS: 'referrals',
  JOB_ALERTS: 'job-alerts',
  VIDEO_INTERVIEW: 'video-interview',
} as const;

// Referral jobs
export const REFERRAL_JOBS = {
  PROCESS_REFERRAL: 'process-referral',
  AWARD_BONUS: 'award-referral-bonus',
  EXPIRE_LINKS: 'expire-referral-links',
} as const;

// Job alert jobs
export const JOB_ALERT_JOBS = {
  DISPATCH_ALERTS: 'dispatch-job-alerts',
  SEND_DIGEST: 'send-alert-digest',
} as const;

// Application workflow jobs
export const APPLICATION_JOBS = {
  SCREEN_CANDIDATE: 'screen-candidate',
  UPDATE_SCORE: 'update-candidate-score',
  NOTIFY_RECRUITER: 'notify-recruiter-new-application',
  SCHEDULE_INTERVIEW: 'schedule-interview',
} as const;

// Notification jobs
export const NOTIFICATION_JOBS = {
  SEND_IN_APP: 'send-in-app',
  SEND_TELEGRAM: 'send-telegram',
  SEND_EMAIL: 'send-email',
} as const;

// Analytics jobs
export const ANALYTICS_JOBS = {
  UPDATE_JOB_STATS: 'update-job-stats',
  UPDATE_USER_STATS: 'update-user-stats',
  LOG_EVENT: 'log-platform-event',
} as const;

// Escrow jobs
export const ESCROW_JOBS = {
  PROCESS_WEBHOOK: 'process-payment-webhook',
  AUTO_RELEASE: 'auto-release-milestone', // 3-day escrow hold release
  UNLOCK_FUNDS: 'unlock-escrow-funds',
} as const;

// Wallet jobs
export const WALLET_JOBS = {
  RELEASE_PENDING: 'release-pending',
  PROCESS_WITHDRAWAL: 'process-withdrawal',
} as const;

// Two-factor authentication jobs
export const TWO_FACTOR_JOBS = {
  CLEANUP_EXPIRED_ENROLLMENT: 'cleanup-expired-enrollment',
} as const;

// Video interview jobs
export const VIDEO_INTERVIEW_JOBS = {
  TRANSCRIBE: 'transcribe-video-response',
  EVALUATE: 'evaluate-interview',
  CLEANUP_EXPIRED: 'cleanup-expired-interviews',
  NOTIFY_COMPLETE: 'notify-interview-complete',
} as const;

// Scoring thresholds
export const SCORING = {
  /** Candidates above this threshold are automatically shortlisted */
  AUTO_SHORTLIST_THRESHOLD: 75,
  /** Candidates below this threshold are automatically rejected */
  AUTO_REJECT_THRESHOLD: 30,
} as const;
