import { IEmailSender } from '../interfaces/email-sender.interface';
export declare class ConsoleEmailSender implements IEmailSender {
    private readonly logger;
    sendAccountLinkConfirmation(toEmail: string, confirmationUrl: string): Promise<void>;
}
