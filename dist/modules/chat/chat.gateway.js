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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ChatGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const chat_service_1 = require("./chat.service");
const jwt_1 = require("@nestjs/jwt");
const common_1 = require("@nestjs/common");
let ChatGateway = ChatGateway_1 = class ChatGateway {
    constructor(chatService, jwtService) {
        this.chatService = chatService;
        this.jwtService = jwtService;
        this.logger = new common_1.Logger(ChatGateway_1.name);
    }
    async handleConnection(client) {
        try {
            const tokenString = client.handshake.auth?.token || client.handshake.headers?.authorization;
            if (!tokenString)
                throw new Error('No token provided');
            const token = tokenString.replace('Bearer ', '').trim();
            const payload = this.jwtService.verify(token);
            client.data.user = payload;
            this.logger.log(`[ChatGateway] Client connected: ${client.id} (User: ${payload.userId})`);
        }
        catch (err) {
            this.logger.warn(`[ChatGateway] Unauthorized connection attempt: ${client.id}`);
            client.disconnect();
        }
    }
    handleDisconnect(client) {
        this.logger.log(`[ChatGateway] Client disconnected: ${client.id}`);
    }
    async handleJoinRoom(data, client) {
        const userId = client.data.user?.userId;
        if (!userId || !data.roomId)
            return;
        try {
            client.join(data.roomId);
            this.logger.log(`User ${userId} joined room ${data.roomId}`);
            const history = await this.chatService.getRoomMessages(data.roomId, userId);
            client.emit('room_history', history);
        }
        catch (err) {
            this.logger.error(`Error joining room: ${err.message}`);
            client.emit('error', { message: 'Failed to join room' });
        }
    }
    async handleMessage(data, client) {
        const userId = client.data.user?.userId;
        if (!userId || !data.roomId || !data.content)
            return;
        try {
            const savedMsg = await this.chatService.saveMessage(data.roomId, userId, data.content);
            this.server.to(data.roomId).emit('new_message', savedMsg);
        }
        catch (err) {
            this.logger.error(`Error sending message: ${err.message}`);
            client.emit('error', { message: 'Failed to send message' });
        }
    }
    async handleShareFile(data, client) {
        const userId = client.data.user?.userId;
        if (!userId || !data.roomId || !data.fileUrl)
            return;
        try {
            const content = `Shared a file: ${data.fileName}`;
            const savedMsg = await this.chatService.saveMessage(data.roomId, userId, content, { type: 'file', url: data.fileUrl, name: data.fileName });
            this.server.to(data.roomId).emit('new_message', savedMsg);
        }
        catch (err) {
            this.logger.error(`Error sharing file: ${err.message}`);
            client.emit('error', { message: 'Failed to share file' });
        }
    }
    async handleStartVideoCall(data, client) {
        const userId = client.data.user?.userId;
        if (!userId || !data.roomId || !data.callLink)
            return;
        try {
            const content = `Started a video call. Click to join.`;
            const savedMsg = await this.chatService.saveMessage(data.roomId, userId, content, { type: 'video_call', link: data.callLink });
            this.server.to(data.roomId).emit('new_message', savedMsg);
            this.server.to(data.roomId).emit('incoming_video_call', { roomId: data.roomId, link: data.callLink, callerId: userId });
        }
        catch (err) {
            this.logger.error(`Error starting video call: ${err.message}`);
            client.emit('error', { message: 'Failed to start video call' });
        }
    }
};
exports.ChatGateway = ChatGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ChatGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('join_room'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleJoinRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('send_message'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleMessage", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('share_file'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleShareFile", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('start_video_call'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleStartVideoCall", null);
exports.ChatGateway = ChatGateway = ChatGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: { origin: true, credentials: true },
        namespace: '/chat'
    }),
    __metadata("design:paramtypes", [chat_service_1.ChatService,
        jwt_1.JwtService])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map