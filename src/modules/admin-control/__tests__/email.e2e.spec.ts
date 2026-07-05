import { EmailService } from '../email/email.service';
import {
  EmailUserContext,
  IMailableTransporter,
  ISecurityAuditLogger,
  GDPRConsentViolationException
} from '../email/email.types';

/**
 * @fileoverview Simulated End-to-End User Flow Trace for the Admin Control Email Engine.
 * Follows a programmatic validation lifecycle executing through a completely simulated platform journey.
 */

describe('E2E: Complete User Lifecycle Email Automation Pipeline', () => {
  let emailService: EmailService;
  let mockTransporter: jest.Mocked<IMailableTransporter>;
  let mockSecurityLogger: jest.Mocked<ISecurityAuditLogger>;

  beforeAll(() => {
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

  const testUser: EmailUserContext = {
    id: 'e2e_user_001',
    name: 'Chala',
    email: 'chala@e2e.com',
    locale: 'am', // Test Amharic Execution Path
    currency: 'ETB',
    marketingProfile: { hasConsentedToMarketing: true },
  };

  it('Pipeline Step 1: User Registration Execution -> Triggers Amharic Welcome Matrix', async () => {
    await emailService.sendAutomatedEmail(testUser, { templateType: 'WELCOME' });

    expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      testUser.email,
      'እንኳን ወደ በልቀት በደህና መጡ፣ Chala!',
      'ሰላም Chala፣ እንኳን ወደ በልቀት ስነ-ምህዳር በደህና መጡ። ዛሬውኑ እድሎችን ያስሱ!'
    );
  });

  it('Pipeline Step 2: Payment Execution -> Triggers Multi-Currency Receipt Evaluation', async () => {
    await emailService.sendAutomatedEmail(testUser, {
      templateType: 'PAYMENT_RECEIPT',
      tokens: { amount: 1500, txId: 'TX-E2E-123' },
    });

    expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
    const textOutput = mockTransporter.sendMail.mock.calls[0][2];
    expect(textOutput).toMatch(/1,500\.00/);
    expect(textOutput).toContain('TX-E2E-123');
  });

  it('Pipeline Step 3: Marketing Opt-Out Event -> Validates Terminal Block on Newsletter Traversal', async () => {
    testUser.marketingProfile.hasConsentedToMarketing = false;

    await expect(
      emailService.sendAutomatedEmail(testUser, {
        templateType: 'NEWSLETTER',
        tokens: { newsletterContent: 'E2E Weekly Highlights' },
      })
    ).rejects.toThrow(GDPRConsentViolationException);

    expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    expect(mockSecurityLogger.logSecurityBreach).toHaveBeenCalledTimes(1);
  });

  it('Pipeline Step 4: Security Transaction -> Allows Password Reset Dispatch securely through Opt-Out Wall', async () => {
    expect(testUser.marketingProfile.hasConsentedToMarketing).toBe(false);

    await emailService.sendAutomatedEmail(testUser, {
      templateType: 'PASSWORD_RESET',
      tokens: { resetUrl: 'https://beleqet.com/reset/xyz' },
    });

    expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      testUser.email,
      'የበልቀት የይለፍ ቃልዎን ይቀይሩ',
      'ሰላም Chala፣ የይለፍ ቃልዎን ለመቀየር እባክዎ እዚህ ይጫኑ፡ https://beleqet.com/reset/xyz'
    );
  });
});
