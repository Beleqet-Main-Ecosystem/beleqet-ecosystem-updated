"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCORING = exports.ESCROW_JOBS = exports.ANALYTICS_JOBS = exports.NOTIFICATION_JOBS = exports.APPLICATION_JOBS = exports.QUEUE_NAMES = void 0;
exports.QUEUE_NAMES = {
    APPLICATION: 'application-processing',
    NOTIFICATIONS: 'notifications',
    ANALYTICS: 'analytics',
    ESCROW: 'escrow',
    WALLET: 'wallet',
    SEARCH_INDEX: 'search-index',
    SCHEDULED: 'scheduled',
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
    PROCESS_WITHDRAWAL: 'process-wallet-withdrawal',
};
exports.SCORING = {
    AUTO_SHORTLIST_THRESHOLD: 75,
    AUTO_REJECT_THRESHOLD: 30,
};
//# sourceMappingURL=queues.constants.js.map