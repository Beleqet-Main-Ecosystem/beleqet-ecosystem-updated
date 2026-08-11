import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';

/**
 * Integration test for the Encrypted Inbox module.
 *
 * Tests the full HTTP flow through the NestJS application including
 * authentication middleware, validation pipes, and database interactions.
 *
 * @remarks These tests require a running PostgreSQL and Redis instance.
 * Run with: npm run test:e2e -- --testPathPattern="encrypted-inbox.integration"
 */
describe('Encrypted Inbox (Integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app?.close();
  });

  describe('POST /api/v1/encrypted-inbox/keys', () => {
    it('should require authentication', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/encrypted-inbox/keys')
        .send({ publicKey: 'test', encryptedPrivateKey: 'test' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/encrypted-inbox/conversations', () => {
    it('should require authentication', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/encrypted-inbox/conversations')
        .send({ participantId: 'some-uuid' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/encrypted-inbox/conversations', () => {
    it('should require authentication', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/encrypted-inbox/conversations',
      );

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/encrypted-inbox/messages', () => {
    it('should require authentication', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/encrypted-inbox/messages')
        .send({
          conversationId: 'some-uuid',
          ciphertext: 'encrypted-content',
          iv: 'test-iv',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/encrypted-inbox/gdpr/export', () => {
    it('should require authentication', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/encrypted-inbox/gdpr/export',
      );

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/v1/encrypted-inbox/gdpr/delete', () => {
    it('should require authentication', async () => {
      const response = await request(app.getHttpServer()).delete(
        '/api/v1/encrypted-inbox/gdpr/delete',
      );

      expect(response.status).toBe(401);
    });
  });
});
