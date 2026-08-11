import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { I18nModule } from 'nestjs-i18n';
import * as path from 'path';
import * as request from 'supertest';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { UsersService } from '../users/users.service';
import { buildMinimalPdf } from './fixtures/build-pdf-fixture';
import { ProfilesController } from './profiles.controller';
import { ResumeBrainController } from './resume-brain.controller';
import { ResumeBrainService } from './resume-brain.service';
import { MockResumeExtractionProvider } from './extraction/mock-resume-extraction.provider';
import { DocxParserService } from './parsers/docx-parser.service';
import { OcrFallbackService } from './parsers/ocr-fallback.service';
import { PdfParserService } from './parsers/pdf-parser.service';
import { ResumeParsingService } from './parsers/resume-parsing.service';

// pdf-parse's vendored legacy pdf.js build is unreliable under ts-jest's module
// environment for hand-built fixture PDFs (verified independently against plain
// Node, where identical bytes parse correctly). Mocked to read the same text
// back out of the fixture buffer, so this e2e test still exercises the real
// HTTP upload -> validation -> storage -> extraction -> persistence -> retrieval
// pipeline against a real PDF-shaped fixture file, without depending on that
// third-party library's internals.
jest.mock('pdf-parse', () =>
  jest.fn((buffer: Buffer) => {
    const content = buffer.toString('latin1');
    const match = content.match(/Td \((.*?)\) Tj/);
    const text = match ? match[1].replace(/\\([()\\])/g, '$1') : '';
    return Promise.resolve({ text });
  }),
);

/**
 * In-memory stand-in for PrismaService covering only the models Resume Brain
 * touches, so this e2e test exercises real HTTP routing, validation, and
 * business logic without requiring a live PostgreSQL database.
 */
class InMemoryPrismaService {
  private resumeUploads = new Map<string, Record<string, unknown>>();
  private parsedResumes = new Map<string, Record<string, unknown>>();
  private idCounter = 0;

  private nextId(): string {
    this.idCounter += 1;
    return `id-${this.idCounter}`;
  }

  resumeUpload = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const record = { id: this.nextId(), createdAt: new Date(), updatedAt: new Date(), ...data };
      this.resumeUploads.set(record.id as string, record);
      return record;
    },
    findUnique: async ({
      where,
      include,
    }: {
      where: { id: string };
      include?: { parsedResume?: boolean };
    }) => {
      const record = this.resumeUploads.get(where.id);
      if (!record) return null;
      if (include?.parsedResume) {
        const parsed =
          [...this.parsedResumes.values()].find((p) => p.resumeUploadId === where.id) ?? null;
        return { ...record, parsedResume: parsed };
      }
      return record;
    },
    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const record = this.resumeUploads.get(where.id);
      const updated = { ...record, ...data };
      this.resumeUploads.set(where.id, updated);
      return updated;
    },
    delete: async ({ where }: { where: { id: string } }) => {
      this.resumeUploads.delete(where.id);
      return { id: where.id };
    },
  };

  parsedResume = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const record = { id: this.nextId(), createdAt: new Date(), updatedAt: new Date(), ...data };
      this.parsedResumes.set(record.id as string, record);
      return record;
    },
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.parsedResumes.get(where.id) ?? null,
  };

  eventLog = { create: async () => ({}) };

  $transaction = async (callback: (tx: unknown) => unknown) => callback(this);
}

describe('Resume Brain (e2e): upload -> parse -> retrieve', () => {
  let app: INestApplication;
  let authenticatedUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        I18nModule.forRoot({
          fallbackLanguage: 'en',
          loaderOptions: { path: path.join(__dirname, '../../i18n/'), watch: false },
        }),
      ],
      controllers: [ResumeBrainController, ProfilesController],
      providers: [
        ResumeBrainService,
        ResumeParsingService,
        PdfParserService,
        DocxParserService,
        OcrFallbackService,
        MockResumeExtractionProvider,
        { provide: 'ResumeExtractionProvider', useExisting: MockResumeExtractionProvider },
        { provide: PrismaService, useClass: InMemoryPrismaService },
        {
          provide: UploadsService,
          useValue: {
            uploadFile: async (file: { originalname: string }) => ({
              publicUrl: `https://storage.example.com/resumes/${file.originalname}`,
              key: `resumes/${file.originalname}`,
            }),
            deleteFile: async () => undefined,
          },
        },
        {
          provide: UsersService,
          useValue: { update: async (id: string, dto: unknown) => ({ id, ...(dto as object) }) },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { userId: authenticatedUserId, email: 'test@beleqet.com', role: 'JOB_SEEKER' };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    authenticatedUserId = 'user-1';
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an upload without consent', async () => {
    const pdf = buildMinimalPdf('Selam Tesfaye selam.tesfaye@example.com +251911223344');

    await request(app.getHttpServer())
      .post('/resumes/upload')
      .field('consent', 'false')
      .attach('file', pdf, 'resume.pdf')
      .expect(400);
  });

  it('uploads, parses, and retrieves a resume end-to-end', async () => {
    const pdf = buildMinimalPdf('Selam Tesfaye selam.tesfaye@example.com +251911223344');

    const uploadResponse = await request(app.getHttpServer())
      .post('/resumes/upload')
      .field('consent', 'true')
      .attach('file', pdf, 'resume.pdf')
      .expect(201);

    expect(uploadResponse.body.upload.status).toBe('PARSED');
    expect(uploadResponse.body.parsedResume.personalInfo.email).toBe('selam.tesfaye@example.com');

    const resumeId = uploadResponse.body.upload.id;

    const getResponse = await request(app.getHttpServer()).get(`/resumes/${resumeId}`).expect(200);

    expect(getResponse.body.id).toBe(resumeId);
    expect(getResponse.body.parsedResume.personalInfo.phone).toBe('+251911223344');
  });

  it('returns 403 for a resume owned by a different user', async () => {
    const pdf = buildMinimalPdf(
      'Another Person Software Engineer another@example.com +251900000000',
    );

    const uploadResponse = await request(app.getHttpServer())
      .post('/resumes/upload')
      .field('consent', 'true')
      .attach('file', pdf, 'resume.pdf')
      .expect(201);

    const resumeId = uploadResponse.body.upload.id;
    authenticatedUserId = 'a-different-user';

    await request(app.getHttpServer()).get(`/resumes/${resumeId}`).expect(403);

    authenticatedUserId = 'user-1';
  });

  it('rejects unsupported file types', async () => {
    await request(app.getHttpServer())
      .post('/resumes/upload')
      .field('consent', 'true')
      .attach('file', Buffer.from('not a resume'), {
        filename: 'resume.txt',
        contentType: 'text/plain',
      })
      .expect(400);
  });
});
