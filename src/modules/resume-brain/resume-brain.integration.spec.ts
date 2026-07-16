/**
 * Resume Brain — integration test (Phase 9).
 *
 * Wires the REAL Resume Brain pipeline end to end and proves it integrates with
 * the EXISTING UsersService without mocking any of the module's own logic:
 *
 *   upload PDF → DocumentParserService (real, pdf-parse mocked at the boundary)
 *              → AIExtractorService (real) → stub AiChatProvider (LLM boundary)
 *              → ResumeValidatorService (real) → ProfileMapperService (real)
 *              → UsersService.update (real) → PrismaService (mocked at the DB)
 *
 * Only the two true external edges are faked: the PDF binary reader and the
 * database driver. Everything between them is the production code path, so a
 * regression anywhere in parse/extract/validate/map/save is caught here.
 *
 * This is the "new module integrates with the existing system (User DB)"
 * stability check the task's Integration Testing requirement calls for.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

// Mock only the external binary readers, exactly as the parser's own spec does.
jest.mock('pdf-parse', () => ({ PDFParse: jest.fn() }));
jest.mock('mammoth', () => ({ extractRawText: jest.fn() }));
import { PDFParse } from 'pdf-parse';

import { ResumeBrainService, UploadedResumeFile } from './resume-brain.service';
import { DocumentParserService } from './document-parser.service';
import { AIExtractorService } from './ai-extractor.service';
import { AiBudgetService } from './ai-budget.service';
import { ResumeValidatorService } from './resume-validator.service';
import { ProfileMapperService } from './profile-mapper.service';
import {
  AI_CHAT_PROVIDER,
  AiChatProvider,
  AiCompletion,
} from './ai/ai-chat-provider.interface';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../../prisma/prisma.service';

const PDFParseMock = PDFParse as unknown as jest.Mock;

const RESUME_TEXT = [
  'Abebe Bikila',
  'Senior Software Engineer',
  'Addis Ababa, Ethiopia',
  'Email: abebe.bikila@example.com | Phone: +251911234567',
  'Skills: TypeScript, Node.js, NestJS, React',
].join('\n');

/** What a well-behaved LLM returns for RESUME_TEXT — raw JSON, no fences. */
const AI_JSON = JSON.stringify({
  firstName: 'Abebe',
  lastName: 'Bikila',
  email: 'abebe.bikila@example.com',
  phone: '+251911234567',
  summary: 'Senior software engineer with 8 years of experience.',
  headline: 'Senior Software Engineer',
  location: 'Addis Ababa, Ethiopia',
  skills: ['TypeScript', 'Node.js', 'NestJS', 'React'],
  languages: ['Amharic', 'English'],
  certifications: [],
  education: [
    { school: 'Addis Ababa University', qualification: 'BSc', year: '2016' },
  ],
  experience: [
    {
      role: 'Lead Engineer',
      company: 'Beleqet',
      start: '2021',
      end: 'Present',
      description: 'Built the resume pipeline.',
    },
  ],
});

/** Make the parser see `text` as the content of the next uploaded PDF. */
function mockPdfText(text: string) {
  PDFParseMock.mockImplementation(() => ({
    getText: jest.fn().mockResolvedValue({ text }),
    destroy: jest.fn().mockResolvedValue(undefined),
  }));
}

function pdfFile(): UploadedResumeFile {
  return {
    originalname: 'resume.pdf',
    mimetype: 'application/pdf',
    size: 2048,
    buffer: Buffer.from('%PDF-1.4 fake'),
  };
}

/** Wrap raw model text in the {content, usage} completion the provider returns. */
function completion(content: string): AiCompletion {
  return {
    content,
    usage: { promptTokens: 200, completionTokens: 80, totalTokens: 280 },
  };
}

describe('Resume Brain ↔ UsersService integration (Phase 9)', () => {
  let resumeBrain: ResumeBrainService;
  let users: UsersService;
  // In-memory stand-in for the User row the DB persists.
  let dbUser: Record<string, unknown>;
  let userUpdate: jest.Mock;
  // The LLM boundary — swappable per test.
  let aiComplete: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    dbUser = { id: 'user-001', email: 'abebe.bikila@example.com' };
    userUpdate = jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      Object.assign(dbUser, data);
      return { ...dbUser };
    });

    const prisma = {
      user: {
        update: userUpdate,
        findUnique: jest.fn(async () => ({ ...dbUser })),
      },
    } as unknown as PrismaService;

    aiComplete = jest.fn().mockResolvedValue(completion(AI_JSON));
    const stubProvider: AiChatProvider = {
      name: 'stub',
      complete: aiComplete,
    };

    // Budget is metered on a real Redis in production; here it is out of scope,
    // so a no-op stub keeps the test focused on parse→extract→validate→map→save.
    const budgetStub = {
      assertWithinBudget: jest.fn(),
      recordUsage: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ResumeBrainService,
        DocumentParserService,
        AIExtractorService,
        ResumeValidatorService,
        ProfileMapperService,
        UsersService,
        { provide: AiBudgetService, useValue: budgetStub },
        { provide: AI_CHAT_PROVIDER, useValue: stubProvider },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    resumeBrain = moduleRef.get(ResumeBrainService);
    users = moduleRef.get(UsersService);
  });

  it('runs upload → parse → AI → validate → map, then persists via UsersService', async () => {
    mockPdfText(RESUME_TEXT);

    // 1. Resume Brain prepares the data (its whole responsibility).
    const result = await resumeBrain.extractProfile(pdfFile());

    expect(result.provider).toBe('stub');
    expect(result.filename).toBe('resume.pdf');
    // Full structured profile drives the frontend autofill.
    expect(result.profile.firstName).toBe('Abebe');
    expect(result.profile.skills).toContain('NestJS');
    expect(result.profile.experience).toHaveLength(1);
    // Mapped payload is UpdateUserDto-shaped: summary→bio, no email/arrays.
    expect(result.userProfile).toEqual({
      firstName: 'Abebe',
      lastName: 'Bikila',
      phone: '+251911234567',
      headline: 'Senior Software Engineer',
      bio: 'Senior software engineer with 8 years of experience.',
      location: 'Addis Ababa, Ethiopia',
      skills: ['TypeScript', 'Node.js', 'NestJS', 'React'],
    });

    // 2. The EXISTING save flow persists it — Resume Brain never calls Prisma.
    const saved = await users.update('user-001', result.userProfile);

    // 3. Prisma received exactly the mapped fields and the DB reflects them.
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-001' },
        data: result.userProfile,
      }),
    );
    expect(saved).toMatchObject({
      firstName: 'Abebe',
      lastName: 'Bikila',
      headline: 'Senior Software Engineer',
      bio: 'Senior software engineer with 8 years of experience.',
      skills: ['TypeScript', 'Node.js', 'NestJS', 'React'],
    });

    // Read-back proves the update stuck (login email untouched by the mapper).
    const readBack = await users.findById('user-001');
    expect(readBack.email).toBe('abebe.bikila@example.com');
    expect(readBack.location).toBe('Addis Ababa, Ethiopia');
  });

  it('tolerates a fenced ```json reply from the model (real-world LLM output)', async () => {
    mockPdfText(RESUME_TEXT);
    aiComplete.mockResolvedValueOnce(completion('```json\n' + AI_JSON + '\n```'));

    const result = await resumeBrain.extractProfile(pdfFile());
    expect(result.profile.firstName).toBe('Abebe');

    await users.update('user-001', result.userProfile);
    expect(dbUser.headline).toBe('Senior Software Engineer');
  });

  it('rejects a non-resume with 400 and never touches the User DB', async () => {
    mockPdfText('hello world this is not a resume at all');
    // Model honestly returns an empty profile for junk input.
    aiComplete.mockResolvedValueOnce(
      completion(
        JSON.stringify({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          summary: '',
          headline: '',
          location: '',
          skills: [],
          languages: [],
          certifications: [],
          education: [],
          experience: [],
        }),
      ),
    );

    await expect(resumeBrain.extractProfile(pdfFile())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    // The validator stopped the pipeline before any DB write.
    expect(userUpdate).not.toHaveBeenCalled();
  });
});
