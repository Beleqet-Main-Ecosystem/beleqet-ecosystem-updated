import { VideoInterviewService } from './video-interview.service';
import { CreateInterviewSessionDto } from './dto/create-interview-session.dto';
import { SubmitResponseDto } from './dto/submit-response.dto';
export declare class VideoInterviewController {
    private readonly service;
    constructor(service: VideoInterviewService);
    createSession(user: {
        id: string;
    }, dto: CreateInterviewSessionDto, lang?: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.VideoInterviewStatus;
        createdAt: Date;
        userId: string;
        updatedAt: Date;
        expiresAt: Date | null;
        metadata: import("@prisma/client/runtime/library").JsonValue;
        applicationId: string;
        scheduledAt: Date | null;
        gdprDeleteAt: Date | null;
    }>;
    getSession(id: string, user: {
        id: string;
    }, lang?: string): Promise<{
        responses: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            questionIndex: number;
            videoUrl: string | null;
            transcript: string | null;
            rawWhisperResponse: import("@prisma/client/runtime/library").JsonValue | null;
            processingDurationMs: number | null;
            language: string;
            processingStatus: string;
            videoInterviewId: string;
        }[];
        evaluation: {
            id: string;
            overallScore: number;
            reasoning: string | null;
            rawAiResponse: import("@prisma/client/runtime/library").JsonValue | null;
            modelUsed: string;
            gdprDeleteAt: Date;
            videoInterviewId: string;
            scores: import("@prisma/client/runtime/library").JsonValue;
            evaluatedAt: Date;
        } | null;
    } & {
        id: string;
        status: import(".prisma/client").$Enums.VideoInterviewStatus;
        createdAt: Date;
        userId: string;
        updatedAt: Date;
        expiresAt: Date | null;
        metadata: import("@prisma/client/runtime/library").JsonValue;
        applicationId: string;
        scheduledAt: Date | null;
        gdprDeleteAt: Date | null;
    }>;
    listByApplication(applicationId: string, user: {
        id: string;
    }, lang?: string): Promise<({
        responses: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            questionIndex: number;
            videoUrl: string | null;
            transcript: string | null;
            rawWhisperResponse: import("@prisma/client/runtime/library").JsonValue | null;
            processingDurationMs: number | null;
            language: string;
            processingStatus: string;
            videoInterviewId: string;
        }[];
        evaluation: {
            id: string;
            overallScore: number;
            reasoning: string | null;
            rawAiResponse: import("@prisma/client/runtime/library").JsonValue | null;
            modelUsed: string;
            gdprDeleteAt: Date;
            videoInterviewId: string;
            scores: import("@prisma/client/runtime/library").JsonValue;
            evaluatedAt: Date;
        } | null;
    } & {
        id: string;
        status: import(".prisma/client").$Enums.VideoInterviewStatus;
        createdAt: Date;
        userId: string;
        updatedAt: Date;
        expiresAt: Date | null;
        metadata: import("@prisma/client/runtime/library").JsonValue;
        applicationId: string;
        scheduledAt: Date | null;
        gdprDeleteAt: Date | null;
    })[]>;
    submitResponse(id: string, user: {
        id: string;
    }, dto: SubmitResponseDto, lang?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        questionIndex: number;
        videoUrl: string | null;
        transcript: string | null;
        rawWhisperResponse: import("@prisma/client/runtime/library").JsonValue | null;
        processingDurationMs: number | null;
        language: string;
        processingStatus: string;
        videoInterviewId: string;
    }>;
    requestGdprDeletion(id: string, user: {
        id: string;
    }, lang?: string): Promise<{
        message: string;
    }>;
}
