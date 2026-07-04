"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ChatService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let ChatService = ChatService_1 = class ChatService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(ChatService_1.name);
    }
    async createOrGetRoom(userId1, userId2, contractId) {
        if (contractId) {
            const existing = await this.prisma.chatRoom.findUnique({
                where: { contractId },
                include: { participants: true, messages: { take: 1, orderBy: { createdAt: 'desc' } } }
            });
            if (existing)
                return existing;
        }
        const room = await this.prisma.chatRoom.create({
            data: {
                contractId,
                participants: {
                    create: [{ userId: userId1 }, { userId: userId2 }]
                }
            },
            include: { participants: true, messages: true }
        });
        this.logger.log(`Created new ChatRoom ${room.id} for users ${userId1} and ${userId2}`);
        return room;
    }
    async saveMessage(roomId, senderId, content, metadata) {
        const participant = await this.prisma.chatParticipant.findUnique({
            where: { roomId_userId: { roomId, userId: senderId } }
        });
        if (!participant)
            throw new common_1.NotFoundException('User is not a participant of this chat room');
        return this.prisma.message.create({
            data: {
                roomId,
                senderId,
                content,
                metadata
            },
            include: {
                sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true } }
            }
        });
    }
    async getRoomMessages(roomId, userId, take = 50) {
        const participant = await this.prisma.chatParticipant.findUnique({
            where: { roomId_userId: { roomId, userId } }
        });
        if (!participant)
            throw new common_1.NotFoundException('Unauthorized');
        return this.prisma.message.findMany({
            where: { roomId },
            orderBy: { createdAt: 'asc' },
            take,
            include: {
                sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true } }
            }
        });
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = ChatService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ChatService);
//# sourceMappingURL=chat.service.js.map