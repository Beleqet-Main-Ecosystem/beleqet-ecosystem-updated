import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('GraphQL API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // We must apply the same global prefix that main.ts applies, because our
    // GraphqlConfigModule explicitly binds to '/api/v1/graphql'
    app.setGlobalPrefix('api/v1');
    
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should successfully execute the jobs query and return structured data', () => {
    const query = `
      query {
        jobs(query: { limit: 1 }) {
          items {
            id
            title
            featured
          }
          total
        }
      }
    `;
    
    return request(app.getHttpServer())
      .post('/api/v1/graphql')
      .send({ query })
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toBeDefined();
        expect(res.body.data.jobs).toBeDefined();
        expect(Array.isArray(res.body.data.jobs.items)).toBeTruthy();
      });
  });

  it('should enforce depth limits on deeply nested introspection or relationships', () => {
    // If our depth limit is 5, a query nesting beyond that will yield a 400 Bad Request
    const overlyNestedQuery = `
      query {
        jobs {
          items {
            company {
              jobs {
                items {
                  company {
                    jobs {
                      items {
                        id
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
    
    return request(app.getHttpServer())
      .post('/api/v1/graphql')
      .send({ query: overlyNestedQuery })
      .expect(400) // GraphQL depth-limit correctly blocks it
      .expect((res) => {
        expect(res.body.errors[0].message).toContain('exceeds maximum depth of 5');
      });
  });
});
