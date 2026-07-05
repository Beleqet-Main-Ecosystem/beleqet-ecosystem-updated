import { Module } from '@nestjs/common';
import { HistoryService } from './history/history.service';
import { PlagiarismController } from './plagiarism.controller';
import { PlagiarismService } from './plagiarism.service';
import { JaccardStrategy } from './similarity.service.ts/jaccard.strategy';
import { SimilarityService } from './similarity.service.ts/similarity.service';
import { InternetSourceService } from './sources/internet-source.service';
import { PlatformSourceService } from './sources/platform-source.service';
import { TokenizerService } from './tokenizer/tokenizer.service';

@Module({
  controllers: [PlagiarismController],
  providers: [
    PlagiarismService,
    SimilarityService,
    JaccardStrategy,
    TokenizerService,
    PlatformSourceService,
    InternetSourceService,
    HistoryService,
  ],
  exports: [PlagiarismService],
})
export class PlagiarismModule {}
