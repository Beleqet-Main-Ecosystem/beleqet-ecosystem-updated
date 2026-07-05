import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '../queues/queues.constants';
import { VideoInterviewController } from './video-interview.controller';
import { VideoInterviewService } from './video-interview.service';
import { VideoInterviewProcessor } from './video-interview.processor';
import { CircuitBreakerService } from './circuit-breaker.service';

/**
 * AI Video Interview module.
 *
 * Registers:
 * - `video-interview` BullMQ queue for Whisper & Ollama background jobs.
 * - {@link CircuitBreakerService} — shared across service and processor.
 * - {@link VideoInterviewProcessor} — handles transcription, evaluation, cleanup.
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.VIDEO_INTERVIEW }),
  ],
  controllers: [VideoInterviewController],
  providers: [
    VideoInterviewService,
    VideoInterviewProcessor,
    CircuitBreakerService,
  ],
  exports: [VideoInterviewService, CircuitBreakerService],
})
export class VideoInterviewModule {}
