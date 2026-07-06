import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Modules Integration & Data Stability Test', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe()); // Validates incoming request DTOs
        await app.init();
    });

    it('Should safely hit the jobs endpoint and verify system stability', async () => {
        return request(app.getHttpServer())
            .get('/jobs') // Adjust based on actual API mapping route
            .expect((res) => {
                // The endpoint should either return 200 OK or 401/403 (Security Guards working)
                // But it should NEVER return 500 Internal Server Error (Data corruption indicator)
                const logicalStatuses = [200, 401, 403];
                expect(logicalStatuses).toContain(res.status);
            });
    });

    afterAll(async () => {
        await app.close();
    });
});