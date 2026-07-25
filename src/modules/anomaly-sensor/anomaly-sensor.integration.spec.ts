import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { EventEmitterModule, EventEmitter2 } from '@nestjs/event-emitter';
import { AnomalySensorModule } from './anomaly-sensor.module';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaService } from '../../prisma/prisma.service';

describe('AnomalySensor Integration (e2e)', () => {
  let app: INestApplication;
  let eventEmitter: EventEmitter2;
  let prismaService: PrismaService;

  beforeAll(async () => {
    // Mock Prisma Service with currency-aware responses
    const mockPrismaService = {
      eventLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      escrowTransaction: {
        findMany: jest.fn().mockResolvedValue([
          { grossAmount: 100, currency: 'ETB' },
          { grossAmount: 150, currency: 'ETB' },
          { grossAmount: 120, currency: 'ETB' },
        ]),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventEmitterModule.forRoot(),
        // Fixed: Migrated 'redis' option to 'connection' for @nestjs/bullmq compatibility
        BullModule.forRoot({
          connection: { host: 'localhost', port: 6379 },
        }),
        BullModule.registerQueue({ name: 'notifications' }),
        AnomalySensorModule,
      ],
    })
      // Override the PrismaService from the module
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    eventEmitter = app.get<EventEmitter2>(EventEmitter2);
    prismaService = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should successfully receive auth.login.failed event and detect brute-force', async () => {
    const testEmail = 'integration_test@beleqet.com';

    // Fire 6 failed logins rapidly
    for (let i = 0; i < 6; i++) {
      eventEmitter.emit('auth.login.failed', {
        email: testEmail,
        timestamp: new Date().toISOString(),
      });
    }

    // Wait a short tick for event processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify it was logged in the EventLog via Prisma
    expect(prismaService.eventLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'ANOMALY_DETECTED',
          entityId: testEmail,
          payload: expect.objectContaining({
            type: 'AUTH_BRUTE_FORCE',
          }),
        }),
      }),
    );
  });

  it('should clear failure counter on auth.login.success and prevent false positives', async () => {
    const email = 'false_positive_test@beleqet.com';

    // Reset mock call counts
    (prismaService.eventLog.create as jest.Mock).mockClear();

    // Fire 5 failed logins (just under threshold)
    for (let i = 0; i < 5; i++) {
      eventEmitter.emit('auth.login.failed', {
        email,
        timestamp: new Date().toISOString(),
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 50));

    // User successfully logs in - should reset counter
    eventEmitter.emit('auth.login.success', {
      email,
      timestamp: new Date().toISOString(),
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    // One more failure after success should NOT trigger alert
    eventEmitter.emit('auth.login.failed', {
      email,
      timestamp: new Date().toISOString(),
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify no brute-force alert was dispatched for this email
    const bruteForceCallsForEmail = (prismaService.eventLog.create as jest.Mock).mock.calls.filter(
      (call) =>
        call[0]?.data?.entityId === email && call[0]?.data?.payload?.type === 'AUTH_BRUTE_FORCE',
    );
    expect(bruteForceCallsForEmail.length).toBe(0);
  });

  it('does NOT handle payment.escrow.initiated (Fix: duplicate anomaly alerting)', async () => {
    // Ownership of the payment.escrow.initiated event moved to
    // FraudAlertService so a single FraudAlert ticket is created per anomaly
    // instead of two disconnected systems (sensor writing EventLog + Slack
    // and fraud module creating the ticket). This test locks in that the
    // sensor no longer reacts to the event, preventing regression to the
    // duplicate-alerting behaviour.
    const clientId = 'integration-client-123';

    eventEmitter.emit('payment.escrow.initiated', {
      escrowId: 'new-tx',
      clientId,
      grossAmount: 5000,
      currency: 'ETB',
      timestamp: new Date().toISOString(),
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    // The sensor must not fetch escrow history for this event anymore...
    expect(prismaService.escrowTransaction.findMany).not.toHaveBeenCalled();

    // ...nor write a PAYMENT_UNUSUAL_AMOUNT anomaly log for it.
    const paymentAnomalyCalls = (prismaService.eventLog.create as jest.Mock).mock.calls.filter(
      (call) => call[0]?.data?.payload?.type === 'PAYMENT_UNUSUAL_AMOUNT',
    );
    expect(paymentAnomalyCalls.length).toBe(0);
  });
});
