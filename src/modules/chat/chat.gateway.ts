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
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const tokenString = client.handshake.auth?.token || client.handshake.headers?.authorization;

      // Development mode: allow connections without JWT
      if (!tokenString) {
        client.data.user = {
          userId: 'abrhamb',
        };

        this.logger.log(`[ChatGateway] Development connection: ${client.id}`);

        return;
      }
      if (!tokenString) throw new Error('No token provided');

      const token = tokenString.replace('Bearer ', '').trim();
      const payload = this.jwtService.verify(token);

      client.data.user = payload;

      this.logger.log(`[ChatGateway] Client connected: ${client.id} (User: ${payload.userId})`);
    } catch {
      this.logger.warn(`[ChatGateway] Unauthorized connection attempt: ${client.id}`);

      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[ChatGateway] Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(@MessageBody() data: { roomId: string }, @ConnectedSocket() client: Socket) {
    const userId = client.data.user?.userId;
    if (!userId || !data.roomId) return;
    if (!userId || !data.roomId) {
      client.emit('error', {
        message: this.i18n.t('messages.chat.roomIdRequired', { lang: 'en' }),
      });
      return;
    }

    try {
      client.join(data.roomId);
      this.logger.log(`User ${userId} joined room ${data.roomId}`);

      // Fetch history and send only to the connecting user
      const history = await this.chatService.getRoomMessages(data.roomId, userId);
      client.emit('room_history', history);
    } catch (err) {
      this.logger.error(`Error joining room: ${(err as Error).message}`);
      client.emit('error', { message: 'Failed to join room' });
      client.emit('error', {
        message: this.i18n.t('messages.chat.joinRoomFailed', { lang: 'en' }),
      });
    }
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @MessageBody() data: { roomId: string; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.userId;

    console.log('MESSAGE RECEIVED:', data);

    if (!userId || !data.roomId || !data.content) {
      console.log('Missing data:', {
        userId,
        roomId: data.roomId,
        content: data.content,
      });
      client.emit('error', {
        message: this.i18n.t('messages.chat.messageContentRequired', { lang: 'en' }),
      });
      return;
    }

    try {
      const savedMsg = await this.chatService.saveMessage(data.roomId, userId, data.content);

      this.server.to(data.roomId).emit('new_message', savedMsg);
    } catch (err) {
      this.logger.error(`Error sending message: ${(err as Error).message}`);

      client.emit('error', {
        message: 'Failed to send message',
        message: this.i18n.t('messages.chat.sendMessageFailed', { lang: 'en' }),
      });
    }
  }

  @SubscribeMessage('share_file')
  async handleShareFile(
    @MessageBody() data: { roomId: string; fileUrl: string; fileName: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.roomId || !data.fileUrl) return;
    if (!userId || !data.roomId || !data.fileUrl) {
      client.emit('error', {
        message: this.i18n.t('messages.chat.fileUrlRequired', { lang: 'en' }),
      });
      return;
    }

    try {
      const content = `Shared a file: ${data.fileName}`;
      const savedMsg = await this.chatService.saveMessage(data.roomId, userId, content, {
        type: 'file',
        url: data.fileUrl,
        name: data.fileName,
      });
      this.server.to(data.roomId).emit('new_message', savedMsg);
    } catch (err) {
      this.logger.error(`Error sharing file: ${(err as Error).message}`);
      client.emit('error', { message: 'Failed to share file' });
      client.emit('error', {
        message: this.i18n.t('messages.chat.shareFileFailed', { lang: 'en' }),
      });
    }
  }

  @SubscribeMessage('start_video_call')
  async handleStartVideoCall(
    @MessageBody() data: { roomId: string; callLink: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.roomId || !data.callLink) return;
    if (!userId || !data.roomId || !data.callLink) {
      client.emit('error', {
        message: this.i18n.t('messages.chat.callLinkRequired', { lang: 'en' }),
      });
      return;
    }

    try {
      const content = `Started a video call. Click to join.`;
      const savedMsg = await this.chatService.saveMessage(data.roomId, userId, content, {
        type: 'video_call',
        link: data.callLink,
      });
      this.server.to(data.roomId).emit('new_message', savedMsg);
      this.server.to(data.roomId).emit('incoming_video_call', {
        roomId: data.roomId,
        link: data.callLink,
        callerId: userId,
      });
    } catch (err) {
      this.logger.error(`Error starting video call: ${(err as Error).message}`);
      client.emit('error', { message: 'Failed to start video call' });
      client.emit('error', {
        message: this.i18n.t('messages.chat.startVideoCallFailed', { lang: 'en' }),
      });
    }
  }
}
