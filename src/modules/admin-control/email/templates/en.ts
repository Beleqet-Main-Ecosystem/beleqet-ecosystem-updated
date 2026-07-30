/**
 * @fileoverview English ('en') translation dictionary matrix for automated emails.
 */

export const enDictionary = {
  WELCOME: {
    subject: 'Welcome to Beleqet, {name}!',
    body: 'Hello {name}, welcome to the Beleqet ecosystem. Explore opportunities today!',
  },
  PASSWORD_RESET: {
    subject: 'Reset your Beleqet password',
    body: 'Hello {name}, please click here to reset your password: {resetUrl}',
  },
  PAYMENT_RECEIPT: {
    subject: 'Your Beleqet Payment Receipt - {txId}',
    body: 'Hello {name}, we have received your payment of {formattedAmount}. Thank you!',
  },
  NEWSLETTER: {
    subject: 'Beleqet Monthly Newsletter',
    body: 'Hello {name}, {newsletterContent} | To unsubscribe, click here: {unsubscribeUrl}',
  },
};
