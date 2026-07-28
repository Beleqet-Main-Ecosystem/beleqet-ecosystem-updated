"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var VideoInterviewService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoInterviewService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const client_1 = require("@prisma/client");
const nestjs_i18n_1 = require("nestjs-i18n");
const prisma_service_1 = require("../../prisma/prisma.service");
const circuit_breaker_service_1 = require("./circuit-breaker.service");
const ffmpeg_service_1 = require("./ffmpeg.service");
const queues_constants_1 = require("../queues/queues.constants");
const config_1 = require("@nestjs/config");
const GDPR_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
let VideoInterviewService = VideoInterviewService_1 = class VideoInterviewService {
    constructor(prisma, i18n, circuitBreaker, config, videoQueue) {
        this.prisma = prisma;
        this.i18n = i18n;
        this.circuitBreaker = circuitBreaker;
        this.config = config;
        this.videoQueue = videoQueue;
        this.logger = new common_1.Logger(VideoInterviewService_1.name);
    }
    async createSession(employerId, dto, lang = 'en') {
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
            throw new common_1.NotFoundException(await this.i18n.t('video_interview.application_not_found', { lang }));
        }
        if (application.job.company.userId !== employerId) {
            throw new common_1.ForbiddenException(await this.i18n.t('video_interview.forbidden', { lang }));
        }
        const existing = await this.prisma.videoInterview.findUnique({
            where: { applicationId: dto.applicationId },
        });
        if (existing) {
            throw new common_1.ConflictException(await this.i18n.t('video_interview.already_exists', { lang }));
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
                },
                scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
                expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
                gdprDeleteAt,
            },
        });
        this.logger.log(`Video interview session created: ${session.id}`);
        return session;
    }
    async getSession(sessionId, userId, lang = 'en') {
        const session = await this.prisma.videoInterview.findUnique({
            where: { id: sessionId },
            include: {
                responses: { orderBy: { questionIndex: 'asc' } },
                evaluation: true,
            },
        });
        if (!session) {
            throw new common_1.NotFoundException(await this.i18n.t('video_interview.not_found', { lang }));
        }
        if (session.gdprDeleteAt && session.gdprDeleteAt < new Date() && session.status === 'EXPIRED') {
            throw new common_1.NotFoundException(await this.i18n.t('video_interview.gdpr_deleted', { lang }));
        }
        if (session.userId !== userId) {
            throw new common_1.ForbiddenException(await this.i18n.t('video_interview.forbidden', { lang }));
        }
        if (session.expiresAt && session.expiresAt < new Date()) {
            throw new common_1.BadRequestException(await this.i18n.t('video_interview.expired', { lang }));
        }
        return session;
    }
    async submitResponse(sessionId, userId, dto, lang = 'en') {
        const session = await this.prisma.videoInterview.findUnique({
            where: { id: sessionId },
            include: { responses: true },
        });
        if (!session) {
            throw new common_1.NotFoundException(await this.i18n.t('video_interview.not_found', { lang }));
        }
        if (session.userId !== userId) {
            throw new common_1.ForbiddenException(await this.i18n.t('video_interview.forbidden', { lang }));
        }
        if (session.expiresAt && session.expiresAt < new Date()) {
            throw new common_1.BadRequestException(await this.i18n.t('video_interview.expired', { lang }));
        }
        const metadata = session.metadata;
        if (dto.questionIndex >= metadata.questions.length) {
            throw new common_1.BadRequestException(await this.i18n.t('video_interview.invalid_question_index', { lang }));
        }
        (0, ffmpeg_service_1.assertAllowedVideoUrl)(dto.videoUrl, this.config, await this.i18n.t('video_interview.invalid_video_url', { lang }));
        const response = await this.prisma.videoResponse.upsert({
            where: {
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
                rawWhisperResponse: client_1.Prisma.DbNull,
            },
            create: {
                videoInterviewId: sessionId,
                questionIndex: dto.questionIndex,
                videoUrl: dto.videoUrl,
                language: dto.language ?? 'en',
                processingStatus: 'PENDING',
            },
        });
        if (session.status === 'PENDING') {
            await this.prisma.videoInterview.update({
                where: { id: sessionId },
                data: { status: 'IN_PROGRESS' },
            });
        }
        else if (session.status === 'PROCESSING' ||
            session.status === 'COMPLETED' ||
            session.status === 'FAILED') {
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
        await this.videoQueue.add(queues_constants_1.VIDEO_INTERVIEW_JOBS.TRANSCRIBE, { responseId: response.id, sessionId, lang }, { attempts: 3, backoff: { type: 'exponential', delay: 5_000 } });
        this.logger.log(`Transcription job queued for response ${response.id}`);
        return response;
    }
    async requestGdprDeletion(sessionId, userId, lang = 'en') {
        const session = await this.prisma.videoInterview.findUnique({
            where: { id: sessionId },
        });
        if (!session) {
            throw new common_1.NotFoundException(await this.i18n.t('video_interview.not_found', { lang }));
        }
        if (session.userId !== userId) {
            throw new common_1.ForbiddenException(await this.i18n.t('video_interview.forbidden', { lang }));
        }
        await this.prisma.$transaction([
            this.prisma.videoResponse.updateMany({
                where: { videoInterviewId: sessionId },
                data: {
                    transcript: null,
                    rawWhisperResponse: client_1.Prisma.DbNull,
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
    async listByApplication(applicationId, employerId, lang = 'en') {
        const application = await this.prisma.application.findFirst({
            where: { id: applicationId },
            include: { job: { select: { company: { select: { userId: true } } } } },
        });
        if (!application) {
            throw new common_1.NotFoundException(await this.i18n.t('video_interview.application_not_found', { lang }));
        }
        if (application.job.company.userId !== employerId) {
            throw new common_1.ForbiddenException(await this.i18n.t('video_interview.forbidden', { lang }));
        }
        return this.prisma.videoInterview.findMany({
            where: { applicationId },
            include: {
                responses: { orderBy: { questionIndex: 'asc' } },
                evaluation: true,
            },
        });
    }
};
exports.VideoInterviewService = VideoInterviewService;
exports.VideoInterviewService = VideoInterviewService = VideoInterviewService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, bullmq_1.InjectQueue)(queues_constants_1.QUEUE_NAMES.VIDEO_INTERVIEW)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        nestjs_i18n_1.I18nService,
        circuit_breaker_service_1.CircuitBreakerService,
        config_1.ConfigService,
        bullmq_2.Queue])
], VideoInterviewService);
//# sourceMappingURL=video-interview.service.js.map