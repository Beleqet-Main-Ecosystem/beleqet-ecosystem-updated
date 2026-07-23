import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MessageMetadata } from './message-metadata.interface';

/**
 * Service handling chat room creation, room retrieval, and encrypted message persistence.
 *
 * SECURITY ARCHITECTURE & THREAT MODEL:
 * - End-to-End Encryption (E2EE): The `content` field stores ONLY AES-GCM-256 ciphertext (Base64).
 * - Key Isolation: Server and database NEVER have access to private keys or derived shared secrets.
 * - Initialization Vector: The 12-byte IV is passed in `metadata.iv` (hex) so the recipient client can decrypt.
 * - Non-Repudiation: Senders must be authenticated participants in the target room.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new chat room or fetches an existing room between two users.
   *
   * Handles two scenarios:
   * 1. **Contract-linked Room**: If `contractId` is provided, fetches the room matching `contractId`.
   * 2. **Direct Message Room**: If `contractId` is omitted, queries for an existing 1-on-1 room between
   *    `userId1` and `userId2` (where `contractId` is null). If found, returns that existing room ID;
   *    otherwise, creates a new room with both users as `ChatParticipant` records.
   *
   * @param userId1    - First participant's unique user ID (e.g. current user)
   * @param userId2    - Second participant's unique user ID (e.g. recipient)
   * @param contractId - Optional contract ID if this room is associated with a specific job contract
   * @returns Promise resolving to the existing or newly created `ChatRoom` entity including participants
   */
  async createOrGetRoom(userId1: string, userId2: string, contractId?: string) {
    if (contractId) {
      const existing = await this.prisma.chatRoom.findUnique({
        where: { contractId },
        include: {
          participants: true,
          messages: { take: 1, orderBy: { createdAt: 'desc' } }
        }
      });
      if (existing) return existing;
    } else {
      // Direct message - search for existing room between exactly userId1 and userId2
      const existingRooms = await this.prisma.chatRoom.findMany({
        where: {
          contractId: null,
          participants: {
            every: {
              userId: { in: [userId1, userId2] }
            }
          }
        },
        include: {
          participants: true,
          messages: { take: 1, orderBy: { createdAt: 'desc' } }
        }
      });

      const directRoom = existingRooms.find(r => 
        r.participants.length === 2 && 
        r.participants.some(p => p.userId === userId1) && 
        r.participants.some(p => p.userId === userId2)
      );

      if (directRoom) return directRoom;
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

    this.logger.log(`Created ChatRoom ${room.id} for users ${userId1} and ${userId2}`);
    return room;
  }

  /**
   * Persists an E2EE encrypted message or system event to PostgreSQL.
   *
   * @param roomId   - Target room ID
   * @param senderId - Authenticated sender user ID
   * @param content  - AES-GCM Base64 ciphertext (server MUST NOT attempt decryption)
   * @param metadata - Optional metadata JSON structure containing `iv` (hex) and `encrypted: true`
   * @throws {NotFoundException} If `senderId` is not an active participant in `roomId`
   * @returns Promise resolving to the created `Message` database record
   */
  async saveMessage(
    roomId: string,
    senderId: string,
    content: string,
    metadata?: MessageMetadata
  ) {
    // Verify the sender is a participant in this room
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { roomId_userId: { roomId, userId: senderId } }
    });
    if (!participant) throw new NotFoundException('User is not a participant of this chat room');

    return this.prisma.message.create({
      data: {
        roomId,
        senderId,
        content,   // Encrypted ciphertext — server stores but cannot read
        metadata: (metadata ?? undefined) as unknown as Prisma.InputJsonValue | undefined
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            role: true
          }
        }
      }
    });
  }

  /**
   * Retrieves encrypted message history for a given chat room in ascending chronological order.
   *
   * @param roomId - Target room ID
   * @param userId - Authenticated requesting user ID (must be a participant)
   * @param take   - Max number of messages to return (default 50)
   * @throws {NotFoundException} If `userId` is not an active participant in `roomId`
   * @returns Promise resolving to array of encrypted `Message` records
   */
  async getRoomMessages(roomId: string, userId: string, take = 50) {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { roomId_userId: { roomId, userId } }
    });
    if (!participant) throw new NotFoundException('Unauthorized');

    return this.prisma.message.findMany({
      where: { roomId },
      orderBy: { createdAt: 'asc' },
      take,
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            role: true
          }
        }
      }
    });
  }
}
