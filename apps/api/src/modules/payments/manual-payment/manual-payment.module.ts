import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from '../../messaging/email-automation/email.module';
import { PrismaModule } from '../../../prisma/prisma.module';
import { UploadsModule } from '../../platform/uploads/uploads.module';
import { BankReferencesController } from './bank-references.controller';
import { CbeReceiptService } from './cbe-receipt.service';
import { ManualPaymentController } from './manual-payment.controller';
import { ManualPaymentService } from './manual-payment.service';

@Module({
  imports: [PrismaModule, UploadsModule, EmailModule, ConfigModule],
  controllers: [ManualPaymentController, BankReferencesController],
  providers: [ManualPaymentService, CbeReceiptService],
  exports: [ManualPaymentService],
})
export class ManualPaymentModule {}
