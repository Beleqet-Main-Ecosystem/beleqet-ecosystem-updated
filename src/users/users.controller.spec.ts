// src/users/users.controller.spec.ts

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app.module';

/**
 * Integration test suite for UsersController.
 * @group integration
 * @description Validates HTTP endpoints, input validation (class-validator), and i18n headers.
 */
describe('UsersController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Enable global validation pipe (to test class-validator)
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Test GET /users.
   * Verifies pagination and internationalization (Accept-Language header).
   */
  it('should return paginated users with i18n translation', async () => {
    const response = await request(app.getHttpServer())
      .get('/users?limit=10')
      .set('Accept-Language', 'am') // Testing i18n
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.message).toBeDefined(); // Translated message
  });

  /**
   * Test GDPR compliance: Ensure password is never exposed.
   */
  it('should not expose sensitive fields like password for GDPR', async () => {
    const response = await request(app.getHttpServer())
      .get('/users/1')
      .expect(200);

    expect(response.body).not.toHaveProperty('password');
    expect(response.body).not.toHaveProperty('ssn');
  });
});