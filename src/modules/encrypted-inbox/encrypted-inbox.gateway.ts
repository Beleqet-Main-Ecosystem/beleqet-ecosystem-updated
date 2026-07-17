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
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { EncryptedInboxService } from './encrypted-inbox.service';
import { KeyExchangeService } from './key-exchange.service';

/**
 * WebSocket gateway for real-time encrypted messaging.
 *
 * Clients connect with a JWT token and exchange E2EE ciphertext in real
 * time.  The server never sees plaintext — all messages are AES-256-GCM
 * encrypted client-side before transmission.
 *
 * **Events**:
 * - `join_conversation` — Join a conversation room
 * - `send_encrypted_message` — Send ciphertext to a conversation
 * - `typing_encrypted` — Broadcast typing indicator
 * - `new_encrypted_message` — Incoming encrypted message (server broadcast)
 * - `encrypted_typing_indicator` — Typing indicator from participant
 * - `key_exchange_request` — Request another user's public key
 * - `key_exchange_response` — Response with public key
 *
 * @remarks Namespace: `/encrypted-inbox`
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/encrypted-inbox',
})
export class EncryptedInboxGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EncryptedInboxGateway.name);

  constructor(
    private readonly inboxService: EncryptedInboxService,
    private readonly keyExchange: KeyExchangeService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Handle new WebSocket connections.
   *
   * Validates the JWT token from the handshake auth and attaches
   * the user payload to the client data.
   */
  async handleConnection(client: Socket) {
    try {
      const tokenString =
        client.handshake.auth?.token || client.handshake.headers?.authorization;
      if (!tokenString) throw new Error('No token provided');

      const token = tokenString.replace('Bearer ', '').trim();
      const payload = this.jwtService.verify(token);

      client.data.user = payload;
      this.logger.log(
        `[EncryptedInboxGateway] Client connected: ${client.id} (User: ${payload.userId})`,
      );
    } catch {
      this.logger.warn(
        `[EncryptedInboxGateway] Unauthorized connection attempt: ${client.id}`,
      );
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect();
    }
  }

  /** Log client disconnections */
  handleDisconnect(client: Socket) {
    this.logger.log(`[EncryptedInboxGateway] Client disconnected: ${client.id}`);
  }

  /**
   * Join a conversation room to receive real-time encrypted messages.
   *
   * Verifies the user is a participant before granting access.
   */
  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.conversationId) {
      client.emit('error', { message: 'conversationId required' });
      return;
    }

    try {
      // Verify participation and fetch recent messages
      const result = await this.inboxService.getMessages(userId, {
        conversationId: data.conversationId,
        limit: 50,
      });

      client.join(data.conversationId);
      this.logger.log(`User ${userId} joined encrypted conversation ${data.conversationId}`);
      client.emit('conversation_history', result.messages);
    } catch (err) {
      this.logger.error(`Error joining conversation: ${(err as Error).message}`);
      client.emit('error', { message: 'Failed to join conversation' });
    }
  }

  /**
   * Send an encrypted message to a conversation.
   *
   * The server stores the ciphertext and broadcasts it to all
   * participants in the conversation room.
   */
  @SubscribeMessage('send_encrypted_message')
  async handleSendMessage(
    @MessageBody()
    data: {
      conversationId: string;
      ciphertext: string;
      iv: string;
      encryptedMetadata?: Record<string, unknown>;
      serverCiphertext?: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.conversationId || !data.ciphertext || !data.iv) {
      client.emit('error', { message: 'conversationId, ciphertext, and iv required' });
      return;
    }

    try {
      const savedMessage = await this.inboxService.sendMessage(userId, {
        conversationId: data.conversationId,
        ciphertext: data.ciphertext,
        iv: data.iv,
        encryptedMetadata: data.encryptedMetadata,
        serverCiphertext: data.serverCiphertext,
      });

      // Broadcast to all participants in the conversation
      this.server.to(data.conversationId).emit('new_encrypted_message', savedMessage);
    } catch (err) {
      this.logger.error(`Error sending encrypted message: ${(err as Error).message}`);
      client.emit('error', { message: 'Failed to send encrypted message' });
    }
  }

  /**
   * Broadcast typing indicator to conversation participants.
   *
   * No message content is transmitted — only the typing state.
   */
  @SubscribeMessage('typing_encrypted')
  async handleTyping(
    @MessageBody() data: { conversationId: string; isTyping: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.conversationId) return;

    // Broadcast to room, excluding the sender
    client.to(data.conversationId).emit('encrypted_typing_indicator', {
      conversationId: data.conversationId,
      userId,
      isTyping: data.isTyping,
    });
  }

  /**
   * Request a user's public key for E2EE key exchange.
   *
   * Returns the public key if available, or an error if the user
   * has not registered E2EE keys.
   */
  @SubscribeMessage('key_exchange_request')
  async handleKeyExchange(
    @MessageBody() data: { targetUserId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.targetUserId) {
      client.emit('error', { message: 'targetUserId required' });
      return;
    }

    try {
      const publicKey = await this.keyExchange.getPublicKey(data.targetUserId);
      client.emit('key_exchange_response', {
        targetUserId: data.targetUserId,
        publicKey,
      });
    } catch {
      client.emit('key_exchange_response', {
        targetUserId: data.targetUserId,
        publicKey: null,
        error: 'User has no registered E2EE keys',
      });
    }
  }

  /**
   * Leave a conversation room.
   */
  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data.conversationId) return;
    client.leave(data.conversationId);
    this.logger.log(`Client ${client.id} left conversation ${data.conversationId}`);
  }
}
