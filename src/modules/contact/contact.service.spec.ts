import { Test, TestingModule } from '@nestjs/testing';
import { ContactService } from './contact.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = {
  contactMessage: {
    create: jest.fn(),
  },
};

describe('ContactService', () => {
  let svc: ContactService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    svc = module.get<ContactService>(ContactService);
  });

  it('should be defined', () => {
    expect(svc).toBeDefined();
  });

  describe('create', () => {
    it('should create a contact message and return success', async () => {
      mockPrisma.contactMessage.create.mockResolvedValue({
        id: 'msg-1',
        createdAt: new Date('2026-01-01'),
      });

      const result = await svc.create({
        name: 'John Doe',
        email: 'john@test.com',
        subject: 'Partnership Inquiry',
        message: 'Hello, I would like to discuss a potential partnership.',
      });

      expect(result.success).toBe(true);
      expect(result.reference).toBe('msg-1');
      expect(mockPrisma.contactMessage.create).toHaveBeenCalledWith({
        data: {
          name: 'John Doe',
          email: 'john@test.com',
          subject: 'Partnership Inquiry',
          message: 'Hello, I would like to discuss a potential partnership.',
        },
        select: { id: true, createdAt: true },
      });
    });

    it('should trim and lowercase inputs', async () => {
      mockPrisma.contactMessage.create.mockResolvedValue({
        id: 'msg-2',
        createdAt: new Date('2026-01-01'),
      });

      await svc.create({
        name: '  Jane Doe  ',
        email: '  JANE@TEST.COM  ',
        subject: '  Support  ',
        message: '  Help me  ',
      });

      expect(mockPrisma.contactMessage.create).toHaveBeenCalledWith({
        data: {
          name: 'Jane Doe',
          email: 'jane@test.com',
          subject: 'Support',
          message: 'Help me',
        },
        select: { id: true, createdAt: true },
      });
    });
  });
});
