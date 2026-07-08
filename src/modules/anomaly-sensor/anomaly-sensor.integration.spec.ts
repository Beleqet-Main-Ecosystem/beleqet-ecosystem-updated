import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { EventEmitterModule, EventEmitter2 } from '@nestjs/event-emitter';
import { AnomalySensorModule } from './anomaly-sensor.module';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { PrismaService } from '../../prisma/prisma.service';

describe('AnomalySensor Integration (e2e)', () => {
  let app: INestApplication;
  let eventEmitter: EventEmitter2;
  let prismaService: PrismaService;

  beforeAll(async () => {
    // Mock Prisma Service
    const mockPrismaService = {
      eventLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      escrowTransaction: {
        findMany: jest.fn().mockResolvedValue([
          { grossAmount: 100 },
          { grossAmount: 150 },
          { grossAmount: 120 },
        ]),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventEmitterModule.forRoot(),
        BullModule.forRoot({
          redis: { host: 'localhost', port: 6379 }
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
        timestamp: new Date().toISOString()
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
            type: 'AUTH_BRUTE_FORCE'
          })
        })
      })
    );
  });

  it('should successfully receive payment.escrow.initiated and process multi-currency Z-score', async () => {
    const clientId = 'integration-client-123';
    
    // Emit event with large amount
    eventEmitter.emit('payment.escrow.initiated', {
      escrowId: 'new-tx',
      clientId,
      grossAmount: 5000,
      currency: 'USD',
      timestamp: new Date().toISOString()
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify it was logged
    expect(prismaService.eventLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'ANOMALY_DETECTED',
          entityId: clientId,
          payload: expect.objectContaining({
            type: 'PAYMENT_UNUSUAL_AMOUNT'
          })
        })
      })
    );
  });
});
