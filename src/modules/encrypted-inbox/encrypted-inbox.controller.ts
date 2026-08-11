import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '@common/decorators/current-user.decorator';
import { EncryptedInboxService } from './encrypted-inbox.service';
import { KeyExchangeService } from './key-exchange.service';
import {
  RegisterKeyPairDto,
  CreateEncryptedConversationDto,
  SendEncryptedMessageDto,
  DeleteMessageDto,
  ListConversationsDto,
  ListMessagesDto,
} from './dto/encrypted-inbox.dto';

/**
 * REST controller for the Encrypted Inbox module.
 *
 * Provides endpoints for E2EE key management, encrypted conversations,
 * and message operations.  All endpoints require JWT authentication.
 *
 * **Zero-Knowledge**: The server only receives and stores ciphertext.
 * Plaintext message content never reaches the server during normal flow.
 *
 * @remarks All routes are prefixed with `/api/v1/encrypted-inbox`
 */
@ApiTags('Encrypted Inbox')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('encrypted-inbox')
export class EncryptedInboxController {
  constructor(
    private readonly inboxService: EncryptedInboxService,
    private readonly keyExchange: KeyExchangeService,
  ) {}

  // ── Key Exchange ──────────────────────────────────────────────────────

  /**
   * Register the user's E2EE key pair.
   *
   * @param user - Current authenticated user
   * @param dto - Public key and encrypted private key
   */
  @Post('keys')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register E2EE key pair',
    description: 'Upload public key and encrypted private key',
  })
  async registerKeys(@CurrentUser() user: CurrentUserPayload, @Body() dto: RegisterKeyPairDto) {
    return this.keyExchange.registerKeyPair(user.userId, dto);
  }

  /**
   * Rotate (replace) the user's E2EE key pair.
   *
   * @param user - Current authenticated user
   * @param dto - New public key and encrypted private key
   */
  @Post('keys/rotate')
  @ApiOperation({
    summary: 'Rotate E2EE key pair',
    description: 'Replace existing key pair with new one',
  })
  async rotateKeys(@CurrentUser() user: CurrentUserPayload, @Body() dto: RegisterKeyPairDto) {
    return this.keyExchange.rotateKeyPair(user.userId, dto);
  }

  /**
   * Get a user's public key for message encryption.
   *
   * @param userId - Target user's UUID
   */
  @Get('keys/:userId')
  @ApiOperation({
    summary: 'Get user public key',
    description: 'Fetch public key for E2EE encryption',
  })
  async getPublicKey(@Param('userId') userId: string) {
    const publicKey = await this.keyExchange.getPublicKey(userId);
    return { userId, publicKey };
  }

  /**
   * Check if the current user has registered an E2EE key pair.
   */
  @Get('keys/status')
  @ApiOperation({
    summary: 'Check E2EE key status',
    description: 'Verify if user has registered keys',
  })
  async getKeyStatus(@CurrentUser() user: CurrentUserPayload) {
    const hasKeys = await this.keyExchange.hasKeyPair(user.userId);
    return { userId: user.userId, hasKeyPair: hasKeys };
  }

  // ── Conversations ─────────────────────────────────────────────────────

  /**
   * Create or get an encrypted conversation with another user.
   *
   * @param user - Current authenticated user
   * @param dto - Contains participantId
   */
  @Post('conversations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create encrypted conversation',
    description: 'Initiate E2EE conversation',
  })
  async createConversation(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateEncryptedConversationDto,
  ) {
    return this.inboxService.createOrGetConversation(user.userId, dto);
  }

  /**
   * List the current user's encrypted conversations.
   *
   * @param user - Current authenticated user
   * @param query - Pagination and filter parameters
   */
  @Get('conversations')
  @ApiOperation({
    summary: 'List conversations',
    description: 'Get paginated encrypted conversations',
  })
  async listConversations(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ListConversationsDto,
  ) {
    return this.inboxService.listConversations(user.userId, query);
  }

  /**
   * Get detailed info about a specific conversation.
   *
   * @param user - Current authenticated user
   * @param conversationId - The conversation UUID
   */
  @Get('conversations/:conversationId')
  @ApiOperation({
    summary: 'Get conversation info',
    description: 'Get conversation details and participant info',
  })
  async getConversationInfo(
    @CurrentUser() user: CurrentUserPayload,
    @Param('conversationId') conversationId: string,
  ) {
    return this.inboxService.getConversationInfo(user.userId, conversationId);
  }

  /**
   * Archive a conversation.
   */
  @Post('conversations/:conversationId/archive')
  @ApiOperation({ summary: 'Archive conversation' })
  async archiveConversation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('conversationId') conversationId: string,
  ) {
    return this.inboxService.archiveConversation(user.userId, conversationId);
  }

  /**
   * Block a conversation (prevents further messages).
   */
  @Post('conversations/:conversationId/block')
  @ApiOperation({ summary: 'Block conversation' })
  async blockConversation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('conversationId') conversationId: string,
  ) {
    return this.inboxService.blockConversation(user.userId, conversationId);
  }

  // ── Messages ──────────────────────────────────────────────────────────

  /**
   * Send an encrypted message.
   *
   * @param user - Current authenticated user
   * @param dto - Encrypted message data (ciphertext + iv)
   */
  @Post('messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send encrypted message',
    description: 'Send E2EE message in a conversation',
  })
  async sendMessage(@CurrentUser() user: CurrentUserPayload, @Body() dto: SendEncryptedMessageDto) {
    return this.inboxService.sendMessage(user.userId, dto);
  }

  /**
   * Get encrypted messages in a conversation.
   *
   * @param user - Current authenticated user
   * @param query - Conversation ID and pagination params
   */
  @Get('messages')
  @ApiOperation({
    summary: 'Get messages',
    description: 'Fetch encrypted messages with cursor pagination',
  })
  async getMessages(@CurrentUser() user: CurrentUserPayload, @Query() query: ListMessagesDto) {
    return this.inboxService.getMessages(user.userId, query);
  }

  /**
   * Soft-delete an encrypted message.
   *
   * @param user - Current authenticated user
   * @param messageId - The message to delete
   * @param dto - Optional reason for deletion
   */
  @Delete('messages/:messageId')
  @ApiOperation({
    summary: 'Delete message',
    description: 'Soft-delete an encrypted message (GDPR)',
  })
  async deleteMessage(
    @CurrentUser() user: CurrentUserPayload,
    @Param('messageId') messageId: string,
    @Body() dto: DeleteMessageDto,
  ) {
    return this.inboxService.deleteMessage(user.userId, messageId, dto.reason);
  }

  // ── GDPR Endpoints ────────────────────────────────────────────────────

  /**
   * Export all encrypted data for the current user.
   *
   * Decrypts server-side copies and packages them for download.
   * Requires recent authentication (should be protected by StepUpGuard
   * in production).
   *
   * @param user - Current authenticated user
   */
  @Get('gdpr/export')
  @ApiOperation({
    summary: 'GDPR data export',
    description: 'Export all encrypted inbox data (server-decrypted copies)',
  })
  async gdprExport(@CurrentUser() user: CurrentUserPayload) {
    return this.inboxService.exportUserData(user.userId);
  }

  /**
   * Delete all encrypted data for the current user.
   *
   * Scrubs all sent messages and deletes key pair.
   * Requires recent authentication.
   *
   * @param user - Current authenticated user
   */
  @Delete('gdpr/delete')
  @ApiOperation({
    summary: 'GDPR data deletion',
    description: 'Permanently delete all encrypted inbox data',
  })
  async gdprDelete(@CurrentUser() user: CurrentUserPayload) {
    return this.inboxService.deleteAllUserData(user.userId);
  }
}
