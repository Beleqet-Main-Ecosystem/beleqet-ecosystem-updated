import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { assertAllowedVideoUrl } from './ffmpeg.service';
import { CreateInterviewSessionDto } from './dto/create-interview-session.dto';
import { SubmitResponseDto } from './dto/submit-response.dto';
import { QUEUE_NAMES, VIDEO_INTERVIEW_JOBS } from '../queues/queues.constants';
import { ConfigService } from '@nestjs/config';

/** GDPR retention period: 90 days in milliseconds. */
const GDPR_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Core service for the AI Video Interview module.
 *
 * Responsibilities:
 * - Create / retrieve interview sessions.
 * - Accept video response submissions and enqueue Whisper transcription.
 * - Trigger Ollama evaluation once all responses are transcribed.
 * - Enforce GDPR deletion requests.
 *
 * Both Whisper and Ollama calls are wrapped in {@link CircuitBreakerService}
 * to prevent cascading failures when AI services are degraded.
 */
@Injectable()
export class VideoInterviewService {
  private readonly logger = new Logger(VideoInterviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_NAMES.VIDEO_INTERVIEW)
    private readonly videoQueue: Queue,
  ) {}

  // ── Session management ───────────────────────────────────────────────────

  /**
   * Create a new video interview session for an application.
   * Only one session per application is allowed (enforced by unique DB constraint).
   *
   * @param employerId  The employer creating the session.
   * @param dto         Session configuration (questions, schedule, expiry).
   * @param lang        i18n locale for error messages.
   */
  async createSession(
    employerId: string,
    dto: CreateInterviewSessionDto,
    lang = 'en',
  ) {
    const application = await this.prisma.application.findFirst({
      where: { id: dto.applicationId },
      include: {
        job: {
          select: {
            title: true,
            company: { select: { userId: true } },
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException(
        await this.i18n.t('video_interview.application_not_found', { lang }),
      );
    }

    // Only the employer who owns the job may create an interview
    if (application.job.company.userId !== employerId) {
      throw new ForbiddenException(
        await this.i18n.t('video_interview.forbidden', { lang }),
      );
    }

    const existing = await this.prisma.videoInterview.findUnique({
      where: { applicationId: dto.applicationId },
    });
    if (existing) {
      throw new ConflictException(
        await this.i18n.t('video_interview.already_exists', { lang }),
      );
    }

    const gdprDeleteAt = new Date(Date.now() + GDPR_RETENTION_MS);

    const session = await this.prisma.videoInterview.create({
      data: {
        applicationId: dto.applicationId,
        userId: application.userId,
        status: 'PENDING',
        metadata: {
          questions: dto.questions,
          locale: dto.locale ?? 'en',
          jobTitle: application.job.title ?? '',
        } as unknown as Prisma.InputJsonValue,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        gdprDeleteAt,
      },
    });

    this.logger.log(`Video interview session created: ${session.id}`);
    return session;
  }

  /**
   * Retrieve a session by ID.
   * Candidate can only view their own session; employers can view sessions for their jobs.
   *
   * @param sessionId  UUID of the VideoInterview.
   * @param userId     Caller's user ID (for authorization check).
   * @param lang       i18n locale.
   */
  async getSession(sessionId: string, userId: string, lang = 'en') {
    const session = await this.prisma.videoInterview.findUnique({
      where: { id: sessionId },
      include: {
        responses: { orderBy: { questionIndex: 'asc' } },
        evaluation: true,
      },
    });

    if (!session) {
      throw new NotFoundException(
        await this.i18n.t('video_interview.not_found', { lang }),
      );
    }

    // If GDPR-deleted, return tombstone message
    if (session.gdprDeleteAt && session.gdprDeleteAt < new Date() && session.status === 'EXPIRED') {
      throw new NotFoundException(
        await this.i18n.t('video_interview.gdpr_deleted', { lang }),
      );
    }

    if (session.userId !== userId) {
      throw new ForbiddenException(
        await this.i18n.t('video_interview.forbidden', { lang }),
      );
    }

    if (session.expiresAt && session.expiresAt < new Date()) {
      throw new BadRequestException(
        await this.i18n.t('video_interview.expired', { lang }),
      );
    }

    return session;
  }

  // ── Response submission ──────────────────────────────────────────────────

  /**
   * Submit a video response for a single question.
   * Enqueues a Whisper transcription job immediately.
   * When all questions are answered, triggers the Ollama evaluation job.
   *
   * @param sessionId  UUID of the VideoInterview.
   * @param userId     Candidate's user ID.
   * @param dto        Response payload (questionIndex + S3 videoUrl).
   * @param lang       i18n locale.
   */
  async submitResponse(
    sessionId: string,
    userId: string,
    dto: SubmitResponseDto,
    lang = 'en',
  ) {
    const session = await this.prisma.videoInterview.findUnique({
      where: { id: sessionId },
      include: { responses: true },
    });

    if (!session) {
      throw new NotFoundException(
        await this.i18n.t('video_interview.not_found', { lang }),
      );
    }
    if (session.userId !== userId) {
      throw new ForbiddenException(
        await this.i18n.t('video_interview.forbidden', { lang }),
      );
    }
    if (session.expiresAt && session.expiresAt < new Date()) {
      throw new BadRequestException(
        await this.i18n.t('video_interview.expired', { lang }),
      );
    }

    const metadata = session.metadata as { questions: { id: string; text: string; durationSec: number }[] };
    if (dto.questionIndex >= metadata.questions.length) {
      throw new BadRequestException(
        await this.i18n.t('video_interview.invalid_question_index', { lang }),
      );
    }

    // SSRF: only allow configured storage / CDN / API hosts
    assertAllowedVideoUrl(
      dto.videoUrl,
      this.config,
      await this.i18n.t('video_interview.invalid_video_url', { lang }),
    );

    const response = await this.prisma.videoResponse.upsert({
      where: {
        // Composite natural key via Prisma's @unique on [videoInterviewId, questionIndex]
        videoInterviewId_questionIndex: {
          videoInterviewId: sessionId,
          questionIndex: dto.questionIndex,
        },
      },
      update: {
        videoUrl: dto.videoUrl,
        language: dto.language ?? 'en',
        processingStatus: 'PENDING',
        transcript: null,
        // Prisma skips `undefined` — must use DbNull to clear JSONB PII on re-upload
        rawWhisperResponse: Prisma.DbNull,
      },
      create: {
        videoInterviewId: sessionId,
        questionIndex: dto.questionIndex,
        videoUrl: dto.videoUrl,
        language: dto.language ?? 'en',
        processingStatus: 'PENDING',
      },
    });

    // First response → IN_PROGRESS; re-record after eval → reset so a new EVALUATE can be claimed
    if (session.status === 'PENDING') {
      await this.prisma.videoInterview.update({
        where: { id: sessionId },
        data: { status: 'IN_PROGRESS' },
      });
    } else if (
      session.status === 'PROCESSING'
      || session.status === 'COMPLETED'
      || session.status === 'FAILED'
    ) {
      await this.prisma.$transaction([
        this.prisma.interviewEvaluation.deleteMany({
          where: { videoInterviewId: sessionId },
        }),
        this.prisma.videoInterview.update({
          where: { id: sessionId },
          data: { status: 'IN_PROGRESS' },
        }),
      ]);
    }

    // Enqueue Whisper transcription (wrapped in circuit breaker inside processor)
    await this.videoQueue.add(
      VIDEO_INTERVIEW_JOBS.TRANSCRIBE,
      { responseId: response.id, sessionId, lang },
      { attempts: 3, backoff: { type: 'exponential', delay: 5_000 } },
    );

    this.logger.log(`Transcription job queued for response ${response.id}`);
    return response;
  }

  // ── GDPR ─────────────────────────────────────────────────────────────────

  /**
   * Handle a GDPR data deletion request.
   * Marks the session EXPIRED, clears all PII from responses,
   * and removes evaluation data. Video files must be separately
   * deleted from S3 (handled by the scheduled cleanup job).
   *
   * @param sessionId  UUID of the VideoInterview.
   * @param userId     Requesting user — must be the session owner.
   * @param lang       i18n locale.
   */
  async requestGdprDeletion(sessionId: string, userId: string, lang = 'en') {
    const session = await this.prisma.videoInterview.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(
        await this.i18n.t('video_interview.not_found', { lang }),
      );
    }
    if (session.userId !== userId) {
      throw new ForbiddenException(
        await this.i18n.t('video_interview.forbidden', { lang }),
      );
    }

    // Immediate soft-delete: clear PII, mark as expired
    // NOTE: Prisma ignores `undefined` fields — use Prisma.DbNull to wipe JSONB
    await this.prisma.$transaction([
      this.prisma.videoResponse.updateMany({
        where: { videoInterviewId: sessionId },
        data: {
          transcript: null,
          rawWhisperResponse: Prisma.DbNull,
          videoUrl: null,
        },
      }),
      this.prisma.interviewEvaluation.deleteMany({
        where: { videoInterviewId: sessionId },
      }),
      this.prisma.videoInterview.update({
        where: { id: sessionId },
        data: { status: 'EXPIRED', gdprDeleteAt: new Date() },
      }),
    ]);

    this.logger.log(`GDPR deletion completed for session ${sessionId}`);
    return { message: await this.i18n.t('video_interview.gdpr_request_accepted', { lang }) };
  }

  // ── Admin / internal ─────────────────────────────────────────────────────

  /**
   * List all interview sessions for an application (employer view).
   *
   * @param applicationId  Application UUID.
   * @param employerId     Must own the job tied to this application.
   * @param lang           i18n locale.
   */
  async listByApplication(applicationId: string, employerId: string, lang = 'en') {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId },
      include: { job: { select: { company: { select: { userId: true } } } } },
    });

    if (!application) {
      throw new NotFoundException(
        await this.i18n.t('video_interview.application_not_found', { lang }),
      );
    }
    if (application.job.company.userId !== employerId) {
      throw new ForbiddenException(
        await this.i18n.t('video_interview.forbidden', { lang }),
      );
    }

    return this.prisma.videoInterview.findMany({
      where: { applicationId },
      include: {
        responses: { orderBy: { questionIndex: 'asc' } },
        evaluation: true,
      },
    });
  }
}
