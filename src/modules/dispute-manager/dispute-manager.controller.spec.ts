import { validate } from 'class-validator';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { DisputeManagerController } from './dispute-manager.controller';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

/** Security metadata and request validation tests for the Dispute Manager HTTP boundary. */
describe('DisputeManagerController contract', () => {
  it('allows contract parties to create disputes with the required permission', () => {
    const handler = DisputeManagerController.prototype.create;
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['FREELANCER', 'EMPLOYER']);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual(['manage:disputes']);
  });

  it.each(['findAll', 'resolve'] as const)(
    'restricts %s to administrators with dispute permission',
    (method) => {
      const handler = DisputeManagerController.prototype[method];
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['ADMIN']);
      expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual(['manage:disputes']);
    },
  );

  it('rejects non-HTTPS evidence and unbounded dispute text', async () => {
    const dto = Object.assign(new CreateDisputeDto(), {
      contractId: 'b4ffdc3f-bf53-4c06-8ff9-86dc501d03e7',
      reason: 'short',
      evidenceUrls: ['http://unsafe.example/evidence.pdf'],
      lang: 'en',
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['reason', 'evidenceUrls']),
    );
  });

  it('requires positive integer refunds and their ISO currency', async () => {
    const dto = Object.assign(new ResolveDisputeDto(), {
      resolution: 'The employer receives a partial refund.',
      refundAmount: -1,
      lang: 'en',
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['refundAmount', 'refundCurrency']),
    );
  });
});
