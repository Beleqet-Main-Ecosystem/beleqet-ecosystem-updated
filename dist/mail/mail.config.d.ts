export interface MailEnvConfig {
    readonly smtpHost: string;
    readonly smtpPort: number;
    readonly smtpUser: string;
    readonly smtpPassword: string;
    readonly fromAddress: string;
}
export declare function loadMailEnvConfig(): MailEnvConfig;
