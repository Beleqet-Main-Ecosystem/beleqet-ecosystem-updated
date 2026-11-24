import { NotFoundException } from '@nestjs/common';
import { AdminController } from './admin.controller';

/** Deciding on a trade licence tells the employer, on the bell, their phone and Telegram. */
describe('AdminController licence decisions', () => {
  function setup(waiting = true) {
    const prisma = {
      company: {
        updateMany: jest.fn().mockResolvedValue({ count: waiting ? 1 : 0 }),
        findUnique: jest.fn().mockResolvedValue({ name: 'Acme Trading', userId: 'emp1' }),
      },
    };
    const notifier = { notify: jest.fn().mockResolvedValue(undefined) };
    const controller = new AdminController(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      notifier as never,
    );
    return { controller, notifier };
  }

  it('tells the employer their licence is verified', async () => {
    const { controller, notifier } = setup();
    await controller.decideVerification('c1', { decision: 'VERIFIED' } as never);
    expect(notifier.notify).toHaveBeenCalledWith(
      'emp1',
      expect.objectContaining({
        type: 'COMPANY_VERIFIED',
        button: expect.objectContaining({ miniApp: '/tg/employer/company' }),
      }),
    );
  });

  it('tells them why it was rejected', async () => {
    const { controller, notifier } = setup();
    await controller.decideVerification('c1', {
      decision: 'REJECTED',
      note: ' The licence has expired ',
    } as never);
    const [userId, notice] = notifier.notify.mock.calls[0];
    expect(userId).toBe('emp1');
    expect(notice.type).toBe('COMPANY_VERIFICATION_REJECTED');
    expect(notice.telegram.en).toContain('The licence has expired');
  });

  it('tells nobody when there was no licence waiting', async () => {
    const { controller, notifier } = setup(false);
    await expect(
      controller.decideVerification('c1', { decision: 'VERIFIED' } as never),
    ).rejects.toThrow(NotFoundException);
    expect(notifier.notify).not.toHaveBeenCalled();
  });
});
