export interface IEmailSender {
    sendAccountLinkConfirmation(toEmail: string, confirmationUrl: string): Promise<void>;
}
export declare const EMAIL_SENDER: unique symbol;
