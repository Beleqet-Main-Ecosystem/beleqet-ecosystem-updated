import { Test, TestingModule } from '@nestjs/testing';
import { AdminControlModule } from '../admin-control.module';
import { EmailService } from '../email/email.service';

describe('AdminControlModule', () => {
  let moduleRef: TestingModule;
  let emailService: EmailService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AdminControlModule],
    }).compile();

    emailService = moduleRef.get<EmailService>(EmailService);
  });

  it('should compile the module and resolve the exported EmailService', () => {
    expect(emailService).toBeDefined();
    expect(emailService).toBeInstanceOf(EmailService);
  });

  it('should be able to invoke the dummy providers without throwing', async () => {
    const transporter = moduleRef.get('IMailableTransporter');
    const logger = moduleRef.get('ISecurityAuditLogger');

    expect(transporter).toBeDefined();
    expect(logger).toBeDefined();
    expect(await transporter.sendMail()).toBe(true);
    expect(() => logger.logSecurityBreach()).not.toThrow();
  });
});
