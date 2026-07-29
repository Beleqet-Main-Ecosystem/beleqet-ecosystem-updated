"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCORING = exports.VIDEO_INTERVIEW_JOBS = exports.TWO_FACTOR_JOBS = exports.WALLET_JOBS = exports.ESCROW_JOBS = exports.ANALYTICS_JOBS = exports.NOTIFICATION_JOBS = exports.APPLICATION_JOBS = exports.JOB_ALERT_JOBS = exports.REFERRAL_JOBS = exports.QUEUE_NAMES = void 0;
exports.QUEUE_NAMES = {
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
};
exports.REFERRAL_JOBS = {
    PROCESS_REFERRAL: 'process-referral',
    AWARD_BONUS: 'award-referral-bonus',
    EXPIRE_LINKS: 'expire-referral-links',
};
exports.JOB_ALERT_JOBS = {
    DISPATCH_ALERTS: 'dispatch-job-alerts',
    SEND_DIGEST: 'send-alert-digest',
};
exports.APPLICATION_JOBS = {
    SCREEN_CANDIDATE: 'screen-candidate',
    UPDATE_SCORE: 'update-candidate-score',
    NOTIFY_RECRUITER: 'notify-recruiter-new-application',
    SCHEDULE_INTERVIEW: 'schedule-interview',
};
exports.NOTIFICATION_JOBS = {
    SEND_IN_APP: 'send-in-app',
    SEND_TELEGRAM: 'send-telegram',
    SEND_EMAIL: 'send-email',
};
exports.ANALYTICS_JOBS = {
    UPDATE_JOB_STATS: 'update-job-stats',
    UPDATE_USER_STATS: 'update-user-stats',
    LOG_EVENT: 'log-platform-event',
};
exports.ESCROW_JOBS = {
    PROCESS_WEBHOOK: 'process-payment-webhook',
    AUTO_RELEASE: 'auto-release-milestone',
    UNLOCK_FUNDS: 'unlock-escrow-funds',
};
exports.WALLET_JOBS = {
    RELEASE_PENDING: 'release-pending',
    PROCESS_WITHDRAWAL: 'process-withdrawal',
};
exports.TWO_FACTOR_JOBS = {
    CLEANUP_EXPIRED_ENROLLMENT: 'cleanup-expired-enrollment',
};
exports.VIDEO_INTERVIEW_JOBS = {
    TRANSCRIBE: 'transcribe-video-response',
    EVALUATE: 'evaluate-interview',
    CLEANUP_EXPIRED: 'cleanup-expired-interviews',
    NOTIFY_COMPLETE: 'notify-interview-complete',
};
exports.SCORING = {
    AUTO_SHORTLIST_THRESHOLD: 75,
    AUTO_REJECT_THRESHOLD: 30,
};
//# sourceMappingURL=queues.constants.js.map