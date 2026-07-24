import { Test, TestingModule } from '@nestjs/testing';
import { KeysService } from './keys.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from './encryption.service';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = {
  userPublicKey: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
};

const mockEncryptionService = {
  encrypt: jest.fn().mockImplementation((val) => `encrypted:${val}`),
  decrypt: jest.fn().mockImplementation((val) => val.replace('encrypted:', '')),
};

describe('KeysService', () => {
  let service: KeysService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeysService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EncryptionService, useValue: mockEncryptionService },
      ],
    }).compile();

    service = module.get<KeysService>(KeysService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerKey', () => {
    it('should encrypt and upsert the public key for a user', async () => {
      const userId = 'user-1';
      const publicKey = 'base64encodedpublickey==';
      const mockRecord = { id: 'key-1', userId, publicKey: 'encrypted:base64encodedpublickey==', createdAt: new Date(), updatedAt: new Date() };

      mockPrisma.userPublicKey.upsert.mockResolvedValue(mockRecord);

      const result = await service.registerKey(userId, publicKey);

      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(publicKey);
      expect(mockPrisma.userPublicKey.upsert).toHaveBeenCalledWith({
        where: { userId },
        update: { publicKey: 'encrypted:base64encodedpublickey==' },
        create: { userId, publicKey: 'encrypted:base64encodedpublickey==' },
      });
        expect(result.publicKey).toBeNull(); // Service should not expose plaintext public key
        expect(result.id).toBe(mockRecord.id);
        expect(result.userId).toBe(userId);
    });
  });

  describe('getKey', () => {
    it('should return and decrypt the public key record when found', async () => {
      const userId = 'user-1';
      const mockRecord = { id: 'key-1', userId, publicKey: 'encrypted:base64key==', createdAt: new Date(), updatedAt: new Date() };

      mockPrisma.userPublicKey.findUnique.mockResolvedValue(mockRecord);

      const result = await service.getKey(userId);
      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith('encrypted:base64key==');
      expect(result).toEqual({ ...mockRecord, publicKey: 'base64key==' });
    });

    it('should throw NotFoundException when key does not exist', async () => {
      mockPrisma.userPublicKey.findUnique.mockResolvedValue(null);

      await expect(service.getKey('unknown-user')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteKey', () => {
    it('should delete the public key record when it exists', async () => {
      const userId = 'user-1';
      const mockRecord = { id: 'key-1', userId, publicKey: 'base64key==', createdAt: new Date(), updatedAt: new Date() };

      mockPrisma.userPublicKey.delete.mockResolvedValue(mockRecord);

      const result = await service.deleteKey(userId);
      expect(mockPrisma.userPublicKey.delete).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(result).toEqual(mockRecord);
    });

    it('should throw NotFoundException when key does not exist or delete fails', async () => {
      mockPrisma.userPublicKey.delete.mockRejectedValue(new Error('Prisma error'));

      await expect(service.deleteKey('unknown-user')).rejects.toThrow(NotFoundException);
    });
  });
});
