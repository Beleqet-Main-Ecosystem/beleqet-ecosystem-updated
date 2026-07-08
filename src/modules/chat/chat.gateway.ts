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
    private readonly i18n: I18nService // I18nService ተመልሷል
  ) {}

  async handleConnection(client: Socket) {
    try {
      const tokenString = client.handshake.auth?.token || client.handshake.headers?.authorization;
      if (!tokenString) throw new Error('No token provided');
      
      const token = tokenString.replace('Bearer ', '').trim();
      const payload = this.jwtService.verify(token);
      
      client.data.user = payload;
      this.logger.log(`[ChatGateway] Client connected: ${client.id} (User: ${payload.userId})`);
    } catch (err) {
      this.logger.warn(`[ChatGateway] Unauthorized connection attempt: ${client.id}`);
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
    if (!userId || !data.roomId) return;

    try {
      // SECURITY FIX: መጀመሪያ ፈቃዱን ማረጋገጥ (ይህ ለሴኪዩሪቲው ወሳኝ ነው)
      const history = await this.chatService.getRoomMessages(data.roomId, userId);
      
      // ፍቃድ ካለው ብቻ ነው ሩሙን ጆይን የሚያደርገው
      client.join(data.roomId);
      this.logger.log(`User ${userId} joined room ${data.roomId}`);
      
      client.emit('room_history', history);
    } catch (err) {
      this.logger.error(`Error joining room: ${(err as Error).message}`);
      const errorMsg = this.i18n.t('chat.errors.failed_to_join_room', { defaultValue: 'Failed to join room' });
      client.emit('error', { message: errorMsg });
    }
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @MessageBody() data: { roomId: string; content: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.roomId || !data.content) return;

    try {
      const savedMsg = await this.chatService.saveMessage(data.roomId, userId, data.content);
      this.server.to(data.roomId).emit('new_message', savedMsg);
    } catch (err) {
      this.logger.error(`Error sending message: ${(err as Error).message}`);
      const errorMsg = this.i18n.t('chat.errors.failed_to_send_message', { defaultValue: 'Failed to send message' });
      client.emit('error', { message: errorMsg });
    }
  }

  @SubscribeMessage('share_file')
  async handleShareFile(
    @MessageBody() data: { roomId: string; fileUrl: string; fileName: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.roomId || !data.fileUrl) return;

    try {
      const content = `Shared a file: ${data.fileName}`;
      const savedMsg = await this.chatService.saveMessage(data.roomId, userId, content, { type: 'file', url: data.fileUrl, name: data.fileName });
      this.server.to(data.roomId).emit('new_message', savedMsg);
    } catch (err) {
      this.logger.error(`Error sharing file: ${(err as Error).message}`);
      const errorMsg = this.i18n.t('chat.errors.failed_to_share_file', { defaultValue: 'Failed to share file' });
      client.emit('error', { message: errorMsg });
    }
  }

  @SubscribeMessage('start_video_call')
  async handleStartVideoCall(
    @MessageBody() data: { roomId: string; callLink: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.roomId || !data.callLink) return;

    try {
      const content = `Started a video call. Click to join.`;
      const savedMsg = await this.chatService.saveMessage(data.roomId, userId, content, { type: 'video_call', link: data.callLink });
      this.server.to(data.roomId).emit('new_message', savedMsg);
      this.server.to(data.roomId).emit('incoming_video_call', { roomId: data.roomId, link: data.callLink, callerId: userId });
    } catch (err) {
      this.logger.error(`Error starting video call: ${(err as Error).message}`);
      const errorMsg = this.i18n.t('chat.errors.failed_to_start_video_call', { defaultValue: 'Failed to start video call' });
      client.emit('error', { message: errorMsg });
    }
  }
}