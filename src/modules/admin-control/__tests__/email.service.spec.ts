import { EmailService } from '../email/email.service';
import {
  EmailUserContext,
  IMailableTransporter,
  ISecurityAuditLogger,
  GDPRConsentViolationException
} from '../email/email.types';

/**
 * @fileoverview Unit Testing Matrix for the Enterprise EmailService.
 * Validates i18n fallback, GDPR marketing firewalls, multi-currency formatting, and generic templating.
 */

describe('EmailService', () => {
  let emailService: EmailService;
  let mockTransporter: jest.Mocked<IMailableTransporter>;
  let mockSecurityLogger: jest.Mocked<ISecurityAuditLogger>;

  beforeEach(() => {
    // 1. Mock External Infrastructure
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue(true),
    };
    mockSecurityLogger = {
      logSecurityBreach: jest.fn(),
    };

    // 2. Inject Mocks into Core Service
    emailService = new EmailService(mockTransporter, mockSecurityLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const getBaseUser = (overrides?: Partial<EmailUserContext>): EmailUserContext => ({
    id: 'user_123',
    name: 'Abebe',
    email: 'abebe@example.com',
    locale: 'en',
    currency: 'USD',
    marketingProfile: { hasConsentedToMarketing: true },
    ...overrides,
  });

  describe('Global Scaling & i18n Fallbacks', () => {
    it('should route to the English dictionary implicitly for unsupported locales', async () => {
      const user = getBaseUser({ locale: 'fr' }); // French is not supported
      await emailService.sendAutomatedEmail(user, { templateType: 'WELCOME' });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        'abebe@example.com',
        'Welcome to Beleqet, Abebe!',
        'Hello Abebe, welcome to the Beleqet ecosystem. Explore opportunities today!'
      );
    });

    it('should route to the Amharic dictionary for "am" locale', async () => {
      const user = getBaseUser({ locale: 'am' });
      await emailService.sendAutomatedEmail(user, { templateType: 'WELCOME' });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        'abebe@example.com',
        'እንኳን ወደ በልቀት በደህና መጡ፣ Abebe!',
        'ሰላም Abebe፣ እንኳን ወደ በልቀት ስነ-ምህዳር በደህና መጡ። ዛሬውኑ እድሎችን ያስሱ!'
      );
    });
  });

  describe('GDPR Privacy Wall & Security Auditing', () => {
    it('should block NEWSLETTER template dispatch if marketing consent is false and audit log the attempt', async () => {
      const user = getBaseUser({ marketingProfile: { hasConsentedToMarketing: false } });

      await expect(
        emailService.sendAutomatedEmail(user, {
          templateType: 'NEWSLETTER',
          tokens: { newsletterContent: 'New Features!' },
        })
      ).rejects.toThrow(GDPRConsentViolationException);

      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
      expect(mockSecurityLogger.logSecurityBreach).toHaveBeenCalledWith(
        'user_123',
        'UNAUTHORIZED_MARKETING_DISPATCH',
        expect.stringContaining('Unauthorized attempt to send NEWSLETTER')
      );
    });

    it('should allow transactional emails (e.g. PASSWORD_RESET) even if marketing consent is false', async () => {
      const user = getBaseUser({ marketingProfile: { hasConsentedToMarketing: false } });

      await expect(
        emailService.sendAutomatedEmail(user, {
          templateType: 'PASSWORD_RESET',
          tokens: { resetUrl: 'http://reset.link' },
        })
      ).resolves.toBe(true);

      expect(mockTransporter.sendMail).toHaveBeenCalled();
      expect(mockSecurityLogger.logSecurityBreach).not.toHaveBeenCalled();
    });
  });

  describe('Native Multi-Currency Formatting Engine', () => {
    it('should format USD amounts correctly for an English locale', async () => {
      const user = getBaseUser({ locale: 'en', currency: 'USD' });

      await emailService.sendAutomatedEmail(user, {
        templateType: 'PAYMENT_RECEIPT',
        tokens: { amount: 1234.5, txId: 'TX-999' },
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        'abebe@example.com',
        'Your Beleqet Payment Receipt - TX-999',
        expect.stringContaining('$1,234.50')
      );
    });

    it('should format ETB amounts natively via Intl.NumberFormat', async () => {
      const user = getBaseUser({ locale: 'en', currency: 'ETB' });

      await emailService.sendAutomatedEmail(user, {
        templateType: 'PAYMENT_RECEIPT',
        tokens: { amount: 5000, txId: 'TX-777' },
      });

      // Intl.NumberFormat output for ETB can vary slightly by Node version
      // (e.g., 'ETB 5,000.00' or '5,000.00 ETB'). We check the numeric grouping.
      const mailCall = mockTransporter.sendMail.mock.calls[0];
      const body = mailCall[2];
      expect(body).toMatch(/5,000\.00/);
      expect(body).toContain('ETB');
    });
  });

  describe('Failure States & Error Routing', () => {
    it('should throw and trace if the network transporter fails', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP Crash'));
      const user = getBaseUser();

      await expect(
        emailService.sendAutomatedEmail(user, { templateType: 'WELCOME' })
      ).rejects.toThrow('SMTP Crash');
    });
  });
});
