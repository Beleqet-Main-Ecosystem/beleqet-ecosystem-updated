import { Module } from '@nestjs/common';
import { ResumeBrainService } from './resume-brain.service';
import { ResumeBrainController } from './resume-brain.controller';
import { DocumentParserService } from './document-parser.service';

@Module({
  providers: [ResumeBrainService, DocumentParserService],
  controllers: [ResumeBrainController],
})
export class ResumeBrainModule {}
