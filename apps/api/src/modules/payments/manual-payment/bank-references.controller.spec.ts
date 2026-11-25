import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BankReferencesController } from './bank-references.controller';
import { ManualPaymentService } from './manual-payment.service';

describe('BankReferencesController', () => {
  const settings: Record<string, string | undefined> = {};
  const service = { claimBankReference: jest.fn().mockResolvedValue({ claimed: true }) };
  const controller = new BankReferencesController(
    service as unknown as ManualPaymentService,
    { get: (key: string) => settings[key] } as unknown as ConfigService,
  );
  const body = { reference: 'FT26329AB12C', usedBy: 'promotion:7' };

  beforeEach(() => {
    service.claimBankReference.mockClear();
    settings.BANK_REFERENCES_SECRET = 'shared-secret';
  });

  it('takes the claim with the shared secret', async () => {
    await expect(controller.claim('shared-secret', body)).resolves.toEqual({ claimed: true });
    expect(service.claimBankReference).toHaveBeenCalledWith('FT26329AB12C', 'promotion:7');
  });

  it('refuses a wrong or missing secret, and everything while none is set', () => {
    expect(() => controller.claim('wrong', body)).toThrow(ForbiddenException);
    expect(() => controller.claim(undefined, body)).toThrow(ForbiddenException);
    settings.BANK_REFERENCES_SECRET = '';
    expect(() => controller.claim('', body)).toThrow(ForbiddenException);
    expect(service.claimBankReference).not.toHaveBeenCalled();
  });
});
