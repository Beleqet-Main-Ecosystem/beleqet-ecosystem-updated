import { Test, TestingModule } from '@nestjs/testing';
import { FaqBotConsentService } from './services/faq-bot-consent.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockPrismaService = {
  faqBotSession: {
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
};

describe('FaqBotConsentService', () => {
  let service: FaqBotConsentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaqBotConsentService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((_key: string, def?: number) => def) },
        },
      ],
    }).compile();

    service = module.get<FaqBotConsentService>(FaqBotConsentService);
  });

  it('should compute expiry 90 days ahead by default', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const expires = service.computeExpiresAt(now);
    expect(expires.getUTCDate()).toBe(1);
    expect(expires.getUTCMonth()).toBe(3);
  });

  it('should reject when consent was not given', async () => {
    mockPrismaService.faqBotSession.findUnique.mockResolvedValue({
      id: 'session-1',
      consentGiven: false,
      expiresAt: new Date(Date.now() + 86400000),
    });

    await expect(service.assertConsent('session-1')).rejects.toThrow(BadRequestException);
  });

  it('should export session data', async () => {
    mockPrismaService.faqBotSession.findUnique.mockResolvedValue({
      id: 'session-1',
      locale: 'en',
      preferredCurrency: 'ETB',
      consentGiven: true,
      consentAt: new Date(),
      expiresAt: new Date(),
      createdAt: new Date(),
      messages: [],
    });

    const exported = await service.exportSession('session-1');
    expect(exported.session.id).toBe('session-1');
    expect(exported.messages).toEqual([]);
  });

  it('should throw when deleting unknown session', async () => {
    mockPrismaService.faqBotSession.findUnique.mockResolvedValue(null);
    await expect(service.deleteSession('missing')).rejects.toThrow(NotFoundException);
  });
});
