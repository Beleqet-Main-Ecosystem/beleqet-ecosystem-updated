import * as bcrypt from 'bcryptjs';
import { GdprGuardService } from './gdpr-guard.service';

describe('GdprGuardService.eraseOwnAccount', () => {
  process.env.GDPR_ENCRYPTION_KEY =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const prisma = { user: { findUnique: jest.fn() }, contract: { count: jest.fn() } };
  const service = new GdprGuardService(prisma as never);
  const erase = jest
    .spyOn(service, 'executeDataErasure')
    .mockResolvedValue({ success: true } as never);
  let hash: string;

  beforeAll(async () => {
    hash = await bcrypt.hash('right-password', 4);
  });
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.contract.count.mockResolvedValue(0);
  });

  it('needs the right password', async () => {
    prisma.user.findUnique.mockResolvedValue({ passwordHash: hash });
    await expect(service.eraseOwnAccount('u1', 'wrong')).rejects.toThrow('not right');
    await expect(service.eraseOwnAccount('u1')).rejects.toThrow('not right');
    expect(erase).not.toHaveBeenCalled();
  });

  it('erases with the right password', async () => {
    prisma.user.findUnique.mockResolvedValue({ passwordHash: hash });
    await service.eraseOwnAccount('u1', 'right-password');
    expect(erase).toHaveBeenCalledWith('u1', expect.objectContaining({ actorUserId: 'u1' }));
  });

  it('lets a Google-only account delete without a password', async () => {
    prisma.user.findUnique.mockResolvedValue({ passwordHash: null });
    await service.eraseOwnAccount('u1');
    expect(erase).toHaveBeenCalled();
  });

  it('keeps the account while a contract is open', async () => {
    prisma.user.findUnique.mockResolvedValue({ passwordHash: hash });
    prisma.contract.count.mockResolvedValue(1);
    await expect(service.eraseOwnAccount('u1', 'right-password')).rejects.toThrow('open contracts');
    expect(erase).not.toHaveBeenCalled();
  });
});

describe('GdprGuardService.eraseOwnAccount with a linked Google account', () => {
  it('still asks for the password when the account has one', async () => {
    process.env.GDPR_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ passwordHash: await bcrypt.hash('pw', 4) }),
      },
      contract: { count: jest.fn() },
    };
    const service = new GdprGuardService(prisma as never);
    await expect(service.eraseOwnAccount('u1')).rejects.toThrow('not right');
  });
});
