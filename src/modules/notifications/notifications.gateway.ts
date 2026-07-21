import { 
  WebSocketGateway, 
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';

/**
 * WebSocket Gateway for routing real-time in-app notifications.
 * Restricts connection using JWT authentication.
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/notifications'
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  
  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Handle incoming WebSocket connection. Authenticates user and places them in a room.
   */
  async handleConnection(client: Socket) {
    try {
      const tokenString = client.handshake.auth?.token || client.handshake.headers?.authorization;
      if (!tokenString) throw new Error('No authentication token provided');
      
      const token = tokenString.replace('Bearer ', '').trim();
      const payload = this.jwtService.verify(token);
      
      client.data.user = payload;
      
      // Join a room named after their userId to allow targeted emission
      const roomName = `user_${payload.userId}`;
      await client.join(roomName);
      
      this.logger.log(`[NotificationsGateway] User ${payload.userId} connected on socket ${client.id}`);
    } catch (err) {
      this.logger.warn(`[NotificationsGateway] Unauthorized connection attempt: ${client.id}`);
      client.disconnect();
    }
  }

  /**
   * Handle client disconnection.
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`[NotificationsGateway] Client disconnected: ${client.id}`);
  }

  /**
   * Helper to push a real-time notification to a specific user room.
   */
  sendRealTimeNotification(userId: string, notification: any) {
    const roomName = `user_${userId}`;
    this.server.to(roomName).emit('new_notification', notification);
    this.logger.debug(`Real-time WebSocket notification pushed to user room: ${roomName}`);
  }
}
