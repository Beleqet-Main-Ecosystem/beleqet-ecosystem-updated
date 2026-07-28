import { WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { I18nService } from 'nestjs-i18n';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { FfmpegService } from './ffmpeg.service';
interface TranscribeJobData {
    responseId: string;
    sessionId: string;
    lang: string;
}
interface EvaluateJobData {
    sessionId: string;
    lang: string;
}
export declare class VideoInterviewProcessor extends WorkerHost {
    private readonly prisma;
    private readonly circuitBreaker;
    private readonly ffmpeg;
    private readonly i18n;
    private readonly config;
    private readonly videoQueue;
    private readonly logger;
    private readonly openai;
    constructor(prisma: PrismaService, circuitBreaker: CircuitBreakerService, ffmpeg: FfmpegService, i18n: I18nService, config: ConfigService, videoQueue: Queue);
    process(job: Job): Promise<void>;
    processTranscription(job: Job<TranscribeJobData>): Promise<void>;
    processEvaluation(job: Job<EvaluateJobData>): Promise<void>;
    cleanupExpiredInterviews(): Promise<void>;
    private callWhisper;
    private callOllama;
    private buildEvaluationPrompt;
    private parseEvaluationResponse;
    private maybeEnqueueEvaluation;
}
export {};
