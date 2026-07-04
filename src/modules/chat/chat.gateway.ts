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
import { Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/chat'
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly i18n: I18nService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Expect token in handshake auth: { token: "Bearer eyJ..." }
      const tokenString = client.handshake.auth?.token || client.handshake.headers?.authorization;
      if (!tokenString) throw new Error('No token provided');
      
      const token = tokenString.replace('Bearer ', '').trim();
      const payload = this.jwtService.verify(token);
      
      client.data.user = payload;
      this.logger.log(`[ChatGateway] Client connected: ${client.id} (User: ${payload.userId})`);
    } catch (err) {
      this.logger.warn(`[ChatGateway] Unauthorized connection attempt: ${client.id}`);
      client.emit('error', { message: this.i18n.t('messages.chat.unauthorized', { lang: 'en' }) });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[ChatGateway] Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.roomId) {
      client.emit('error', { message: this.i18n.t('messages.chat.roomIdRequired', { lang: 'en' }) });
      return;
    }

    try {
      // Verify the user is actually a participant BEFORE granting
      // socket-room membership — otherwise a client could receive
      // live broadcasts for a room it has no access to, even though
      // the (separate) history fetch would correctly reject it.
      const history = await this.chatService.getRoomMessages(data.roomId, userId);

      client.join(data.roomId);
      this.logger.log(`User ${userId} joined room ${data.roomId}`);
      client.emit('room_history', history);
    } catch (err) {
      this.logger.error(`Error joining room: ${(err as Error).message}`);
      client.emit('error', { message: this.i18n.t('messages.chat.joinRoomFailed', { lang: 'en' }) });
    }
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @MessageBody() data: { roomId: string; content: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.roomId || !data.content) {
      client.emit('error', { message: this.i18n.t('messages.chat.messageContentRequired', { lang: 'en' }) });
      return;
    }

    try {
      const savedMsg = await this.chatService.saveMessage(data.roomId, userId, data.content);
      // Broadcast to everyone in the room (including sender)
      this.server.to(data.roomId).emit('new_message', savedMsg);
    } catch (err) {
      this.logger.error(`Error sending message: ${(err as Error).message}`);
      client.emit('error', { message: this.i18n.t('messages.chat.sendMessageFailed', { lang: 'en' }) });
    }
  }

  @SubscribeMessage('share_file')
  async handleShareFile(
    @MessageBody() data: { roomId: string; fileUrl: string; fileName: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.roomId || !data.fileUrl) {
      client.emit('error', { message: this.i18n.t('messages.chat.fileUrlRequired', { lang: 'en' }) });
      return;
    }

    try {
      const content = `Shared a file: ${data.fileName}`;
      const savedMsg = await this.chatService.saveMessage(data.roomId, userId, content, { type: 'file', url: data.fileUrl, name: data.fileName });
      this.server.to(data.roomId).emit('new_message', savedMsg);
    } catch (err) {
      this.logger.error(`Error sharing file: ${(err as Error).message}`);
      client.emit('error', { message: this.i18n.t('messages.chat.shareFileFailed', { lang: 'en' }) });
    }
  }

  @SubscribeMessage('start_video_call')
  async handleStartVideoCall(
    @MessageBody() data: { roomId: string; callLink: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.roomId || !data.callLink) {
      client.emit('error', { message: this.i18n.t('messages.chat.callLinkRequired', { lang: 'en' }) });
      return;
    }

    try {
      const content = `Started a video call. Click to join.`;
      const savedMsg = await this.chatService.saveMessage(data.roomId, userId, content, { type: 'video_call', link: data.callLink });
      this.server.to(data.roomId).emit('new_message', savedMsg);
      this.server.to(data.roomId).emit('incoming_video_call', { roomId: data.roomId, link: data.callLink, callerId: userId });
    } catch (err) {
      this.logger.error(`Error starting video call: ${(err as Error).message}`);
      client.emit('error', { message: this.i18n.t('messages.chat.startVideoCallFailed', { lang: 'en' }) });
    }
  }
}