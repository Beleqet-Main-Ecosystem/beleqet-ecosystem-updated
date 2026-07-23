import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Data Transfer Object for creating or retrieving a chat room between two users.
 */
class CreateRoomDto {
  /** Recipient's unique user ID */
  @IsString()
  @IsNotEmpty()
  recipientId: string;

  /** Optional contract ID if linking to an existing employment or freelance contract */
  @IsString()
  @IsOptional()
  contractId?: string;
}

/**
 * REST Controller managing Chat Room operations.
 * Base path: `/api/v1/chat/rooms`
 */
@Controller('chat/rooms')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Creates a new chat room or retrieves an existing room between the authenticated caller and a recipient.
   *
   * @route POST /api/v1/chat/rooms
   * @param req  - HTTP request payload carrying authenticated user token (`req.user.userId`)
   * @param body - Request body containing `recipientId` and optional `contractId`
   * @returns `ChatRoom` entity including participants and recent message
   */
  @Post()
  async createOrGetRoom(
    @Request() req: Express.Request & { user: { userId: string } },
    @Body() body: CreateRoomDto,
  ) {
    const userId = req.user.userId;
    return this.chatService.createOrGetRoom(userId, body.recipientId, body.contractId);
  }

  /**
   * Lists all active chat rooms that the authenticated user participates in.
   * Exposes the recipient's public profile info and the timestamp of the latest encrypted message.
   *
   * @route GET /api/v1/chat/rooms
   * @param req - HTTP request payload carrying authenticated user token (`req.user.userId`)
   * @returns Array of room summary objects containing room ID, recipient metadata, and last message metadata
   */
  @Get()
  async listRooms(
    @Request() req: Express.Request & { user: { userId: string } },
  ) {
    const userId = req.user.userId;

    const rooms = await this.prisma.chatRoom.findMany({
      where: {
        participants: { some: { userId } },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Shape each room: expose the "other" participant and last message
    return rooms.map((room) => {
      const other = room.participants.find((p) => p.userId !== userId);
      const lastMessage = room.messages[0] ?? null;
      return {
        id: room.id,
        contractId: room.contractId,
        createdAt: room.createdAt,
        recipient: other?.user ?? null,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              createdAt: lastMessage.createdAt,
              // content is encrypted ciphertext — don't expose; just show timestamp
              hasContent: !!lastMessage.content,
            }
          : null,
      };
    });
  }
}
