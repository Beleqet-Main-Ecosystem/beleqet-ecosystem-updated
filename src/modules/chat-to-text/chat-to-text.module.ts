import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ChatToTextService } from './chat-to-text.service';
import { ChatToTextController } from './chat-to-text.controller';
import { FasterWhisperService } from './faster-whisper.service';

@Module({
  imports: [PrismaModule],
  controllers: [ChatToTextController],
  providers: [ChatToTextService, FasterWhisperService],
  exports: [ChatToTextService],
})
export class ChatToTextModule {}
