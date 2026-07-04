export declare const QUEUE_NAMES: {
    readonly APPLICATION: "application-processing";
    readonly NOTIFICATIONS: "notifications";
    readonly ANALYTICS: "analytics";
    readonly ESCROW: "escrow";
    readonly WALLET: "wallet";
    readonly SEARCH_INDEX: "search-index";
    readonly SCHEDULED: "scheduled";
};
export declare const APPLICATION_JOBS: {
    readonly SCREEN_CANDIDATE: "screen-candidate";
    readonly UPDATE_SCORE: "update-candidate-score";
    readonly NOTIFY_RECRUITER: "notify-recruiter-new-application";
    readonly SCHEDULE_INTERVIEW: "schedule-interview";
};
export declare const NOTIFICATION_JOBS: {
    readonly SEND_IN_APP: "send-in-app";
    readonly SEND_TELEGRAM: "send-telegram";
    readonly SEND_EMAIL: "send-email";
};
export declare const ANALYTICS_JOBS: {
    readonly UPDATE_JOB_STATS: "update-job-stats";
    readonly UPDATE_USER_STATS: "update-user-stats";
    readonly LOG_EVENT: "log-platform-event";
};
export declare const ESCROW_JOBS: {
    readonly PROCESS_WEBHOOK: "process-payment-webhook";
    readonly AUTO_RELEASE: "auto-release-milestone";
    readonly PROCESS_WITHDRAWAL: "process-wallet-withdrawal";
};
export declare const SCORING: {
    readonly AUTO_SHORTLIST_THRESHOLD: 75;
    readonly AUTO_REJECT_THRESHOLD: 30;
};
