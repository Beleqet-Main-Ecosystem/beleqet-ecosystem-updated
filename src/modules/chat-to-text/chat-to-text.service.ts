import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateConversationDto,
  CreateTranscriptDto,
  TranscribeAudioDto,
  UpdateTranscriptDto,
} from './dtos';
import {
  Prisma,
  SpeechMessageType,
  SpeechTranscript,
  SpeechTranscriptStatus,
} from '@prisma/client';
import { FasterWhisperService } from './faster-whisper.service';
import {
  IUploadedAudioFile,
  IConversationHistory,
  IConversationStatistics,
} from './interfaces';

@Injectable()
export class ChatToTextService {
  private readonly logger = new Logger(ChatToTextService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fasterWhisperService: FasterWhisperService,
  ) {}

  /**
   * Creates a new speech conversation record.
   */
  async createConversation(createConversationDto: CreateConversationDto, userId: string) {
    const conversation = await this.prisma.speechConversation.create({
      data: {
        title: createConversationDto.title,
        description: createConversationDto.description,
        userId,
      },
    });

    this.logger.log(`Speech conversation created: ${conversation.id}`);
    return conversation;
  }

  /**
   * Transcribes an uploaded audio file locally and persists the normalized result.
   */
  async transcribeAudio(
    file: IUploadedAudioFile,
    transcribeAudioDto: TranscribeAudioDto,
    userId: string,
  ): Promise<SpeechTranscript> {
    await this.findOwnedConversation(transcribeAudioDto.conversationId, userId);
    const transcription = await this.fasterWhisperService.transcribe(
      file,
      transcribeAudioDto.language,
    );

    return this.create({
      conversationId: transcribeAudioDto.conversationId,
      language: transcribeAudioDto.language,
      provider: 'faster-whisper' as CreateTranscriptDto['provider'],
      rawText: transcription.text,
    }, userId);
  }

  /**
   * Transcribes an incremental audio chunk and stores it as a conversation transcript.
   * This enables a progressive, near-real-time transcription experience while audio is still being captured.
   */
  async transcribeChunk(
    file: IUploadedAudioFile,
    transcribeAudioDto: TranscribeAudioDto,
    userId: string,
  ): Promise<SpeechTranscript> {
    await this.findOwnedConversation(transcribeAudioDto.conversationId, userId);
    const transcription = await this.fasterWhisperService.transcribe(
      file,
      transcribeAudioDto.language,
    );

    const activeTranscript = await this.prisma.speechTranscript.findFirst({
      where: {
        conversationId: transcribeAudioDto.conversationId,
        provider: 'faster-whisper',
        status: SpeechTranscriptStatus.PROCESSING,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!activeTranscript) {
      const normalizedText = this.getTranscriptContent(transcription.text);
      return this.prisma.speechTranscript.create({
        data: {
          conversationId: transcribeAudioDto.conversationId,
          rawText: transcription.text,
          normalizedText,
          language: transcribeAudioDto.language || 'en',
          provider: 'faster-whisper',
          status: transcribeAudioDto.isFinal
            ? SpeechTranscriptStatus.COMPLETED
            : SpeechTranscriptStatus.PROCESSING,
          messages: {
            create: {
              content: normalizedText,
              conversation: { connect: { id: transcribeAudioDto.conversationId } },
              sender: 'speech-to-text',
              type: SpeechMessageType.USER,
            },
          },
        },
      });
    }

    const rawText = `${activeTranscript.rawText || ''} ${transcription.text}`.trim();
    const normalizedText = this.getTranscriptContent(rawText);
    return this.prisma.speechTranscript.update({
      where: { id: activeTranscript.id },
      data: {
        rawText,
        normalizedText,
        status: transcribeAudioDto.isFinal
          ? SpeechTranscriptStatus.COMPLETED
          : SpeechTranscriptStatus.PROCESSING,
        messages: {
          updateMany: {
            where: { transcriptId: activeTranscript.id },
            data: { content: normalizedText },
          },
        },
      },
    });
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }

  private getErrorStack(error: unknown): string | undefined {
    return error instanceof Error ? error.stack : undefined;
  }

  private shouldSkipTranscript(rawText: string | null | undefined): boolean {
    if (!rawText) {
      return true;
    }

    const normalized = rawText.trim();
    if (!normalized) {
      return true;
    }

    const containsLetters = /[a-zA-Z]/.test(normalized);
    if (!containsLetters) {
      return true;
    }

    const words = normalized.split(/\s+/).filter(Boolean);
    if (words.length < 2) {
      return true;
    }

    return normalized.length < 6;
  }

  private getTranscriptContent(rawText: string | null | undefined): string {
    const normalizedText = this.normalizeText(rawText ?? '');

    if (!normalizedText || this.shouldSkipTranscript(normalizedText)) {
      return 'No speech detected.';
    }

    return normalizedText;
  }

  /**
   * Create a new transcript and save to database.
   */
  async create(createTranscriptDto: CreateTranscriptDto, userId: string): Promise<SpeechTranscript> {
    try {
      const conversation = await this.findOwnedConversation(createTranscriptDto.conversationId, userId);

      const normalizedText = this.getTranscriptContent(createTranscriptDto.rawText);

      if (this.shouldSkipTranscript(createTranscriptDto.rawText)) {
        this.logger.warn('Transcription was empty or too short; storing a fallback placeholder');
      }

      const transcript = await this.prisma.speechTranscript.create({
        data: {
          conversationId: createTranscriptDto.conversationId,
          audioUrl: createTranscriptDto.audioUrl,
          videoUrl: createTranscriptDto.videoUrl,
          duration: createTranscriptDto.duration,
          rawText: createTranscriptDto.rawText,
          normalizedText,
          language: createTranscriptDto.language || 'en',
          provider: createTranscriptDto.provider || 'web-speech-api',
          status: SpeechTranscriptStatus.COMPLETED,
          messages: {
            create: {
              content: normalizedText,
              conversation: {
                connect: { id: createTranscriptDto.conversationId },
              },
              sender: 'speech-to-text',
              type: SpeechMessageType.USER,
            },
          },
        },
      });

      this.logger.log(
        `Transcript created: ${transcript.id} for conversation ${conversation.id}`,
      );

      return transcript;
    } catch (error) {
      this.logger.error(
        `Error creating transcript: ${this.getErrorMessage(error)}`,
        this.getErrorStack(error),
      );
      throw error;
    }
  }

  async findByConversation(conversationId: string, userId: string): Promise<SpeechTranscript[]> {
    try {
      await this.findOwnedConversation(conversationId, userId);

      return this.prisma.speechTranscript.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          conversationId: true,
          audioUrl: true,
          videoUrl: true,
          duration: true,
          rawText: true,
          normalizedText: true,
          language: true,
          confidence: true,
          provider: true,
          processingTime: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }) as Promise<SpeechTranscript[]>;
    } catch (error) {
      this.logger.error(
        `Error fetching transcripts for conversation ${conversationId}: ${this.getErrorMessage(error)}`,
        this.getErrorStack(error),
      );
      throw error;
    }
  }

  async findById(id: string, userId: string): Promise<SpeechTranscript> {
    try {
      const transcript = await this.prisma.speechTranscript.findUnique({
        where: { id },
        include: {
          conversation: true,
          messages: true,
        },
      });

      if (!transcript) {
        throw new NotFoundException(`Transcript with ID ${id} not found`);
      }
      await this.findOwnedConversation(transcript.conversationId, userId);

      return transcript;
    } catch (error) {
      this.logger.error(
        `Error fetching transcript ${id}: ${this.getErrorMessage(error)}`,
        this.getErrorStack(error),
      );
      throw error;
    }
  }

  async update(id: string, updateTranscriptDto: UpdateTranscriptDto, userId: string): Promise<SpeechTranscript> {
    try {
      const existingTranscript = await this.prisma.speechTranscript.findUnique({
        where: { id },
      });

      if (!existingTranscript) {
        throw new NotFoundException(`Transcript with ID ${id} not found`);
      }
      await this.findOwnedConversation(existingTranscript.conversationId, userId);

      const normalizedText = updateTranscriptDto.rawText
        ? this.normalizeText(updateTranscriptDto.rawText)
        : undefined;

      const transcript = await this.prisma.speechTranscript.update({
        where: { id },
        data: {
          ...updateTranscriptDto,
          normalizedText: normalizedText || existingTranscript.normalizedText,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Transcript updated: ${id}`);
      return transcript;
    } catch (error) {
      this.logger.error(
        `Error updating transcript ${id}: ${this.getErrorMessage(error)}`,
        this.getErrorStack(error),
      );
      throw error;
    }
  }

  async delete(id: string, userId: string): Promise<SpeechTranscript> {
    try {
      const transcript = await this.prisma.speechTranscript.findUnique({ where: { id } });
      if (!transcript) throw new NotFoundException(`Transcript with ID ${id} not found`);
      await this.findOwnedConversation(transcript.conversationId, userId);
      const deleted = await this.prisma.speechTranscript.delete({
        where: { id },
      });

      this.logger.log(`Transcript deleted: ${id}`);
      return deleted;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Transcript with ID ${id} not found`);
      }

      this.logger.error(
        `Error deleting transcript ${id}: ${this.getErrorMessage(error)}`,
        this.getErrorStack(error),
      );
      throw error;
    }
  }

  async getConversationHistory(conversationId: string, userId: string): Promise<IConversationHistory> {
    try {
      const conversation = await this.prisma.speechConversation.findUnique({
        where: { id: conversationId },
        include: {
          transcripts: {
            orderBy: { createdAt: 'desc' },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
          },
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!conversation) {
        throw new NotFoundException(
          `Conversation with ID ${conversationId} not found`,
        );
      }
      this.assertConversationOwner(conversation.userId, userId);

      return {
        id: conversation.id,
        userId: conversation.userId,
        title: conversation.title,
        description: conversation.description,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        transcripts: conversation.transcripts,
        messages: conversation.messages,
        user: conversation.user
          ? {
              id: conversation.user.id,
              email: conversation.user.email,
              name: `${conversation.user.firstName} ${conversation.user.lastName}`.trim(),
            }
          : null,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching conversation history ${conversationId}: ${this.getErrorMessage(error)}`,
        this.getErrorStack(error),
      );
      throw error;
    }
  }

  /**
   * Normalize transcript text for consistent conversation records.
   */
  private normalizeText(text: string): string {
    if (!text) return '';

    const trimmed = text.trim().replace(/\s+/g, ' ');
    const normalized = trimmed
      .charAt(0).toUpperCase() + trimmed.slice(1)
      .replace(/([.!?])\1+/g, '$1')
      .replace(/([.!?])([a-zA-Z])/g, '$1 $2');

    return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
  }

  async getStatistics(conversationId: string, userId: string): Promise<IConversationStatistics> {
    try {
      await this.findOwnedConversation(conversationId, userId);
      const transcripts = await this.prisma.speechTranscript.findMany({
        where: { conversationId },
      });

      return {
        totalTranscripts: transcripts.length,
        completedTranscripts: transcripts.filter(
          (t) => t.status === SpeechTranscriptStatus.COMPLETED,
        ).length,
        failedTranscripts: transcripts.filter(
          (t) => t.status === SpeechTranscriptStatus.FAILED,
        ).length,
        pendingTranscripts: transcripts.filter(
          (t) => t.status === SpeechTranscriptStatus.PENDING,
        ).length,
        processingTranscripts: transcripts.filter(
          (t) => t.status === SpeechTranscriptStatus.PROCESSING,
        ).length,
        totalDuration: transcripts.reduce((sum, t) => sum + (t.duration || 0), 0),
        languages: [...new Set(transcripts.map((t) => t.language))],
      };
    } catch (error) {
      this.logger.error(
        `Error fetching statistics for conversation ${conversationId}: ${this.getErrorMessage(error)}`,
        this.getErrorStack(error),
      );
      throw error;
    }
  }

  /** Looks up a conversation and ensures the caller is its authenticated owner. */
  private async findOwnedConversation(conversationId: string, userId: string) {
    const conversation = await this.prisma.speechConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, userId: true },
    });
    if (!conversation) throw new NotFoundException(`Conversation with ID ${conversationId} not found`);
    this.assertConversationOwner(conversation.userId, userId);
    return conversation;
  }

  /** Prevents cross-user access even when another conversation identifier is known. */
  private assertConversationOwner(conversationUserId: string | null, userId: string): void {
    if (conversationUserId !== userId) {
      throw new ForbiddenException('You do not have access to this conversation');
    }
  }
}
