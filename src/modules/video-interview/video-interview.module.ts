import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../queues/queues.constants';
import { VideoInterviewController } from './video-interview.controller';
import { VideoInterviewService } from './video-interview.service';
import { VideoInterviewProcessor } from './video-interview.processor';
import { CircuitBreakerService } from './circuit-breaker.service';
import { FfmpegService } from './ffmpeg.service';
import { QueryMonitorService } from './query-monitor.service';

/**
 * AI Video Interview module.
 *
 * Registers:
 * - `video-interview` BullMQ queue for Whisper & Ollama background jobs.
 * - {@link CircuitBreakerService} — CLOSED/OPEN/HALF_OPEN state machine.
 * - {@link FfmpegService} — audio extraction + metadata stripping for GDPR.
 * - {@link QueryMonitorService} — EXPLAIN ANALYZE on GIN index queries.
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
    FfmpegService,
    QueryMonitorService,
  ],
  exports: [VideoInterviewService, CircuitBreakerService, QueryMonitorService],
})
export class VideoInterviewModule {}
