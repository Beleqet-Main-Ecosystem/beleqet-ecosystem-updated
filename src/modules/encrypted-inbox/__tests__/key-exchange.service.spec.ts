import { Test, TestingModule } from '@nestjs/testing';
import { KeyExchangeService } from '../key-exchange.service';
import { PrismaService } from '@prisma-client';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('KeyExchangeService', () => {
  let service: KeyExchangeService;
  let prisma: { e2EKeyPair: Record<string, jest.Mock> };

  const mockKeyPair = {
    id: 'kp-1',
    userId: 'user-1',
    publicKey: 'MIIBIjANBgkqhki...public-key',
    encryptedPrivateKey: 'base64-encrypted-private-key',
    algorithm: 'RSA-OAEP-256',
    encryptionKeyVersion: 'v1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      e2EKeyPair: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
        count: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [KeyExchangeService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(KeyExchangeService);
  });

  describe('registerKeyPair', () => {
    it('should register a new key pair', async () => {
      (prisma.e2EKeyPair.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.e2EKeyPair.create as jest.Mock).mockResolvedValue(mockKeyPair);

      const result = await service.registerKeyPair('user-1', {
        publicKey: 'MIIBIjANBgkqhki...public-key',
        encryptedPrivateKey: 'base64-encrypted-private-key',
      });

      expect(result).toEqual(mockKeyPair);
      expect(prisma.e2EKeyPair.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          publicKey: 'MIIBIjANBgkqhki...public-key',
          encryptedPrivateKey: 'base64-encrypted-private-key',
          algorithm: 'RSA-OAEP-256',
        },
      });
    });

    it('should throw ConflictException if key pair already exists', async () => {
      (prisma.e2EKeyPair.findUnique as jest.Mock).mockResolvedValue(mockKeyPair);

      await expect(
        service.registerKeyPair('user-1', {
          publicKey: 'new-public-key',
          encryptedPrivateKey: 'new-encrypted-private-key',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('rotateKeyPair', () => {
    it('should upsert a key pair', async () => {
      (prisma.e2EKeyPair.upsert as jest.Mock).mockResolvedValue(mockKeyPair);

      const result = await service.rotateKeyPair('user-1', {
        publicKey: 'rotated-public-key',
        encryptedPrivateKey: 'rotated-encrypted-private-key',
      });

      expect(result).toEqual(mockKeyPair);
      expect(prisma.e2EKeyPair.upsert).toHaveBeenCalled();
    });
  });

  describe('getPublicKey', () => {
    it('should return the public key for a user', async () => {
      (prisma.e2EKeyPair.findUnique as jest.Mock).mockResolvedValue({
        publicKey: 'test-public-key',
      });

      const result = await service.getPublicKey('user-1');
      expect(result).toBe('test-public-key');
    });

    it('should throw NotFoundException if no key pair exists', async () => {
      (prisma.e2EKeyPair.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getPublicKey('user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEncryptedPrivateKey', () => {
    it('should return the encrypted private key', async () => {
      (prisma.e2EKeyPair.findUnique as jest.Mock).mockResolvedValue({
        encryptedPrivateKey: 'encrypted-key',
      });

      const result = await service.getEncryptedPrivateKey('user-1');
      expect(result).toBe('encrypted-key');
    });

    it('should throw NotFoundException if no key pair exists', async () => {
      (prisma.e2EKeyPair.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getEncryptedPrivateKey('user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('hasKeyPair', () => {
    it('should return true if key pair exists', async () => {
      (prisma.e2EKeyPair.count as jest.Mock).mockResolvedValue(1);
      expect(await service.hasKeyPair('user-1')).toBe(true);
    });

    it('should return false if no key pair exists', async () => {
      (prisma.e2EKeyPair.count as jest.Mock).mockResolvedValue(0);
      expect(await service.hasKeyPair('user-1')).toBe(false);
    });
  });

  describe('deleteKeyPair', () => {
    it('should delete key pair for a user', async () => {
      (prisma.e2EKeyPair.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      await service.deleteKeyPair('user-1');
      expect(prisma.e2EKeyPair.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });

  describe('getPublicKeysForUsers', () => {
    it('should return a map of userId to publicKey', async () => {
      (prisma.e2EKeyPair.findMany as jest.Mock).mockResolvedValue([
        { userId: 'user-1', publicKey: 'key-1' },
        { userId: 'user-2', publicKey: 'key-2' },
      ]);

      const result = await service.getPublicKeysForUsers(['user-1', 'user-2']);
      expect(result.size).toBe(2);
      expect(result.get('user-1')).toBe('key-1');
      expect(result.get('user-2')).toBe('key-2');
    });

    it('should return empty map if no keys found', async () => {
      (prisma.e2EKeyPair.findMany as jest.Mock).mockResolvedValue([]);
      const result = await service.getPublicKeysForUsers(['user-x']);
      expect(result.size).toBe(0);
    });
  });
});
