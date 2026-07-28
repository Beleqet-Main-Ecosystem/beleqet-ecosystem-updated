import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { CreateInterviewSessionDto } from './dto/create-interview-session.dto';
import { SubmitResponseDto } from './dto/submit-response.dto';
import { ConfigService } from '@nestjs/config';
export declare class VideoInterviewService {
    private readonly prisma;
    private readonly i18n;
    private readonly circuitBreaker;
    private readonly config;
    private readonly videoQueue;
    private readonly logger;
    constructor(prisma: PrismaService, i18n: I18nService, circuitBreaker: CircuitBreakerService, config: ConfigService, videoQueue: Queue);
    createSession(employerId: string, dto: CreateInterviewSessionDto, lang?: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.VideoInterviewStatus;
        createdAt: Date;
        userId: string;
        updatedAt: Date;
        expiresAt: Date | null;
        metadata: Prisma.JsonValue;
        applicationId: string;
        scheduledAt: Date | null;
        gdprDeleteAt: Date | null;
    }>;
    getSession(sessionId: string, userId: string, lang?: string): Promise<{
        responses: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            questionIndex: number;
            videoUrl: string | null;
            transcript: string | null;
            rawWhisperResponse: Prisma.JsonValue | null;
            processingDurationMs: number | null;
            language: string;
            processingStatus: string;
            videoInterviewId: string;
        }[];
        evaluation: {
            id: string;
            overallScore: number;
            reasoning: string | null;
            rawAiResponse: Prisma.JsonValue | null;
            modelUsed: string;
            gdprDeleteAt: Date;
            videoInterviewId: string;
            scores: Prisma.JsonValue;
            evaluatedAt: Date;
        } | null;
    } & {
        id: string;
        status: import(".prisma/client").$Enums.VideoInterviewStatus;
        createdAt: Date;
        userId: string;
        updatedAt: Date;
        expiresAt: Date | null;
        metadata: Prisma.JsonValue;
        applicationId: string;
        scheduledAt: Date | null;
        gdprDeleteAt: Date | null;
    }>;
    submitResponse(sessionId: string, userId: string, dto: SubmitResponseDto, lang?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        questionIndex: number;
        videoUrl: string | null;
        transcript: string | null;
        rawWhisperResponse: Prisma.JsonValue | null;
        processingDurationMs: number | null;
        language: string;
        processingStatus: string;
        videoInterviewId: string;
    }>;
    requestGdprDeletion(sessionId: string, userId: string, lang?: string): Promise<{
        message: string;
    }>;
    listByApplication(applicationId: string, employerId: string, lang?: string): Promise<({
        responses: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            questionIndex: number;
            videoUrl: string | null;
            transcript: string | null;
            rawWhisperResponse: Prisma.JsonValue | null;
            processingDurationMs: number | null;
            language: string;
            processingStatus: string;
            videoInterviewId: string;
        }[];
        evaluation: {
            id: string;
            overallScore: number;
            reasoning: string | null;
            rawAiResponse: Prisma.JsonValue | null;
            modelUsed: string;
            gdprDeleteAt: Date;
            videoInterviewId: string;
            scores: Prisma.JsonValue;
            evaluatedAt: Date;
        } | null;
    } & {
        id: string;
        status: import(".prisma/client").$Enums.VideoInterviewStatus;
        createdAt: Date;
        userId: string;
        updatedAt: Date;
        expiresAt: Date | null;
        metadata: Prisma.JsonValue;
        applicationId: string;
        scheduledAt: Date | null;
        gdprDeleteAt: Date | null;
    })[]>;
}
