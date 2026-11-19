import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { EncryptedInboxService } from './encrypted-inbox.service';
import { EncryptedInboxController } from './encrypted-inbox.controller';
import { EncryptedInboxGateway } from './encrypted-inbox.gateway';
import { E2EEServerEncryptionService } from './encryption.service';
import { KeyExchangeService } from './key-exchange.service';

/**
 * Encrypted Inbox module providing E2EE messaging capabilities.
 *
 * Architecture:
 * - **Zero-Knowledge**: Messages are encrypted client-side; the server
 *   only stores ciphertext.
 * - **GDPR Compliant**: Server-side encrypted copies exist for data-export
 *   and deletion workflows.
 * - **Real-time**: WebSocket gateway for live encrypted message delivery.
 *
 * Dependencies:
 * - PrismaModule (database)
 * - JwtModule (authentication for REST + WebSocket)
 * - ConfigModule (encryption key configuration)
 *
 * @remarks This module requires the `E2EE_SERVER_KEY` environment variable
 * to be set (64 hex characters). Generate with: `openssl rand -hex 32`
 */
@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_ACCESS_EXPIRES') },
      }),
    }),
  ],
  providers: [
    E2EEServerEncryptionService,
    KeyExchangeService,
    EncryptedInboxService,
    EncryptedInboxGateway,
  ],
  controllers: [EncryptedInboxController],
  exports: [EncryptedInboxService, KeyExchangeService, E2EEServerEncryptionService],
})
export class EncryptedInboxModule {}
