import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';

describe('AdvancedSearch E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/advanced-search (GET)', () => {
    it('should return empty results for no filters', () => {
      return request(app.getHttpServer())
        .get('/api/v1/advanced-search')
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('meta');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.meta).toHaveProperty('total');
          expect(res.body.meta).toHaveProperty('page');
          expect(res.body.meta).toHaveProperty('limit');
        });
    });

    it('should handle invalid price range', () => {
      return request(app.getHttpServer())
        .get('/api/v1/advanced-search')
        .query({ minPrice: 5000, maxPrice: 1000 })
        .expect(400);
    });

    it('should handle invalid rating', () => {
      return request(app.getHttpServer())
        .get('/api/v1/advanced-search')
        .query({ minRating: 6 })
        .expect(400);
    });

    it('should handle too many skills', () => {
      const skills = Array(21).fill('skill').join(',');
      return request(app.getHttpServer())
        .get('/api/v1/advanced-search')
        .query({ skills })
        .expect(400);
    });

    it('should handle invalid currency', () => {
      return request(app.getHttpServer())
        .get('/api/v1/advanced-search')
        .query({ currency: 'GBP' })
        .expect(400);
    });

    it('should handle pagination', () => {
      return request(app.getHttpServer())
        .get('/api/v1/advanced-search')
        .query({ page: 1, limit: 10 })
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.meta.page).toBe(1);
          expect(res.body.meta.limit).toBe(10);
        });
    });

    it('should handle invalid page', () => {
      return request(app.getHttpServer())
        .get('/api/v1/advanced-search')
        .query({ page: 0 })
        .expect(400);
    });

    it('should handle invalid limit', () => {
      return request(app.getHttpServer())
        .get('/api/v1/advanced-search')
        .query({ limit: 150 })
        .expect(400);
    });
  });

  describe('/advanced-search/filters (GET)', () => {
    it('should return available filters', () => {
      return request(app.getHttpServer())
        .get('/api/v1/advanced-search/filters')
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body).toHaveProperty('skills');
          expect(res.body).toHaveProperty('locations');
          expect(res.body).toHaveProperty('currencies');
          expect(res.body).toHaveProperty('priceRanges');
          expect(Array.isArray(res.body.skills)).toBe(true);
          expect(Array.isArray(res.body.locations)).toBe(true);
          expect(Array.isArray(res.body.currencies)).toBe(true);
          expect(Array.isArray(res.body.priceRanges)).toBe(true);
        });
    });
  });
});
