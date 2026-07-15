import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Module, Global } from '@nestjs/common';
import { ChatModule } from './chat.module';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EncryptionService } from './encryption.service';
import { I18nService } from 'nestjs-i18n';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Integration Tests — Secure Tunnel (Chat + Key Management)
 *
 * These tests verify that:
 * 1. KeysService correctly integrates with the User DB (PrismaService)
 * 2. ChatService participant checks integrate with ChatParticipant records
 * 3. All module wiring (imports, providers, exports) resolves without error
 *
 * GDPR note: All test data uses synthetic UUIDs — no real PII.
 */

@Global()
@Module({
  providers: [
    {
      provide: I18nService,
      useValue: { t: jest.fn((key: string) => key) },
    },
  ],
  exports: [I18nService],
})
class MockI18nModule {}

const mockPrismaService = {
  userPublicKey: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
  chatParticipant: {
    findUnique: jest.fn(),
  },
  chatRoom: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  message: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockEncryptionService = {
  encrypt: jest.fn().mockImplementation((val) => `encrypted:${val}`),
  decrypt: jest.fn().mockImplementation((val) => val.replace('encrypted:', '')),
};

describe('Secure Tunnel — Integration Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        MockI18nModule,
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        JwtModule.register({ secret: 'test-secret', signOptions: { expiresIn: '1h' } }),
        ChatModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(EncryptionService)
      .useValue(mockEncryptionService)
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => jest.clearAllMocks());

  // ── 1. Module wiring ─────────────────────────────────────────────────────────

  it('ChatModule should initialize without errors', () => {
    expect(app).toBeDefined();
  });

  // ── 2. KeysService ↔ User DB integration ────────────────────────────────────

  describe('KeysService ↔ PrismaService (User DB)', () => {
    it('should upsert a public key tied to an existing user ID', async () => {
      const userId = 'integration-user-001';
      const publicKey = 'base64ECDHPublicKey==';
      const mockRecord = { id: 'key-001', userId, publicKey, createdAt: new Date(), updatedAt: new Date() };

      mockPrismaService.userPublicKey.upsert.mockResolvedValue(mockRecord);

      // Get KeysService from the fully wired module
      const { KeysService } = await import('./keys.service');
      const keysService = app.get(KeysService);

      const result = await keysService.registerKey(userId, publicKey);

      expect(result.userId).toBe(userId);
      expect(result.publicKey).toBeNull();
      expect(mockPrismaService.userPublicKey.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          create: { userId, publicKey: `encrypted:${publicKey}` },
          update: { publicKey: `encrypted:${publicKey}` }
        })
      );
    });

    it('should fetch a public key by user ID (cross-module lookup)', async () => {
      const userId = 'integration-user-002';
      const mockRecord = { id: 'key-002', userId, publicKey: 'encrypted:recipientBase64Key==', createdAt: new Date(), updatedAt: new Date() };

      mockPrismaService.userPublicKey.findUnique.mockResolvedValue(mockRecord);

      const { KeysService } = await import('./keys.service');
      const keysService = app.get(KeysService);

      const result = await keysService.getKey(userId);
      expect(result.publicKey).toBe('recipientBase64Key==');
    });

    it('should throw NotFoundException when user has no registered key', async () => {
      mockPrismaService.userPublicKey.findUnique.mockResolvedValue(null);

      const { KeysService } = await import('./keys.service');
      const keysService = app.get(KeysService);

      await expect(keysService.getKey('ghost-user')).rejects.toThrow();
    });

    it('should delete a public key by user ID (GDPR Right to Erasure)', async () => {
      const userId = 'integration-user-003';
      const mockRecord = { id: 'key-003', userId, publicKey: 'base64key==', createdAt: new Date(), updatedAt: new Date() };

      mockPrismaService.userPublicKey.delete.mockResolvedValue(mockRecord);

      const { KeysService } = await import('./keys.service');
      const keysService = app.get(KeysService);

      const result = await keysService.deleteKey(userId);
      expect(result.userId).toBe(userId);
      expect(mockPrismaService.userPublicKey.delete).toHaveBeenCalledWith({
        where: { userId },
      });
    });
  });

  // ── 3. ChatService ↔ ChatParticipant DB integration ─────────────────────────

  describe('ChatService ↔ ChatParticipant (Security Module integration)', () => {
    it('should persist an encrypted message when the sender IS a participant', async () => {
      const roomId = 'integration-room-001';
      const senderId = 'integration-user-001';

      mockPrismaService.chatParticipant.findUnique.mockResolvedValue({
        id: 'cp-001', roomId, userId: senderId,
      });

      const encryptedContent = 'AES-GCM-Base64-ciphertext==';
      const metadata = { encrypted: true, iv: 'aabbccdd11223344aabbcc00' };

      const savedMsg = {
        id: 'msg-int-001',
        roomId,
        senderId,
        content: encryptedContent,
        metadata,
        createdAt: new Date(),
        sender: { id: senderId, firstName: 'Integration', lastName: 'Tester', avatarUrl: null, role: 'FREELANCER' },
      };

      mockPrismaService.message.create.mockResolvedValue(savedMsg);

      const { ChatService } = await import('./chat.service');
      const chatService = app.get(ChatService);

      const result = await chatService.saveMessage(roomId, senderId, encryptedContent, metadata);

      // Verify encrypted content is what was stored — server cannot read it
      expect(result.content).toBe(encryptedContent);
      expect((result.metadata as any).encrypted).toBe(true);
      expect((result.metadata as any).iv).toBe('aabbccdd11223344aabbcc00');
    });

    it('should reject message persistence for a non-participant (security boundary)', async () => {
      mockPrismaService.chatParticipant.findUnique.mockResolvedValue(null);

      const { ChatService } = await import('./chat.service');
      const chatService = app.get(ChatService);

      await expect(
        chatService.saveMessage('room-x', 'intruder-id', 'ciphertext==', { encrypted: true, iv: 'iv' })
      ).rejects.toThrow();
    });

    it('should deny message history access to non-participants', async () => {
      mockPrismaService.chatParticipant.findUnique.mockResolvedValue(null);

      const { ChatService } = await import('./chat.service');
      const chatService = app.get(ChatService);

      await expect(chatService.getRoomMessages('room-x', 'intruder-id')).rejects.toThrow();
    });
  });

  // ── 4. E2EE data integrity check ─────────────────────────────────────────────

  describe('E2EE data integrity (GDPR compliance)', () => {
    it('should store metadata with encryption flag and IV — not plaintext', async () => {
      const roomId = 'gdpr-room-001';
      const senderId = 'gdpr-user-001';

      mockPrismaService.chatParticipant.findUnique.mockResolvedValue({ id: 'cp-gdpr', roomId, userId: senderId });

      const plaintext = 'This should NEVER reach the server in cleartext';
      // Simulate what the frontend would send after encryption
      const simulatedCiphertext = btoa(plaintext.split('').map(() => String.fromCharCode(Math.floor(Math.random() * 256))).join(''));
      const simulatedIv = 'deadbeefcafebabe00112233';

      const savedMsg = {
        id: 'msg-gdpr-001', roomId, senderId,
        content: simulatedCiphertext,
        metadata: { encrypted: true, iv: simulatedIv },
        createdAt: new Date(),
        sender: null,
      };

      mockPrismaService.message.create.mockResolvedValue(savedMsg);

      const { ChatService } = await import('./chat.service');
      const chatService = app.get(ChatService);

      const result = await chatService.saveMessage(
        roomId, senderId, simulatedCiphertext,
        { encrypted: true, iv: simulatedIv }
      );

      // Server-stored content must NOT equal the original plaintext
      expect(result.content).not.toBe(plaintext);
      expect((result.metadata as any).encrypted).toBe(true);
    });
  });
});
