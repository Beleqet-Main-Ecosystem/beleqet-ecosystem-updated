import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for registering a user's E2EE key pair.
 *
 * The public key is stored in plaintext (safe to share) while the private
 * key is stored encrypted on the server.  The actual decryption happens
 * client-side — this is the core of our Zero-Knowledge Architecture.
 *
 * @remarks GDPR: Storing the encrypted private key server-side allows us to
 * facilitate data-export requests without breaking E2EE, since the user can
 * decrypt their own private key on a verified device.
 */
export class RegisterKeyPairDto {
  @ApiProperty({ description: 'SPKI-encoded public key (plaintext)' })
  @IsString()
  @IsNotEmpty()
  publicKey!: string;

  @ApiProperty({ description: 'AES-256-GCM encrypted private key (server cannot decrypt)' })
  @IsString()
  @IsNotEmpty()
  encryptedPrivateKey!: string;

  @ApiPropertyOptional({ description: 'Encryption algorithm', default: 'RSA-OAEP-256' })
  @IsString()
  @IsOptional()
  algorithm?: string;
}

/**
 * DTO for initiating a new encrypted conversation.
 */
export class CreateEncryptedConversationDto {
  @ApiProperty({ description: 'UUID of the other participant' })
  @IsString()
  @IsNotEmpty()
  participantId!: string;
}

/**
 * DTO for sending an encrypted message.
 *
 * The client encrypts the message content before sending; only the
 * ciphertext and initialization vector are transmitted to the server.
 * The server stores the ciphertext and optionally creates a server-side
 * encrypted copy for GDPR compliance.
 */
export class SendEncryptedMessageDto {
  @ApiProperty({ description: 'UUID of the encrypted conversation' })
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @ApiProperty({ description: 'AES-256-GCM ciphertext of the message' })
  @IsString()
  @IsNotEmpty()
  ciphertext!: string;

  @ApiProperty({ description: 'Initialization vector used for client-side encryption' })
  @IsString()
  @IsNotEmpty()
  iv!: string;

  @ApiPropertyOptional({ description: 'Encrypted message metadata (type, filename, etc.)' })
  @IsOptional()
  encryptedMetadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Server-side encrypted copy for GDPR export' })
  @IsString()
  @IsOptional()
  serverCiphertext?: string;
}

/**
 * DTO for soft-deleting an encrypted message (GDPR right to erasure).
 */
export class DeleteMessageDto {
  @ApiPropertyOptional({ description: 'Reason for deletion (audit trail)' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

/**
 * DTO for GDPR data-export request.
 *
 * Allows a user to request a full export of their encrypted inbox data.
 * The server decrypts the server-side ciphertext copies and packages them
 * for download.
 */
export class GdprExportRequestDto {
  @ApiPropertyOptional({ description: 'Optional format preference' })
  @IsString()
  @IsOptional()
  @IsEnum(['json', 'csv'])
  format?: 'json' | 'csv';
}

/**
 * DTO for GDPR data-deletion request.
 */
export class GdprDeletionRequestDto {
  @ApiProperty({ description: 'Confirm intent to permanently delete all encrypted messages' })
  @IsBoolean()
  @IsNotEmpty()
  confirmDeletion!: boolean;

  @ApiPropertyOptional({ description: 'Reason for deletion' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

/**
 * DTO for querying encrypted conversations with pagination.
 */
export class ListConversationsDto {
  @ApiPropertyOptional({ description: 'Page number (1-indexed)', default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsEnum(['ACTIVE', 'ARCHIVED', 'BLOCKED'])
  @IsOptional()
  status?: string;
}

/**
 * DTO for querying messages in a conversation with cursor-based pagination.
 */
export class ListMessagesDto {
  @ApiProperty({ description: 'UUID of the conversation' })
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @ApiPropertyOptional({ description: 'Cursor for pagination (message ID)' })
  @IsString()
  @IsOptional()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Number of messages to fetch', default: 50 })
  @IsOptional()
  limit?: number;
}
