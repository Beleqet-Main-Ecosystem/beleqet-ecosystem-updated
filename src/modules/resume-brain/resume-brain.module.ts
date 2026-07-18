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
    GroqProvider,
    { provide: AI_CHAT_PROVIDER, useExisting: GroqProvider },
  ],
  controllers: [ResumeBrainController],
  exports: [AI_CHAT_PROVIDER],
})
export class ResumeBrainModule {}
