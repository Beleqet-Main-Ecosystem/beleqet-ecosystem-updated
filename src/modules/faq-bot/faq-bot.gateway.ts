import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { FaqBotService } from './faq-bot.service';
import { IsString, IsUUID, Length } from 'class-validator';

class AskMessageDto {
  @IsUUID()
  sessionId: string;

  @IsString()
  @Length(2, 2000)
  message: string;
}

/**
 * WebSocket gateway for real-time FAQ Bot message streaming.
 * Namespace: /faq-bot
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/faq-bot',
})
export class FaqBotGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(FaqBotGateway.name);

  constructor(private readonly faqBotService: FaqBotService) {}

  /** Accept connections; session validation happens per message. */
  handleConnection(client: Socket): void {
    this.logger.log(`[FaqBotGateway] Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`[FaqBotGateway] Client disconnected: ${client.id}`);
  }

  /**
   * Handle incoming FAQ questions and stream AI/KB responses token-by-token.
   * Events emitted: stream_start, stream_chunk, stream_end, error
   */
  @SubscribeMessage('ask')
  async handleAsk(
    @MessageBody() data: AskMessageDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    if (!data?.sessionId || !data?.message?.trim()) {
      client.emit('error', { message: 'sessionId and message are required' });
      return;
    }

    try {
      client.emit('stream_start', { sessionId: data.sessionId });

      const result = await this.faqBotService.processQuestion(
        data.sessionId,
        data.message.trim(),
        (token) => {
          client.emit('stream_chunk', { sessionId: data.sessionId, token });
        },
      );

      client.emit('stream_end', {
        sessionId: data.sessionId,
        messageId: result.messageId,
        content: result.content,
        sources: result.sources,
        usedAi: result.usedAi,
      });
    } catch (err) {
      this.logger.error(`FAQ ask failed: ${(err as Error).message}`);
      client.emit('error', { message: (err as Error).message });
    }
  }
}
