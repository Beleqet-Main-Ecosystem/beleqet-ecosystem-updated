import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { timingSafeEqual } from 'crypto';
import { ClaimBankReferenceDto } from './dto/submit-manual-payment.dto';
import { ManualPaymentService } from './manual-payment.service';

/**
 * For the Promotion bot, which takes deposits into the same CBE account as Jobs: when its admin
 * approves a deposit, it records the transfer here first, so one transfer can't pay in both.
 * Only with the shared BANK_REFERENCES_SECRET; refused while it isn't set.
 */
@ApiExcludeController()
@Controller('bank-references')
export class BankReferencesController {
  constructor(
    private readonly manualPayments: ManualPaymentService,
    private readonly config: ConfigService,
  ) {}

  /** 200: recorded for this deposit. 409: the transfer already paid for something else. */
  @Post('claim')
  @HttpCode(HttpStatus.OK)
  claim(
    @Headers('x-bank-references-secret') secret: string | undefined,
    @Body() body: ClaimBankReferenceDto,
  ): Promise<{ claimed: true }> {
    const expected = this.config.get<string>('BANK_REFERENCES_SECRET')?.trim() ?? '';
    if (!expected || !secret || !sameSecret(secret, expected)) {
      throw new ForbiddenException('Not allowed');
    }
    return this.manualPayments.claimBankReference(body.reference, body.usedBy);
  }
}

function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
