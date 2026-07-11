import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ReviewModule } from './review.module';

/**
 * Integration test: boots the ReviewModule inside a real Nest
 * application context (same as production wiring in AppModule) to
 * confirm the controller, service, and repository resolve correctly
 * through Dependency Injection, and that the global ValidationPipe
 * correctly rejects invalid input end-to-end.
 */
describe('ReviewModule (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ReviewModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a review through the full HTTP -> controller -> service -> repository path', async () => {
    const payload = {
      freelancerId: '11111111-1111-4111-8111-111111111111',
      customerId: '22222222-2222-4222-8222-222222222222',
      rating: 4,
      comment: 'Great communication throughout the project.',
      locale: 'fr-FR',
      transactionCurrency: 'EUR',
      gdprConsentGiven: true,
    };

    const response = await request(app.getHttpServer())
      .post('/reviews')
      .send(payload)
      .expect(201);

    expect(response.body).toMatchObject({
      freelancerId: payload.freelancerId,
      rating: 4,
      transactionCurrency: 'EUR',
    });
  });

  it('rejects an invalid payload (rating out of range) with 400', async () => {
    const invalidPayload = {
      freelancerId: '11111111-1111-4111-8111-111111111111',
      customerId: '22222222-2222-4222-8222-222222222222',
      rating: 9, // invalid: must be 1-5
      comment: 'Too high a rating.',
      locale: 'en-US',
      transactionCurrency: 'USD',
      gdprConsentGiven: true,
    };

    await request(app.getHttpServer())
      .post('/reviews')
      .send(invalidPayload)
      .expect(400);
  });
});
