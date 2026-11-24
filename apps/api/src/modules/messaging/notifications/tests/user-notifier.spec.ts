import { UserNotifier, telegramNotice } from '../user-notifier';
import * as notices from '../notices';
import { chatMessageNotice, jobLiveNotice, licenceRejectedNotice } from '../notices';

function setup(user: Record<string, unknown> | null) {
  const prisma = {
    notification: { create: jest.fn().mockResolvedValue({}) },
    user: { findUnique: jest.fn().mockResolvedValue(user) },
  };
  const config = {
    get: jest.fn().mockReturnValue('https://beleqetjobs.com,https://admin.beleqetjobs.com'),
  };
  const queue = { add: jest.fn().mockResolvedValue({}) };
  const push = { sendToUser: jest.fn().mockResolvedValue(undefined) };
  const notifier = new UserNotifier(
    prisma as never,
    config as never,
    queue as never,
    push as never,
  );
  return { notifier, prisma, queue, push };
}

const telegramUser = (language = 'en', telegramEnabled = true) => ({
  telegramId: '712718884',
  notificationPreference: { telegramEnabled, language },
});

describe('UserNotifier', () => {
  it('puts it in the bell and on their phone, and sends it from the Jobs bot', async () => {
    const { notifier, prisma, queue, push } = setup(telegramUser());
    await notifier.notify('u1', jobLiveNotice({ id: 'j1', title: 'Accountant' }));

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        type: 'JOB_APPROVED',
        title: 'Your job is live',
        channel: 'IN_APP',
        metadata: { jobId: 'j1', path: '/job/j1' },
      }),
    });
    expect(push.sendToUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ title: 'Your job is live' }),
    );
    expect(queue.add).toHaveBeenCalledWith('send-telegram', {
      telegramId: '712718884',
      message: '✅ Your job *Accountant* is live and open for applications.',
      button: { text: 'See the job', url: 'https://beleqetjobs.com/tg/employer/jobs/j1' },
    });
  });

  it('writes to Telegram in their language, with a browser button where the Mini App has no screen', async () => {
    const { notifier, queue } = setup(telegramUser('am'));
    await notifier.telegram(
      'u1',
      chatMessageNotice('Sara Tesfaye', 'Are you free tomorrow?', 'r1'),
    );
    expect(queue.add).toHaveBeenCalledWith('send-telegram', {
      telegramId: '712718884',
      message: '💬 ከ*Sara Tesfaye* አዲስ መልዕክት፦\nAre you free tomorrow?',
      button: {
        text: 'ውይይቱን ይክፈቱ',
        url: 'https://beleqetjobs.com/messages?room=r1',
        browser: true,
      },
    });
  });

  it('sends nothing to Telegram without a linked account or with Telegram notices off', async () => {
    for (const user of [
      { telegramId: null, notificationPreference: null },
      telegramUser('en', false),
      null,
    ]) {
      const { notifier, prisma, queue } = setup(user);
      await notifier.notify('u1', jobLiveNotice({ id: 'j1', title: 'Accountant' }));
      expect(queue.add).not.toHaveBeenCalled();
      expect(prisma.notification.create).toHaveBeenCalled();
    }
  });

  it('never throws: a notice that fails must not undo what caused it', async () => {
    const { notifier, prisma, queue } = setup(telegramUser());
    prisma.notification.create.mockRejectedValue(new Error('database down'));
    queue.add.mockRejectedValue(new Error('redis down'));
    await expect(
      notifier.notify('u1', jobLiveNotice({ id: 'j1', title: 'A' })),
    ).resolves.toBeUndefined();
  });

  it('escapes what people typed, so it cannot break the Markdown message', () => {
    const notice = licenceRejectedNotice('Abebe_and*Sons', 'Blurry [photo]');
    const message = telegramNotice(telegramUser(), notice, 'https://beleqetjobs.com');
    expect(message?.message).toContain('*Abebe\\_and\\*Sons*');
    expect(message?.message).toContain('Blurry \\[photo\\]');
  });

  it('every notice has its message and button in English and Amharic', () => {
    const step = { contractId: 'c1', project: 'Logo', milestone: 'Draft' };
    const project = { id: 'g1', title: 'Logo', currency: 'ETB' };
    const payment = { id: 'p1', amount: 150000, currency: 'ETB' };
    const all = [
      notices.chatMessageNotice('Sara', 'Hi', 'r1'),
      notices.jobLiveNotice({ id: 'j1', title: 'A' }),
      notices.jobNeedsChangesNotice({ id: 'j1', title: 'A' }, 'Add the salary'),
      notices.licenceVerifiedNotice('Acme'),
      notices.licenceRejectedNotice('Acme', 'Expired'),
      notices.transferApprovedNotice(payment, 'Pro'),
      notices.transferRejectedNotice(payment, undefined),
      notices.planPaidNotice('p1', 'Pro', new Date('2026-12-24')),
      notices.newBidNotice(project, 'Sara', 5000),
      notices.bidAcceptedNotice(project, 'c1'),
      notices.bidNotChosenNotice(project),
      notices.milestoneProposedNotice(step, 'Sara', 2000, 'ETB'),
      notices.milestoneDecisionNotice(step, true),
      notices.milestoneDecisionNotice(step, false),
      notices.workDeliveredNotice(step, 'Sara'),
      notices.revisionRequestedNotice(step, 'Bigger logo'),
      notices.disputeOpenedNotice('c1', 'Logo'),
    ];
    for (const notice of all) {
      expect(notice.telegram.en && notice.telegram.am && notice.title && notice.body).toBeTruthy();
      expect(notice.button.text.en && notice.button.text.am).toBeTruthy();
      expect(notice.button.miniApp ?? notice.button.web).toMatch(/^\//);
    }
    expect(notices.transferApprovedNotice(payment, 'Pro').telegram.en).toBe(
      '✅ Your bank transfer of ETB 1,500 was approved. Your *Pro* plan has started.',
    );
  });
});
