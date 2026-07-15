/**
 * Abstraction over outbound email delivery. The auth module depends only
 * on this interface — plug in your real mailer (SendGrid, SES, nodemailer,
 * whatever the rest of the repo already uses) by providing a class that
 * implements this and binding it to {@link EMAIL_SENDER} in `auth.module.ts`.
 */
export interface IEmailSender {
  /**
   * Sends the "confirm linking this provider to your account" email.
   *
   * @param toEmail - The existing account's registered email address.
   * @param confirmationUrl - Full URL the user clicks to confirm (points
   *   at `GET /auth/:provider/link?token=...`).
   */
  sendAccountLinkConfirmation(toEmail: string, confirmationUrl: string): Promise<void>;
}

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');
