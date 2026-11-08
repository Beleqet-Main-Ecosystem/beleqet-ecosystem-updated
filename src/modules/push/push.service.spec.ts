import { BadRequestException } from '@nestjs/common';
import { PushService, pushPath } from './push.service';

describe('PushService', () => {
  const prisma = {
    pushToken: { upsert: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() },
    notificationPreference: { findUnique: jest.fn() },
  };
  const service = new PushService(prisma as never);
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as never;
    prisma.pushToken.findMany.mockResolvedValue([{ token: 'ExponentPushToken[abc]' }]);
    prisma.notificationPreference.findUnique.mockResolvedValue(null);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: [{ status: 'ok' }] }) });
  });

  it('stores an Expo token for the user and moves it if someone else signs in on the phone', async () => {
    await service.register('u1', 'ExponentPushToken[abc]');
    expect(prisma.pushToken.upsert).toHaveBeenCalledWith({
      where: { token: 'ExponentPushToken[abc]' },
      create: { userId: 'u1', token: 'ExponentPushToken[abc]', platform: 'android' },
      update: { userId: 'u1', platform: 'android' },
    });
  });

  it('refuses anything that is not an Expo push token', async () => {
    await expect(service.register('u1', 'https://evil.example')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.pushToken.upsert).not.toHaveBeenCalled();
  });

  it('only removes the token from its own account', async () => {
    await service.remove('u1', 'ExponentPushToken[abc]');
    expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', token: 'ExponentPushToken[abc]' },
    });
  });

  it('sends to every phone, with the screen to open', async () => {
    await service.sendToUser('u1', {
      title: 'Bid accepted',
      body: 'Open the contract',
      metadata: { contractId: 'c1' },
    });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent).toEqual([
      expect.objectContaining({
        to: 'ExponentPushToken[abc]',
        title: 'Bid accepted',
        body: 'Open the contract',
        data: { path: '/contract/c1' },
      }),
    ]);
  });

  it('sends nothing when the person turned in-app notifications off', async () => {
    prisma.notificationPreference.findUnique.mockResolvedValue({ inAppEnabled: false });
    await service.sendToUser('u1', { title: 'x', body: 'y' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forgets phones Expo says are no longer registered', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }],
      }),
    });
    await service.sendToUser('u1', { title: 'x', body: 'y' });
    expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ['ExponentPushToken[abc]'] } },
    });
  });

  it('never throws to the caller when Expo is down', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    await expect(service.sendToUser('u1', { title: 'x', body: 'y' })).resolves.toBeUndefined();
  });
});

describe('pushPath', () => {
  it('maps metadata to the app screen', () => {
    expect(pushPath({ roomId: 'r1' })).toBe('/chat/r1');
    expect(pushPath({ applicationId: 'a1' })).toBe('/applications');
    expect(pushPath({ paymentId: 'p1' })).toBe('/plan');
    expect(pushPath({ path: '/wallet' })).toBe('/wallet');
  });

  it('ignores links that leave the app', () => {
    expect(pushPath({ path: '//evil.example' })).toBeNull();
    expect(pushPath(null)).toBeNull();
  });
});
