import { Module } from '@nestjs/common';
import { EmailService } from './email/email.service';

/**
 * Mocks for dependencies that would normally be provided by the system.
 * These ensure the module compiles and can be integrated cleanly into the root framework.
 */
class DummyTransporter {
  async sendMail() { return true; }
}

class DummySecurityLogger {
  logSecurityBreach() {}
}

@Module({
  providers: [
    EmailService,
    { provide: 'IMailableTransporter', useClass: DummyTransporter },
    { provide: 'ISecurityAuditLogger', useClass: DummySecurityLogger },
  ],
  exports: [EmailService],
})
export class AdminControlModule {}
