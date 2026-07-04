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
var ScreeningProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScreeningProcessor = void 0;
const bull_1 = require("@nestjs/bull");
const common_1 = require("@nestjs/common");
const bull_2 = require("@nestjs/bull");
const event_emitter_1 = require("@nestjs/event-emitter");
const config_1 = require("@nestjs/config");
const openai_1 = require("openai");
const prisma_service_1 = require("../../prisma/prisma.service");
const queues_constants_1 = require("../queues/queues.constants");
const email_templates_1 = require("../notifications/email-templates");
let ScreeningProcessor = ScreeningProcessor_1 = class ScreeningProcessor {
    constructor(prisma, eventEmitter, config, notificationsQueue, analyticsQueue) {
        this.prisma = prisma;
        this.eventEmitter = eventEmitter;
        this.config = config;
        this.notificationsQueue = notificationsQueue;
        this.analyticsQueue = analyticsQueue;
        this.logger = new common_1.Logger(ScreeningProcessor_1.name);
        this.openai = new openai_1.default({
            apiKey: this.config.get('OPENAI_API_KEY'),
        });
    }
    async handleScreenCandidate(job) {
        const { applicationId, jobTitle, jobDescription, jobRequirements, coverLetter } = job.data;
        this.logger.log(`[screen-candidate] Processing application ${applicationId}`);
        await this.prisma.application.update({
            where: { id: applicationId },
            data: { status: 'SCREENING' },
        });
        const scoreResult = await this.runAiScoring({
            jobTitle,
            jobDescription,
            jobRequirements,
            coverLetter,
        });
        await this.prisma.candidateScore.create({
            data: {
                applicationId,
                userId: job.data.userId,
                overallScore: scoreResult.overallScore,
                skillScore: scoreResult.skillScore,
                experienceScore: scoreResult.experienceScore,
                cultureFitScore: scoreResult.cultureFitScore,
                reasoning: scoreResult.reasoning,
                rawAiResponse: scoreResult,
                modelUsed: this.config.get('OPENAI_MODEL', 'gpt-4o-mini'),
            },
        });
        const isShortlisted = scoreResult.overallScore >= queues_constants_1.SCORING.AUTO_SHORTLIST_THRESHOLD;
        const isAutoRejected = scoreResult.overallScore < queues_constants_1.SCORING.AUTO_REJECT_THRESHOLD;
        const newStatus = isAutoRejected
            ? 'REJECTED'
            : isShortlisted
                ? 'SHORTLISTED'
                : 'SCREENING';
        await this.prisma.application.update({
            where: { id: applicationId },
            data: { status: newStatus },
        });
        await this.prisma.eventLog.create({
            data: {
                eventType: 'candidate.scored',
                entityId: applicationId,
                entityType: 'Application',
                payload: {
                    applicationId,
                    overallScore: scoreResult.overallScore,
                    newStatus,
                    jobId: job.data.jobId,
                },
                processedBy: ScreeningProcessor_1.name,
            },
        });
        this.eventEmitter.emit('candidate.scored', {
            applicationId,
            score: scoreResult.overallScore,
            status: newStatus,
        });
        await this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_IN_APP, {
            userId: job.data.userId,
            type: isShortlisted ? 'application.shortlisted' : isAutoRejected ? 'application.rejected' : 'application.received',
            title: isShortlisted
                ? `🎉 You've been shortlisted for ${jobTitle}`
                : isAutoRejected
                    ? `Application update for ${jobTitle}`
                    : `Application received for ${jobTitle}`,
            body: isShortlisted
                ? 'Congratulations! Your profile stands out. Expect an interview invitation soon.'
                : isAutoRejected
                    ? 'Thank you for applying. Unfortunately your profile does not match the requirements for this role.'
                    : 'Your application is being reviewed by our team.',
            metadata: { applicationId, jobId: job.data.jobId, score: scoreResult.overallScore },
        });
        if (isShortlisted) {
            if (scoreResult.overallScore >= 90) {
                await job.queue.add(queues_constants_1.APPLICATION_JOBS.SCHEDULE_INTERVIEW, {
                    applicationId,
                    userId: job.data.userId,
                    jobId: job.data.jobId,
                    jobTitle,
                    companyId: job.data.companyId,
                });
            }
            await this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_IN_APP, {
                companyId: job.data.companyId,
                type: 'candidate.shortlisted',
                title: `Strong candidate shortlisted for ${jobTitle}`,
                body: `A candidate scored ${scoreResult.overallScore}/100 — review their profile now.`,
                metadata: { applicationId, score: scoreResult.overallScore },
            });
        }
        await this.analyticsQueue.add(queues_constants_1.ANALYTICS_JOBS.LOG_EVENT, {
            eventType: 'candidate.screened',
            jobId: job.data.jobId,
            score: scoreResult.overallScore,
            status: newStatus,
        });
        this.logger.log(`[screen-candidate] ${applicationId} scored ${scoreResult.overallScore} → ${newStatus}`);
        return { applicationId, score: scoreResult.overallScore, status: newStatus };
    }
    async handleNotifyRecruiter(job) {
        this.logger.log(`[notify-recruiter] New application for ${job.data.jobTitle}`);
        const company = await this.prisma.company.findUnique({
            where: { id: job.data.companyId },
            include: { user: true },
        });
        if (company) {
            await this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_IN_APP, {
                userId: company.userId,
                type: 'application.received',
                title: `New application for ${job.data.jobTitle}`,
                body: `${job.data.applicantName} just applied to your job listing.`,
                metadata: { applicationId: job.data.applicationId },
            });
            const applicationUrl = `${this.config.get('FRONTEND_URL')}/employer`;
            const email = await (0, email_templates_1.recruiterApplicationEmail)({
                firstName: company.user.firstName,
                applicantName: job.data.applicantName,
                jobTitle: job.data.jobTitle,
                applicationUrl,
            });
            await this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_EMAIL, {
                to: company.user.email,
                subject: `New application — ${job.data.jobTitle}`,
                ...email,
            });
            if (company.user.telegramId) {
                await this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_TELEGRAM, {
                    telegramId: company.user.telegramId,
                    message: `📋 New application for *${job.data.jobTitle}*\nApplicant: ${job.data.applicantName}\n\nReview → ${this.config.get('FRONTEND_URL')}/dashboard/applications/${job.data.applicationId}`,
                });
            }
        }
    }
    async handleScheduleInterview(job) {
        this.logger.log(`[schedule-interview] Scheduling for application ${job.data.applicationId}`);
        const proposedSlot = new Date();
        proposedSlot.setDate(proposedSlot.getDate() + 3);
        proposedSlot.setHours(10, 0, 0, 0);
        await this.prisma.application.update({
            where: { id: job.data.applicationId },
            data: {
                status: 'INTERVIEW_SCHEDULED',
                interviewSlot: proposedSlot,
            },
        });
        await this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_IN_APP, {
            userId: job.data.userId,
            type: 'interview.scheduled',
            title: `Interview scheduled for ${job.data.jobTitle}`,
            body: `An interview has been proposed for ${proposedSlot.toLocaleDateString()}. Check your dashboard for details.`,
            metadata: { applicationId: job.data.applicationId, interviewSlot: proposedSlot },
        });
        this.logger.log(`[schedule-interview] Interview set for ${job.data.applicationId} at ${proposedSlot.toISOString()}`);
    }
    async onFailed(job, error) {
        this.logger.error(`Queue job failed: [${job.name}] id=${job.id} attempt=${job.attemptsMade}/${job.opts.attempts}`, error.stack);
        if (job.name === queues_constants_1.APPLICATION_JOBS.SCREEN_CANDIDATE && job.attemptsMade >= (job.opts.attempts ?? 3)) {
            const data = job.data;
            await this.prisma.application.update({
                where: { id: data.applicationId },
                data: { notes: `AI screening failed after ${job.attemptsMade} attempts: ${error.message}` },
            }).catch(() => null);
        }
    }
    onCompleted(job) {
        this.logger.debug(`Queue job completed: [${job.name}] id=${job.id}`);
    }
    async runAiScoring(input) {
        const systemPrompt = `You are an expert HR screening assistant for an Ethiopian hiring platform called Beleqet.
Your task is to score a job application on a scale of 0-100 across three dimensions.
Always respond ONLY with valid JSON, no markdown fences, no preamble.`;
        const userPrompt = `
Job Title: ${input.jobTitle}
Job Description: ${input.jobDescription}
Requirements: ${input.jobRequirements ?? 'Not specified'}
Candidate Cover Letter: ${input.coverLetter ?? 'Not provided'}

Score this application and return JSON with exactly this shape:
{
  "overallScore": <number 0-100>,
  "skillScore": <number 0-100>,
  "experienceScore": <number 0-100>,
  "cultureFitScore": <number 0-100>,
  "reasoning": "<2-3 sentence explanation of the scores>"
}
`;
        try {
            const completion = await this.openai.chat.completions.create({
                model: this.config.get('OPENAI_MODEL', 'gpt-4o-mini'),
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.2,
                max_tokens: 400,
                response_format: { type: 'json_object' },
            });
            const raw = completion.choices[0]?.message?.content ?? '{}';
            const parsed = JSON.parse(raw);
            return {
                overallScore: Math.min(100, Math.max(0, parsed.overallScore ?? 50)),
                skillScore: Math.min(100, Math.max(0, parsed.skillScore ?? 50)),
                experienceScore: Math.min(100, Math.max(0, parsed.experienceScore ?? 50)),
                cultureFitScore: Math.min(100, Math.max(0, parsed.cultureFitScore ?? 50)),
                reasoning: parsed.reasoning ?? '',
            };
        }
        catch (err) {
            this.logger.warn(`OpenAI call failed, using fallback scoring: ${err.message}`);
            return {
                overallScore: 50,
                skillScore: 50,
                experienceScore: 50,
                cultureFitScore: 50,
                reasoning: 'AI scoring unavailable — manual review required.',
            };
        }
    }
};
exports.ScreeningProcessor = ScreeningProcessor;
__decorate([
    (0, bull_1.Process)(queues_constants_1.APPLICATION_JOBS.SCREEN_CANDIDATE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ScreeningProcessor.prototype, "handleScreenCandidate", null);
__decorate([
    (0, bull_1.Process)(queues_constants_1.APPLICATION_JOBS.NOTIFY_RECRUITER),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ScreeningProcessor.prototype, "handleNotifyRecruiter", null);
__decorate([
    (0, bull_1.Process)(queues_constants_1.APPLICATION_JOBS.SCHEDULE_INTERVIEW),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ScreeningProcessor.prototype, "handleScheduleInterview", null);
__decorate([
    (0, bull_1.OnQueueFailed)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Error]),
    __metadata("design:returntype", Promise)
], ScreeningProcessor.prototype, "onFailed", null);
__decorate([
    (0, bull_1.OnQueueCompleted)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ScreeningProcessor.prototype, "onCompleted", null);
exports.ScreeningProcessor = ScreeningProcessor = ScreeningProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    (0, bull_1.Processor)(queues_constants_1.QUEUE_NAMES.APPLICATION),
    __param(3, (0, bull_2.InjectQueue)(queues_constants_1.QUEUE_NAMES.NOTIFICATIONS)),
    __param(4, (0, bull_2.InjectQueue)(queues_constants_1.QUEUE_NAMES.ANALYTICS)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        event_emitter_1.EventEmitter2,
        config_1.ConfigService, Object, Object])
], ScreeningProcessor);
//# sourceMappingURL=screening.processor.js.map