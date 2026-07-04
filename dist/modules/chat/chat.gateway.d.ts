import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
export declare class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly chatService;
    private readonly jwtService;
    server: Server;
    private readonly logger;
    constructor(chatService: ChatService, jwtService: JwtService);
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): void;
    handleJoinRoom(data: {
        roomId: string;
    }, client: Socket): Promise<void>;
    handleMessage(data: {
        roomId: string;
        content: string;
    }, client: Socket): Promise<void>;
    handleShareFile(data: {
        roomId: string;
        fileUrl: string;
        fileName: string;
    }, client: Socket): Promise<void>;
    handleStartVideoCall(data: {
        roomId: string;
        callLink: string;
    }, client: Socket): Promise<void>;
}
