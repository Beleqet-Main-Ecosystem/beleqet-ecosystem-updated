import { PrismaService } from '../../prisma/prisma.service';
export declare class ChatService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    createOrGetRoom(userId1: string, userId2: string, contractId?: string): Promise<any>;
    saveMessage(roomId: string, senderId: string, content: string, metadata?: any): Promise<any>;
    getRoomMessages(roomId: string, userId: string, take?: number): Promise<any>;
}
