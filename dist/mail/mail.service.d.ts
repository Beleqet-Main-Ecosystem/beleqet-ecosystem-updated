import { IEmailSender } from '../modules/auth/interfaces/email-sender.interface';
export declare class MailService implements IEmailSender {
    private readonly transporter;
    private readonly fromAddress;
    constructor();
    sendAccountLinkConfirmation(toEmail: string, confirmationUrl: string): Promise<void>;
}
