import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { Logger, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { IsString, IsNotEmpty, IsOptional, validateOrReject } from 'class-validator';
import { plainToInstance } from 'class-transformer';

/**
 * DTO for sending an E2EE-encrypted message over WebSocket.
 */
class SendMessageDto {
  @IsString() @IsNotEmpty() roomId: string;
  /** AES-GCM ciphertext encoded as Base64 */
  @IsString() @IsNotEmpty() content: string;
  /** AES-GCM initialization vector encoded as hex (12 bytes → 24 hex chars) */
  @IsString() @IsNotEmpty() iv: string;
}

/**
 * DTO for joining a chat room.
 */
class JoinRoomDto {
  @IsString() @IsNotEmpty() roomId: string;
}

/**
 * DTO for sharing a file link within a chat room.
 */
class ShareFileDto {
  @IsString() @IsNotEmpty() roomId: string;
  @IsString() @IsNotEmpty() fileUrl: string;
  @IsString() @IsNotEmpty() fileName: string;
  /** Optional IV if file metadata is also encrypted */
  @IsString() @IsOptional() iv?: string;
}

/**
 * DTO for initiating a video call in a chat room.
 */
class StartVideoCallDto {
  @IsString() @IsNotEmpty() roomId: string;
  @IsString() @IsNotEmpty() callLink: string;
}

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/chat'
})
@UseGuards(ThrottlerGuard)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService
  ) {}

  /** Authenticate every incoming WebSocket connection via JWT */
  async handleConnection(client: Socket) {
    try {
      const tokenString = client.handshake.auth?.token || client.handshake.headers?.authorization;
      if (!tokenString) throw new Error('No token provided');

      const token = tokenString.replace('Bearer ', '').trim();
      const payload = this.jwtService.verify(token);

      client.data.user = payload;
      this.logger.log(`[ChatGateway] Connected: ${client.id} (User: ${payload.userId})`);
    } catch {
      this.logger.warn(`[ChatGateway] Unauthorized: ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[ChatGateway] Disconnected: ${client.id}`);
  }

  /**
   * Handler for joining a chat room and receiving encrypted message history.
   * Validates the DTO and ensures the user is a participant.
   */
  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @MessageBody() data: JoinRoomDto,
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.roomId) return;

    try {
      await validateOrReject(plainToInstance(JoinRoomDto, data));
      client.join(data.roomId);
      this.logger.log(`User ${userId} joined room ${data.roomId}`);

      // Fetch and return encrypted message history (client decrypts locally)
      const history = await this.chatService.getRoomMessages(data.roomId, userId);
      client.emit('room_history', history);
    } catch (err) {
      this.logger.error(`Error joining room: ${(err as Error).message}`);
      client.emit('error', { message: 'Failed to join room' });
    }
  }

  /**
   * Handler for receiving and relaying an E2EE-encrypted message.
   * The server stores only ciphertext and IV; it never decrypts the content.
   */
  @SubscribeMessage('send_message')
  async handleMessage(
    @MessageBody() data: SendMessageDto,
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.user?.userId;
    if (!userId) return;

    try {
      await validateOrReject(plainToInstance(SendMessageDto, data));

      // Store encrypted ciphertext; IV is stored in metadata so the recipient can decrypt
      const savedMsg = await this.chatService.saveMessage(
        data.roomId,
        userId,
        data.content, // This is the AES-GCM ciphertext (Base64), never plaintext
        { encrypted: true, iv: data.iv }
      );

      // Broadcast the raw encrypted payload to all participants in the room
      this.server.to(data.roomId).emit('new_message', savedMsg);
    } catch (err) {
      this.logger.error(`Error sending message: ${(err as Error).message}`);
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  /**
   * Handler for sharing a file link (payload is not encrypted).
   * Validates the DTO before processing.
   */
  @SubscribeMessage('share_file')
  async handleShareFile(
    @MessageBody() data: ShareFileDto,
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.roomId || !data.fileUrl) return;

    try {
      await validateOrReject(plainToInstance(ShareFileDto, data));
      const content = `Shared a file: ${data.fileName}`;
      const savedMsg = await this.chatService.saveMessage(
        data.roomId,
        userId,
        content,
        { type: 'file', url: data.fileUrl, name: data.fileName, encrypted: false }
      );
      this.server.to(data.roomId).emit('new_message', savedMsg);
    } catch (err) {
      this.logger.error(`Error sharing file: ${(err as Error).message}`);
      client.emit('error', { message: 'Failed to share file' });
    }
  }

  /**
   * Handler for initiating a video call in the room.
   * Validates the DTO before sending notifications.
   */
  @SubscribeMessage('start_video_call')
  async handleStartVideoCall(
    @MessageBody() data: StartVideoCallDto,
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.roomId || !data.callLink) return;

    try {
      await validateOrReject(plainToInstance(StartVideoCallDto, data));
      const content = 'Started a video call. Click to join.';
      const savedMsg = await this.chatService.saveMessage(
        data.roomId,
        userId,
        content,
        { type: 'video_call', link: data.callLink, encrypted: false }
      );
      this.server.to(data.roomId).emit('new_message', savedMsg);
      this.server.to(data.roomId).emit('incoming_video_call', {
        roomId: data.roomId,
        link: data.callLink,
        callerId: userId
      });
    } catch (err) {
      this.logger.error(`Error starting video call: ${(err as Error).message}`);
      client.emit('error', { message: 'Failed to start video call' });
    }
  }
}
