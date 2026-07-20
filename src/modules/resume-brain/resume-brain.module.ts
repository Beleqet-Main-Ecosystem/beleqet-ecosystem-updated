import { Module } from '@nestjs/common';
import { ResumeBrainService } from './resume-brain.service';
import { ResumeBrainController } from './resume-brain.controller';
import { DocumentParserService } from './document-parser.service';
import { AIExtractorService } from './ai-extractor.service';
import { AiBudgetService } from './ai-budget.service';
import { ResumeValidatorService } from './resume-validator.service';
import { ProfileMapperService } from './profile-mapper.service';
import { AI_CHAT_PROVIDER } from './ai/ai-chat-provider.interface';
import { GroqProvider } from './ai/groq.provider';

@Module({
  providers: [
    ResumeBrainService,
    DocumentParserService,
    AIExtractorService,
    AiBudgetService,
    ResumeValidatorService,
    ProfileMapperService,
    // The active AI provider lives behind a token so it can be swapped for a
    // GeminiProvider later without touching AIExtractorService.
    { provide: AI_CHAT_PROVIDER, useClass: GroqProvider },
  ],
  controllers: [ResumeBrainController],
})
export class ResumeBrainModule {}
