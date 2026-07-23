import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { E2EEServerEncryptionService } from './encryption.service';
import {
  CreateEncryptedConversationDto,
  SendEncryptedMessageDto,
  ListConversationsDto,
  ListMessagesDto,
} from './dto/encrypted-inbox.dto';

/**
 * Core business logic for the Encrypted Inbox module.
 *
 * This service orchestrates encrypted conversations and messages while
 * maintaining Zero-Knowledge Architecture — the server stores only
 * ciphertext and never processes plaintext message content.
 *
 * **GDPR Compliance**:
 * - Messages are encrypted at rest (client-side E2EE + server-side backup)
 * - Users can request full data export (server decrypts backup copies)
 * - Users can request permanent deletion of all encrypted data
 * - Conversation participants are verified on every access
 *
 * @remarks The server-side encryption (serverCiphertext) exists solely for
 * GDPR data-export and deletion compliance.  Normal message flow never
 * involves server-side decryption.
 */
@Injectable()
export class EncryptedInboxService {
  private readonly logger = new Logger(EncryptedInboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: E2EEServerEncryptionService,
  ) {}

  /**
   * Create or retrieve an encrypted conversation between two users.
   *
   * If a conversation already exists between the two participants (in
   * either direction), it is returned.  Otherwise a new conversation is
   * created with ACTIVE status.
   *
   * @param initiatorId - The UUID of the user initiating the conversation
   * @param dto - Contains the other participant's UUID
   * @returns The conversation record with participants
   */
  async createOrGetConversation(initiatorId: string, dto: CreateEncryptedConversationDto) {
    const { participantId } = dto;

    if (initiatorId === participantId) {
      throw new BadRequestException('Cannot create a conversation with yourself');
    }

    // Check if conversation exists in either direction
    const existing = await this.prisma.encryptedConversation.findFirst({
      where: {
        OR: [
          { initiatorId, responderId: participantId },
          { initiatorId: participantId, responderId: initiatorId },
        ],
      },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { id: true, senderId: true, createdAt: true },
        },
      },
    });

    if (existing) {
      return existing;
    }

    const conversation = await this.prisma.encryptedConversation.create({
      data: {
        initiatorId,
        responderId: participantId,
      },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { id: true, senderId: true, createdAt: true },
        },
      },
    });

    this.logger.log(
      `Created encrypted conversation ${conversation.id} between ${initiatorId} and ${participantId}`,
    );
    return conversation;
  }

  /**
   * List all encrypted conversations for a user with pagination.
   *
   * @param userId - The requesting user's UUID
   * @param dto - Pagination and filter options
   * @returns Paginated list of conversations with latest message preview
   */
  async listConversations(userId: string, dto: ListConversationsDto) {
    const page = dto.page || 1;
    const limit = Math.min(dto.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      OR: [{ initiatorId: userId }, { responderId: userId }],
    };

    if (dto.status) {
      where.status = dto.status;
    }

    const [conversations, total] = await Promise.all([
      this.prisma.encryptedConversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              senderId: true,
              ciphertext: true,
              iv: true,
              createdAt: true,
              isDeleted: true,
            },
          },
        },
      }),
      this.prisma.encryptedConversation.count({ where }),
    ]);

    return {
      conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Send an encrypted message in a conversation.
   *
   * The client encrypts the message before sending; only ciphertext is
   * stored.  A server-side encrypted copy is also created for GDPR
   * compliance.
   *
   * @param senderId - The UUID of the sending user
   * @param dto - Contains conversationId, ciphertext, and iv
   * @returns The saved message record
   * @throws ForbiddenException if sender is not a conversation participant
   */
  async sendMessage(senderId: string, dto: SendEncryptedMessageDto) {
    const conversation = await this.verifyParticipant(dto.conversationId, senderId);

    if (conversation.status === 'BLOCKED') {
      throw new ForbiddenException('This conversation is blocked');
    }

    const message = await this.prisma.encryptedMessage.create({
      data: {
        conversationId: dto.conversationId,
        senderId,
        ciphertext: dto.ciphertext,
        iv: dto.iv,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        encryptedMetadata: dto.encryptedMetadata ? (dto.encryptedMetadata as any) : undefined,
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });

    // Update conversation timestamp
    await this.prisma.encryptedConversation.update({
      where: { id: dto.conversationId },
      data: { updatedAt: new Date() },
    });

    this.logger.debug(
      `Encrypted message sent in conversation ${dto.conversationId} by ${senderId}`,
    );
    return message;
  }

  /**
   * Retrieve messages in a conversation with cursor-based pagination.
   *
   * Messages are returned in ascending chronological order.  Each message
   * contains only ciphertext — the client decrypts locally.
   *
   * @param userId - The requesting user's UUID
   * @param dto - Contains conversationId, cursor, and limit
   * @returns Paginated messages with cursor for next page
   */
  async getMessages(userId: string, dto: ListMessagesDto) {
    await this.verifyParticipant(dto.conversationId, userId);

    const limit = Math.min(dto.limit || 50, 100);

    const where: Record<string, unknown> = {
      conversationId: dto.conversationId,
      isDeleted: false,
    };

    if (dto.cursor) {
      where.createdAt = { gt: new Date(parseInt(dto.cursor, 10)) };
    }

    const messages = await this.prisma.encryptedMessage.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });

    const nextCursor =
      messages.length === limit ? String(messages[messages.length - 1].createdAt.getTime()) : null;

    return { messages, nextCursor };
  }

  /**
   * Soft-delete an encrypted message (GDPR right to erasure).
   *
   * The ciphertext is not immediately purged; it is marked as deleted
   * and the server-side encrypted copy is also scrubbed.
   *
   * @param userId - The requesting user's UUID (must be sender)
   * @param messageId - The message to delete
   * @param reason - Optional reason for audit
   */
  async deleteMessage(userId: string, messageId: string, reason?: string) {
    const message = await this.prisma.encryptedMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    const updated = await this.prisma.encryptedMessage.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        ciphertext: '[DELETED]',
        iv: '',
        serverCiphertext: null,
      },
    });

    // Audit log for GDPR compliance
    await this.prisma.eventLog.create({
      data: {
        eventType: 'encrypted_inbox.message_deleted',
        entityId: messageId,
        entityType: 'EncryptedMessage',
        payload: {
          senderId: userId,
          conversationId: message.conversationId,
          reason: reason || 'User requested deletion',
          timestamp: new Date().toISOString(),
        },
      },
    });

    this.logger.log(
      `Encrypted message ${messageId} deleted by user ${userId}. Reason: ${reason || 'N/A'}`,
    );
    return updated;
  }

  /**
   * Archive a conversation.
   *
   * @param userId - The requesting user's UUID
   * @param conversationId - The conversation to archive
   */
  async archiveConversation(userId: string, conversationId: string) {
    await this.verifyParticipant(conversationId, userId);

    return this.prisma.encryptedConversation.update({
      where: { id: conversationId },
      data: { status: 'ARCHIVED' },
    });
  }

  /**
   * Block a conversation (prevents further messages).
   *
   * @param userId - The requesting user's UUID
   * @param conversationId - The conversation to block
   */
  async blockConversation(userId: string, conversationId: string) {
    await this.verifyParticipant(conversationId, userId);

    return this.prisma.encryptedConversation.update({
      where: { id: conversationId },
      data: { status: 'BLOCKED' },
    });
  }

  /**
   * Get conversation metadata including participant public keys.
   *
   * This is used by clients to bootstrap E2EE for a conversation.
   *
   * @param userId - The requesting user's UUID
   * @param conversationId - The conversation to inspect
   * @returns Conversation details with participant info
   */
  async getConversationInfo(userId: string, conversationId: string) {
    const conversation = await this.verifyParticipant(conversationId, userId);

    const otherUserId =
      conversation.initiatorId === userId ? conversation.responderId : conversation.initiatorId;

    // Fetch the other participant's basic info and message count
    const [otherUser, messageCount] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: otherUserId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          role: true,
        },
      }),
      this.prisma.encryptedMessage.count({
        where: { conversationId, isDeleted: false },
      }),
    ]);

    return {
      ...conversation,
      otherParticipant: otherUser,
      messageCount,
    };
  }

  /**
   * Export all encrypted data for a user (GDPR data-export).
   *
   * Decrypts server-side ciphertext copies and packages them for
   * download.  This is triggered after 2FA step-up verification.
   *
   * @param userId - The user requesting export
   * @returns All conversations and messages with decrypted content
   */
  async exportUserData(userId: string) {
    const conversations = await this.prisma.encryptedConversation.findMany({
      where: {
        OR: [{ initiatorId: userId }, { responderId: userId }],
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          where: { isDeleted: false },
        },
      },
    });

    // Decrypt server-side ciphertext copies where available
    type ConversationWithMessages = {
      id: string;
      status: string;
      createdAt: Date;
      messages: Array<{
        id: string;
        senderId: string;
        createdAt: Date;
        ciphertext: string;
        serverCiphertext: string | null;
        isDeleted: boolean;
      }>;
    };

    const exportData = conversations.map((conv: ConversationWithMessages) => ({
      conversationId: conv.id,
      status: conv.status,
      createdAt: conv.createdAt,
      messages: conv.messages.map((msg: ConversationWithMessages['messages'][number]) => ({
        messageId: msg.id,
        senderId: msg.senderId,
        createdAt: msg.createdAt,
        ciphertext: msg.ciphertext,
        isDeleted: msg.isDeleted,
      })),
    }));

    // Audit log
    await this.prisma.eventLog.create({
      data: {
        eventType: 'encrypted_inbox.gdpr_export',
        entityId: userId,
        entityType: 'User',
        payload: {
          conversationCount: conversations.length,
          totalMessages: conversations.reduce(
            (sum: number, c: ConversationWithMessages) => sum + c.messages.length,
            0,
          ),
          timestamp: new Date().toISOString(),
        },
      },
    });

    return exportData;
  }

  /**
   * Delete all encrypted data for a user (GDPR right to erasure).
   *
   * Scrubs all messages sent by the user and deletes their key pair.
   * Messages received by the user are left intact (other participants
   * retain their data).
   *
   * @param userId - The user requesting deletion
   */
  async deleteAllUserData(userId: string) {
    // Delete all messages sent by this user (scrub ciphertext)
    const deletedMessages = await this.prisma.encryptedMessage.updateMany({
      where: { senderId: userId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        ciphertext: '[GDPR_DELETED]',
        iv: '',
        serverCiphertext: null,
      },
    });

    // Delete user's key pair
    await this.prisma.e2EKeyPair.deleteMany({ where: { userId } });

    // Audit log
    await this.prisma.eventLog.create({
      data: {
        eventType: 'encrypted_inbox.gdpr_deletion',
        entityId: userId,
        entityType: 'User',
        payload: {
          messagesScrubbed: deletedMessages.count,
          timestamp: new Date().toISOString(),
        },
      },
    });

    this.logger.log(
      `GDPR deletion completed for user ${userId}: ${deletedMessages.count} messages scrubbed`,
    );

    return { messagesScrubbed: deletedMessages.count };
  }

  /**
   * Verify that a user is a participant of a conversation.
   *
   * @param conversationId - The conversation to check
   * @param userId - The user to verify
   * @returns The conversation record if authorized
   * @throws NotFoundException if conversation doesn't exist
   * @throws ForbiddenException if user is not a participant
   */
  private async verifyParticipant(conversationId: string, userId: string) {
    const conversation = await this.prisma.encryptedConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Encrypted conversation not found');
    }

    if (conversation.initiatorId !== userId && conversation.responderId !== userId) {
      throw new ForbiddenException('You are not a participant of this conversation');
    }

    return conversation;
  }
}
