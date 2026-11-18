import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { UploadsModule } from '../uploads/uploads.module';
import { UsersModule } from '../users/users.module';
import { AI_CHAT_PROVIDER } from './ai/ai-chat-provider.interface';
import { GroqProvider } from './ai/groq.provider';
import { MockResumeExtractionProvider } from './extraction/mock-resume-extraction.provider';
import {
  OpenAiResumeExtractionProvider,
  resumeAiVendor,
} from './extraction/openai-resume-extraction.provider';
import { DocxParserService } from './parsers/docx-parser.service';
import { OcrFallbackService } from './parsers/ocr-fallback.service';
import { PdfParserService } from './parsers/pdf-parser.service';
import { ResumeParsingService } from './parsers/resume-parsing.service';
import { ProfilesController } from './profiles.controller';
import { ResumeBrainController } from './resume-brain.controller';
import { ResumeBrainService } from './resume-brain.service';

/**
 * NestJS module bundling CV upload, parsing, AI extraction, retrieval,
 * erasure, and profile autofill for the "Resume Brain" feature. The
 * extraction engine is swappable: Groq or OpenAI (see `resumeAiVendor`) when
 * that service's key is configured, otherwise a deterministic mock provider
 * (mirroring the `KycModule`'s `KycProvider` factory pattern).
 */
@Module({
  imports: [PrismaModule, ConfigModule, UploadsModule, UsersModule],
  controllers: [ResumeBrainController, ProfilesController],
  providers: [
    ResumeBrainService,
    ResumeParsingService,
    PdfParserService,
    DocxParserService,
    OcrFallbackService,
    MockResumeExtractionProvider,
    OpenAiResumeExtractionProvider,
    {
      provide: 'ResumeExtractionProvider',
      useFactory: (
        config: ConfigService,
        mockProvider: MockResumeExtractionProvider,
        openAiProvider: OpenAiResumeExtractionProvider,
      ) => {
        const keyName = resumeAiVendor(config) === 'groq' ? 'GROQ_API_KEY' : 'OPENAI_API_KEY';
        const apiKey = config.get<string>(keyName);
        const isProduction =
          config.get<string>('NODE_ENV') === 'production' || process.env.NODE_ENV === 'production';
        const isApiKeyMissingOrDummy =
          !apiKey || apiKey === 'dummy_key_for_testing' || apiKey === 'sk-...';

        if (isApiKeyMissingOrDummy) {
          if (isProduction) {
            throw new Error(
              `${keyName} is missing or set to a dummy value in production environment.`,
            );
          }
          return mockProvider;
        }
        return openAiProvider;
      },
      inject: [ConfigService, MockResumeExtractionProvider, OpenAiResumeExtractionProvider],
    },
    // Exported for SmartSkillTesterModule, which consumes this token
    // independently of the CV-parsing pipeline above.
    { provide: AI_CHAT_PROVIDER, useClass: GroqProvider },
  ],
  exports: [ResumeBrainService, AI_CHAT_PROVIDER],
})
export class ResumeBrainModule {}
