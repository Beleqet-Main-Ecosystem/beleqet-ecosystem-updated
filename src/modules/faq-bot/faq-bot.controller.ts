import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { FaqBotService } from './faq-bot.service';
import { FaqBotConsentService } from './services/faq-bot-consent.service';
import { CreateFaqBotSessionDto } from './dto/create-session.dto';
import { AskFaqBotQuestionDto } from './dto/ask-question.dto';
import { AiWebhookDto } from './dto/ai-webhook.dto';

@ApiTags('faq-bot')
@Controller('faq-bot')
export class FaqBotController {
  constructor(
    private readonly faqBotService: FaqBotService,
    private readonly consentService: FaqBotConsentService,
  ) {}

  /** Create a GDPR-compliant FAQ Bot session with locale and currency preferences. */
  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create FAQ Bot session (requires GDPR consent)' })
  createSession(@Body() dto: CreateFaqBotSessionDto) {
    return this.faqBotService.createSession(dto);
  }

  /** Fetch chat history for a session. */
  @Get('sessions/:sessionId/messages')
  @ApiOperation({ summary: 'Get FAQ Bot message history' })
  getMessages(@Param('sessionId') sessionId: string) {
    return this.faqBotService.getMessages(sessionId);
  }

  /** Non-streaming ask endpoint (REST fallback). */
  @Post('sessions/ask')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ask FAQ Bot a question (non-streaming REST)' })
  async ask(@Body() dto: AskFaqBotQuestionDto) {
    return this.faqBotService.processQuestion(dto.sessionId, dto.message);
  }

  /**
   * Server-Sent Events stream for FAQ answers (alternative to WebSocket).
   * Client: EventSource(`/api/v1/faq-bot/sessions/${id}/stream?message=...`)
   */
  @Sse('sessions/:sessionId/stream')
  @ApiOperation({ summary: 'Stream FAQ Bot answer via SSE' })
  streamAsk(
    @Param('sessionId') sessionId: string,
    @Query('message') message: string,
  ): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      void (async () => {
        try {
          const result = await this.faqBotService.processQuestion(
            sessionId,
            message,
            (token) => {
              subscriber.next({ data: { type: 'chunk', token } });
            },
          );
          subscriber.next({
            data: {
              type: 'end',
              messageId: result.messageId,
              content: result.content,
              sources: result.sources,
            },
          });
          subscriber.complete();
        } catch (err) {
          subscriber.next({ data: { type: 'error', message: (err as Error).message } });
          subscriber.complete();
        }
      })();
    });
  }

  /** Webhook endpoint for async AI model callbacks. */
  @Post('webhook/ai')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI model webhook callback (HMAC-verified)' })
  handleWebhook(@Body() dto: AiWebhookDto) {
    return this.faqBotService.handleAiWebhook(dto);
  }

  /** GDPR data export for a FAQ Bot session. */
  @Get('sessions/:sessionId/export')
  @ApiOperation({ summary: 'Export FAQ Bot session data (GDPR)' })
  exportSession(@Param('sessionId') sessionId: string) {
    return this.consentService.exportSession(sessionId);
  }

  /** GDPR right to erasure — delete session and all messages. */
  @Delete('sessions/:sessionId')
  @ApiOperation({ summary: 'Delete FAQ Bot session (GDPR erasure)' })
  deleteSession(@Param('sessionId') sessionId: string) {
    return this.consentService.deleteSession(sessionId);
  }
}
