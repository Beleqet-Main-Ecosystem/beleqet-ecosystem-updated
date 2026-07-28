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
var VideoInterviewProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoInterviewProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const bullmq_2 = require("bullmq");
const client_1 = require("@prisma/client");
const nestjs_i18n_1 = require("nestjs-i18n");
const openai_1 = require("openai");
const config_1 = require("@nestjs/config");
const promises_1 = require("fs/promises");
const prisma_service_1 = require("../../prisma/prisma.service");
const circuit_breaker_service_1 = require("./circuit-breaker.service");
const ffmpeg_service_1 = require("./ffmpeg.service");
const queues_constants_1 = require("../queues/queues.constants");
let VideoInterviewProcessor = VideoInterviewProcessor_1 = class VideoInterviewProcessor extends bullmq_1.WorkerHost {
    constructor(prisma, circuitBreaker, ffmpeg, i18n, config, videoQueue) {
        super();
        this.prisma = prisma;
        this.circuitBreaker = circuitBreaker;
        this.ffmpeg = ffmpeg;
        this.i18n = i18n;
        this.config = config;
        this.videoQueue = videoQueue;
        this.logger = new common_1.Logger(VideoInterviewProcessor_1.name);
        this.openai = new openai_1.default({
            apiKey: this.config.get('OPENAI_API_KEY', 'dummy'),
        });
    }
    async process(job) {
        switch (job.name) {
            case queues_constants_1.VIDEO_INTERVIEW_JOBS.TRANSCRIBE:
                return this.processTranscription(job);
            case queues_constants_1.VIDEO_INTERVIEW_JOBS.EVALUATE:
                return this.processEvaluation(job);
            case queues_constants_1.VIDEO_INTERVIEW_JOBS.CLEANUP_EXPIRED:
                return this.cleanupExpiredInterviews();
            case queues_constants_1.VIDEO_INTERVIEW_JOBS.NOTIFY_COMPLETE:
                this.logger.log(`Interview complete notification for session ${job.data.sessionId}`);
                return;
            default:
                this.logger.warn(`Unhandled video-interview job: ${job.name}`);
        }
    }
    async processTranscription(job) {
        const { responseId, sessionId, lang } = job.data;
        this.logger.log(`Transcribing response ${responseId}`);
        const videoResponse = await this.prisma.videoResponse.findUnique({
            where: { id: responseId },
        });
        if (!videoResponse?.videoUrl) {
            this.logger.warn(`Response ${responseId} has no videoUrl — skipping`);
            return;
        }
        await this.prisma.videoResponse.update({
            where: { id: responseId },
            data: { processingStatus: 'TRANSCRIBING' },
        });
        const startedAt = Date.now();
        try {
            const whisperResult = await this.circuitBreaker.execute('whisper', () => this.callWhisper(videoResponse.videoUrl, videoResponse.language), { failureThreshold: 3, timeout: 60_000, executionTimeout: 120_000 }, lang);
            await this.prisma.videoResponse.update({
                where: { id: responseId },
                data: {
                    transcript: whisperResult.text,
                    rawWhisperResponse: whisperResult,
                    processingDurationMs: Date.now() - startedAt,
                    processingStatus: 'TRANSCRIBED',
                },
            });
            this.logger.log(`Transcription complete for ${responseId} (${Date.now() - startedAt}ms)`);
            await this.maybeEnqueueEvaluation(sessionId, lang);
        }
        catch (err) {
            this.logger.error(`Transcription failed for ${responseId}: ${err.message}`);
            await this.prisma.videoResponse.update({
                where: { id: responseId },
                data: { processingStatus: 'FAILED' },
            });
            throw err;
        }
    }
    async processEvaluation(job) {
        const { sessionId, lang } = job.data;
        this.logger.log(`Evaluating interview ${sessionId}`);
        const session = await this.prisma.videoInterview.findUnique({
            where: { id: sessionId },
            include: { responses: { orderBy: { questionIndex: 'asc' } } },
        });
        if (!session)
            return;
        const metadata = session.metadata;
        const transcripts = session.responses.map((r) => ({
            questionIndex: r.questionIndex,
            question: metadata.questions[r.questionIndex]?.text ?? '',
            transcript: r.transcript ?? '[no transcript]',
        }));
        await this.prisma.videoInterview.update({
            where: { id: sessionId },
            data: { status: 'PROCESSING' },
        });
        try {
            const evaluation = await this.circuitBreaker.execute('ollama', () => this.callOllama(transcripts), { failureThreshold: 3, timeout: 120_000, executionTimeout: 180_000 }, lang);
            const gdprDeleteAt = session.gdprDeleteAt ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
            await this.prisma.$transaction([
                this.prisma.interviewEvaluation.upsert({
                    where: { videoInterviewId: sessionId },
                    update: {
                        overallScore: evaluation.overallScore,
                        scores: evaluation.scores,
                        reasoning: evaluation.reasoning,
                        rawAiResponse: evaluation.raw,
                        modelUsed: evaluation.modelUsed,
                        gdprDeleteAt,
                    },
                    create: {
                        videoInterviewId: sessionId,
                        overallScore: evaluation.overallScore,
                        scores: evaluation.scores,
                        reasoning: evaluation.reasoning,
                        rawAiResponse: evaluation.raw,
                        modelUsed: evaluation.modelUsed,
                        gdprDeleteAt,
                    },
                }),
                this.prisma.videoInterview.update({
                    where: { id: sessionId },
                    data: { status: 'COMPLETED' },
                }),
            ]);
            this.logger.log(`Evaluation complete for session ${sessionId} — score: ${evaluation.overallScore}`);
            await this.videoQueue.add(queues_constants_1.VIDEO_INTERVIEW_JOBS.NOTIFY_COMPLETE, { sessionId, overallScore: evaluation.overallScore }, { attempts: 2 });
        }
        catch (err) {
            this.logger.error(`Evaluation failed for ${sessionId}: ${err.message}`);
            await this.prisma.videoInterview.update({
                where: { id: sessionId },
                data: { status: 'FAILED' },
            });
            throw err;
        }
    }
    async cleanupExpiredInterviews() {
        const now = new Date();
        const expired = await this.prisma.videoInterview.findMany({
            where: { gdprDeleteAt: { lte: now }, status: { not: 'EXPIRED' } },
            select: { id: true },
        });
        for (const { id } of expired) {
            await this.prisma.$transaction([
                this.prisma.videoResponse.updateMany({
                    where: { videoInterviewId: id },
                    data: { videoUrl: null, transcript: null, rawWhisperResponse: client_1.Prisma.DbNull },
                }),
                this.prisma.interviewEvaluation.deleteMany({ where: { videoInterviewId: id } }),
                this.prisma.videoInterview.update({
                    where: { id },
                    data: { status: 'EXPIRED' },
                }),
            ]);
            this.logger.log(`GDPR cleanup completed for session ${id}`);
        }
    }
    async callWhisper(videoUrl, language = 'en') {
        let downloadedPath = '';
        let cleanedPath = '';
        try {
            downloadedPath = await this.ffmpeg.downloadToTempFile(videoUrl);
            cleanedPath = await this.ffmpeg.stripMetadataFromFile(downloadedPath);
            const audioBuffer = await this.ffmpeg.extractAudioFromFile(cleanedPath);
            this.logger.log(`FFmpeg: streamed video → ${audioBuffer.length}b WAV audio`);
            const file = new File([new Uint8Array(audioBuffer)], 'interview.wav', { type: 'audio/wav' });
            const transcription = await this.openai.audio.transcriptions.create({
                file,
                model: 'whisper-1',
                language,
                response_format: 'verbose_json',
            });
            return {
                text: transcription.text,
                segments: transcription.segments ?? [],
                language: transcription.language ?? language,
                duration: transcription.duration ?? 0,
            };
        }
        finally {
            await Promise.allSettled([
                downloadedPath ? (0, promises_1.unlink)(downloadedPath) : Promise.resolve(),
                cleanedPath ? (0, promises_1.unlink)(cleanedPath) : Promise.resolve(),
            ]);
        }
    }
    async callOllama(transcripts) {
        const ollamaUrl = this.config.get('OLLAMA_URL', 'http://localhost:11434');
        const prompt = this.buildEvaluationPrompt(transcripts);
        let raw;
        let modelUsed = 'llama3';
        try {
            const ollamaRes = await fetch(`${ollamaUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'llama3', prompt, stream: false, format: 'json' }),
                signal: AbortSignal.timeout(90_000),
            });
            if (!ollamaRes.ok)
                throw new Error(`Ollama error: ${ollamaRes.status}`);
            const data = (await ollamaRes.json());
            raw = data;
            return { ...this.parseEvaluationResponse(data.response), modelUsed, raw };
        }
        catch {
            this.logger.warn('Ollama unavailable — falling back to OpenAI gpt-4o-mini');
            modelUsed = 'gpt-4o-mini';
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
            });
            const content = completion.choices[0].message.content ?? '{}';
            raw = completion;
            return { ...this.parseEvaluationResponse(content), modelUsed, raw };
        }
    }
    buildEvaluationPrompt(transcripts) {
        const qa = transcripts
            .map((t) => `Q${t.questionIndex + 1}: ${t.question}\nA: ${t.transcript}`)
            .join('\n\n');
        return `You are an expert HR evaluator. Evaluate the following interview responses.
Return ONLY valid JSON with this exact shape:
{
  "overallScore": <0-100 number>,
  "perQuestion": [{"idx": <number>, "score": <0-100>, "feedback": "<string>"}],
  "traits": {"communication": <0-100>, "clarity": <0-100>, "relevance": <0-100>},
  "reasoning": "<2-3 sentence summary>"
}

Interview Q&A:
${qa}`;
    }
    parseEvaluationResponse(raw) {
        try {
            const parsed = JSON.parse(raw);
            return {
                overallScore: Number(parsed.overallScore ?? 0),
                scores: {
                    perQuestion: parsed.perQuestion ?? [],
                    traits: parsed.traits ?? {},
                },
                reasoning: parsed.reasoning ?? '',
            };
        }
        catch {
            this.logger.error('Failed to parse AI evaluation response');
            return { overallScore: 0, scores: {}, reasoning: 'Evaluation parsing failed.' };
        }
    }
    async maybeEnqueueEvaluation(sessionId, lang) {
        const session = await this.prisma.videoInterview.findUnique({
            where: { id: sessionId },
            include: { responses: true },
        });
        if (!session)
            return;
        const metadata = session.metadata;
        const totalQuestions = metadata.questions.length;
        const transcribed = session.responses.filter((r) => r.processingStatus === 'TRANSCRIBED').length;
        if (transcribed < totalQuestions)
            return;
        const claimed = await this.prisma.videoInterview.updateMany({
            where: {
                id: sessionId,
                status: { in: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'] },
            },
            data: { status: 'PROCESSING' },
        });
        if (claimed.count === 0) {
            this.logger.log(`Evaluation already claimed for session ${sessionId} — skipping duplicate enqueue`);
            return;
        }
        this.logger.log(`All ${totalQuestions} responses transcribed — queuing evaluation`);
        const jobId = `evaluate-${sessionId}`;
        try {
            const existing = await this.videoQueue.getJob(jobId);
            if (existing) {
                const state = await existing.getState();
                if (state === 'completed' || state === 'failed') {
                    await existing.remove();
                }
                else {
                    this.logger.log(`EVALUATE job already ${state} for session ${sessionId} — skipping re-enqueue`);
                    return;
                }
            }
            await this.videoQueue.add(queues_constants_1.VIDEO_INTERVIEW_JOBS.EVALUATE, { sessionId, lang }, {
                jobId,
                attempts: 3,
                backoff: { type: 'exponential', delay: 10_000 },
            });
        }
        catch (err) {
            await this.prisma.videoInterview.update({
                where: { id: sessionId },
                data: { status: 'IN_PROGRESS' },
            });
            throw err;
        }
    }
};
exports.VideoInterviewProcessor = VideoInterviewProcessor;
exports.VideoInterviewProcessor = VideoInterviewProcessor = VideoInterviewProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    (0, bullmq_1.Processor)(queues_constants_1.QUEUE_NAMES.VIDEO_INTERVIEW),
    __param(5, (0, bullmq_1.InjectQueue)(queues_constants_1.QUEUE_NAMES.VIDEO_INTERVIEW)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        circuit_breaker_service_1.CircuitBreakerService,
        ffmpeg_service_1.FfmpegService,
        nestjs_i18n_1.I18nService,
        config_1.ConfigService,
        bullmq_2.Queue])
], VideoInterviewProcessor);
//# sourceMappingURL=video-interview.processor.js.map