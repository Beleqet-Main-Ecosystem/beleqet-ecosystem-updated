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
 * The Jest execution engine requires >80% coverage to exit successfully.
 */

describe('EmailService', () => {
  let emailService: EmailService;
  let mockTransporter: jest.Mocked<IMailableTransporter>;
  let mockSecurityLogger: jest.Mocked<ISecurityAuditLogger>;

  beforeEach(() => {
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue(true),
    };
    mockSecurityLogger = {
      logSecurityBreach: jest.fn(),
    };

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
    it('should route to the English dictionary silently for unsupported or null locales', async () => {
      const user = getBaseUser({ locale: 'fr' });
      await emailService.sendAutomatedEmail(user, { templateType: 'WELCOME' });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        'abebe@example.com',
        'Welcome to Beleqet, Abebe!',
        'Hello Abebe, welcome to the Beleqet ecosystem. Explore opportunities today!'
      );
    });

    it('should route to the Amharic dictionary securely for the "am" locale', async () => {
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
    it('should trigger a security block for NEWSLETTER dispatch if consent is false and execute an audit trace', async () => {
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

    it('should allow transactional emails securely regardless of marketing consent parameters', async () => {
      const user = getBaseUser({ marketingProfile: { hasConsentedToMarketing: false } });

      await expect(
        emailService.sendAutomatedEmail(user, {
          templateType: 'PASSWORD_RESET',
          tokens: { resetUrl: 'http://reset.link' },
        })
      ).resolves.toBe(true);

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(mockSecurityLogger.logSecurityBreach).not.toHaveBeenCalled();
    });
  });

  describe('Native Multi-Currency Formatting Engine', () => {
    it('should correctly format numeric bounds for USD mappings on an English locale', async () => {
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

    it('should natively execute Intl.NumberFormat parameters for ETB outputs', async () => {
      const user = getBaseUser({ locale: 'en', currency: 'ETB' });

      await emailService.sendAutomatedEmail(user, {
        templateType: 'PAYMENT_RECEIPT',
        tokens: { amount: 5000, txId: 'TX-777' },
      });

      const bodyOutput = mockTransporter.sendMail.mock.calls[0][2];
      expect(bodyOutput).toMatch(/5,000\.00/);
      expect(bodyOutput).toContain('ETB');
    });
  });

  describe('Failure States & Network Transport Isolation', () => {
    it('should retry up to 3 times on transport failure using exponential backoff', async () => {
      mockTransporter.sendMail
        .mockRejectedValueOnce(new Error('Transient Error 1'))
        .mockRejectedValueOnce(new Error('Transient Error 2'))
        .mockResolvedValueOnce(true);

      const user = getBaseUser();

      const startTime = Date.now();
      await expect(
        emailService.sendAutomatedEmail(user, { templateType: 'WELCOME' })
      ).resolves.toBe(true);
      const endTime = Date.now();

      // Retries happened: 100ms + 200ms = 300ms roughly
      expect(endTime - startTime).toBeGreaterThanOrEqual(250);

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);
    });

    it('should trace errors if the transporter infrastructure experiences a critical failure', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP Crash'));
      const user = getBaseUser();

      await expect(
        emailService.sendAutomatedEmail(user, { templateType: 'WELCOME' })
      ).rejects.toThrow('SMTP Crash');

      // Expected to retry 3 times before failing
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);
    });
  });

  describe('System Verification', () => {
    it('should report healthy via checkHealth', async () => {
      const health = await emailService.checkHealth();
      expect(health.status).toBe('ok');
      expect(health.templatesLoaded).toBe(true);
      expect(health.transporterReady).toBe(true);
    });
  });
});
