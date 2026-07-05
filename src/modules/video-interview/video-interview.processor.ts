import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { I18nService } from 'nestjs-i18n';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { QUEUE_NAMES, VIDEO_INTERVIEW_JOBS } from '../queues/queues.constants';

interface TranscribeJobData {
  responseId: string;
  sessionId: string;
  lang: string;
}

interface EvaluateJobData {
  sessionId: string;
  lang: string;
}

/**
 * BullMQ processor for all video interview background jobs.
 *
 * Job flow:
 * 1. {@link processTranscription} — calls Whisper API (via circuit breaker).
 * 2. When all responses transcribed → enqueues {@link processEvaluation}.
 * 3. {@link processEvaluation} — calls Ollama Llama3 (via circuit breaker).
 * 4. {@link cleanupExpiredInterviews} — scheduled nightly GDPR cleanup.
 *
 * All AI calls are wrapped in {@link CircuitBreakerService} to prevent
 * cascading failures when Whisper or Ollama are unavailable.
 */
@Processor(QUEUE_NAMES.VIDEO_INTERVIEW)
export class VideoInterviewProcessor {
  private readonly logger = new Logger(VideoInterviewProcessor.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly i18n: I18nService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_NAMES.VIDEO_INTERVIEW)
    private readonly videoQueue: Queue,
  ) {
    this.openai = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY', 'dummy'),
    });
  }

  // ── Whisper transcription ─────────────────────────────────────────────────

  /**
   * Transcribe a single video response using OpenAI Whisper.
   * The Whisper call is protected by a circuit breaker named 'whisper'.
   * On failure the response is marked FAILED and the error is logged;
   * BullMQ retries up to 3× with exponential back-off.
   */
  @Process(VIDEO_INTERVIEW_JOBS.TRANSCRIBE)
  async processTranscription(job: Job<TranscribeJobData>): Promise<void> {
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
      const whisperResult = await this.circuitBreaker.execute(
        'whisper',
        () => this.callWhisper(videoResponse.videoUrl!, videoResponse.language),
        { failureThreshold: 3, timeout: 60_000 },
        lang,
      );

      await this.prisma.videoResponse.update({
        where: { id: responseId },
        data: {
          transcript: whisperResult.text,
          rawWhisperResponse: whisperResult as object,
          processingDurationMs: Date.now() - startedAt,
          processingStatus: 'TRANSCRIBED',
        },
      });

      this.logger.log(`Transcription complete for ${responseId} (${Date.now() - startedAt}ms)`);
      await this.maybeEnqueueEvaluation(sessionId, lang);
    } catch (err) {
      this.logger.error(`Transcription failed for ${responseId}: ${(err as Error).message}`);
      await this.prisma.videoResponse.update({
        where: { id: responseId },
        data: { processingStatus: 'FAILED' },
      });
      // Re-throw so BullMQ records the failure and applies retry back-off
      throw err;
    }
  }

  // ── Ollama evaluation ─────────────────────────────────────────────────────

  /**
   * Evaluate all transcribed responses using Ollama (Llama3/Mistral).
   * Stores per-question scores and overall score in {@link InterviewEvaluation}.
   * Protected by a circuit breaker named 'ollama'.
   */
  @Process(VIDEO_INTERVIEW_JOBS.EVALUATE)
  async processEvaluation(job: Job<EvaluateJobData>): Promise<void> {
    const { sessionId, lang } = job.data;
    this.logger.log(`Evaluating interview ${sessionId}`);

    const session = await this.prisma.videoInterview.findUnique({
      where: { id: sessionId },
      include: { responses: { orderBy: { questionIndex: 'asc' } } },
    });
    if (!session) return;

    const metadata = session.metadata as {
      questions: { id: string; text: string; durationSec: number }[];
    };

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
      const evaluation = await this.circuitBreaker.execute(
        'ollama',
        () => this.callOllama(transcripts),
        { failureThreshold: 3, timeout: 120_000 },
        lang,
      );

      const gdprDeleteAt = session.gdprDeleteAt ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      await this.prisma.$transaction([
        this.prisma.interviewEvaluation.upsert({
          where: { videoInterviewId: sessionId },
          update: {
            overallScore: evaluation.overallScore,
            scores: evaluation.scores as object,
            reasoning: evaluation.reasoning,
            rawAiResponse: evaluation.raw as object,
            modelUsed: evaluation.modelUsed,
            gdprDeleteAt,
          },
          create: {
            videoInterviewId: sessionId,
            overallScore: evaluation.overallScore,
            scores: evaluation.scores as object,
            reasoning: evaluation.reasoning,
            rawAiResponse: evaluation.raw as object,
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

      await this.videoQueue.add(
        VIDEO_INTERVIEW_JOBS.NOTIFY_COMPLETE,
        { sessionId, overallScore: evaluation.overallScore },
        { attempts: 2 },
      );
    } catch (err) {
      this.logger.error(`Evaluation failed for ${sessionId}: ${(err as Error).message}`);
      await this.prisma.videoInterview.update({
        where: { id: sessionId },
        data: { status: 'FAILED' },
      });
      throw err;
    }
  }

  /** Nightly job: hard-delete PII from expired/GDPR-requested sessions. */
  @Process(VIDEO_INTERVIEW_JOBS.CLEANUP_EXPIRED)
  async cleanupExpiredInterviews(): Promise<void> {
    const now = new Date();
    const expired = await this.prisma.videoInterview.findMany({
      where: { gdprDeleteAt: { lte: now }, status: { not: 'EXPIRED' } },
      select: { id: true },
    });

    for (const { id } of expired) {
      await this.prisma.$transaction([
        this.prisma.videoResponse.updateMany({
          where: { videoInterviewId: id },
          data: { videoUrl: null, transcript: null, rawWhisperResponse: undefined },
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

  // ── Private AI helpers ───────────────────────────────────────────────────

  /**
   * Call OpenAI Whisper for audio transcription.
   * In production, the videoUrl is fetched and streamed to the API.
   * The Readable stream is created from the S3 URL for memory efficiency.
   */
  private async callWhisper(
    videoUrl: string,
    language = 'en',
  ): Promise<{ text: string; segments: unknown[]; language: string; duration: number }> {
    // Fetch the video as a stream and send directly to Whisper
    const response = await fetch(videoUrl);
    if (!response.ok) throw new Error(`Failed to fetch video: ${response.statusText}`);

    const blob = await response.blob();
    const file = new File([blob], 'interview.webm', { type: 'video/webm' });

    const transcription = await this.openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language,
      response_format: 'verbose_json',
    });

    return {
      text: transcription.text,
      segments: (transcription as unknown as { segments: unknown[] }).segments ?? [],
      language: (transcription as unknown as { language: string }).language ?? language,
      duration: (transcription as unknown as { duration: number }).duration ?? 0,
    };
  }

  /**
   * Call Ollama (local Llama3) to evaluate interview transcripts.
   * Falls back to OpenAI gpt-4o-mini when Ollama is unreachable.
   *
   * Returns structured scores for storage as JSONB.
   */
  private async callOllama(
    transcripts: { questionIndex: number; question: string; transcript: string }[],
  ): Promise<{
    overallScore: number;
    scores: Record<string, unknown>;
    reasoning: string;
    modelUsed: string;
    raw: unknown;
  }> {
    const ollamaUrl = this.config.get<string>('OLLAMA_URL', 'http://localhost:11434');

    const prompt = this.buildEvaluationPrompt(transcripts);

    let raw: unknown;
    let modelUsed = 'llama3';

    try {
      const ollamaRes = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3', prompt, stream: false, format: 'json' }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!ollamaRes.ok) throw new Error(`Ollama error: ${ollamaRes.status}`);
      const data = (await ollamaRes.json()) as { response: string };
      raw = data;
      return { ...this.parseEvaluationResponse(data.response), modelUsed, raw };
    } catch {
      // Fallback: OpenAI gpt-4o-mini
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

  private buildEvaluationPrompt(
    transcripts: { questionIndex: number; question: string; transcript: string }[],
  ): string {
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

  private parseEvaluationResponse(raw: string): {
    overallScore: number;
    scores: Record<string, unknown>;
    reasoning: string;
  } {
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
    } catch {
      this.logger.error('Failed to parse AI evaluation response');
      return { overallScore: 0, scores: {}, reasoning: 'Evaluation parsing failed.' };
    }
  }

  /** Check if all questions have been transcribed; if so, enqueue evaluation. */
  private async maybeEnqueueEvaluation(sessionId: string, lang: string): Promise<void> {
    const session = await this.prisma.videoInterview.findUnique({
      where: { id: sessionId },
      include: { responses: true },
    });
    if (!session) return;

    const metadata = session.metadata as { questions: unknown[] };
    const totalQuestions = metadata.questions.length;
    const transcribed = session.responses.filter((r) => r.processingStatus === 'TRANSCRIBED').length;

    if (transcribed >= totalQuestions) {
      this.logger.log(`All ${totalQuestions} responses transcribed — queuing evaluation`);
      await this.videoQueue.add(
        VIDEO_INTERVIEW_JOBS.EVALUATE,
        { sessionId, lang },
        { attempts: 3, backoff: { type: 'exponential', delay: 10_000 } },
      );
    }
  }
}
