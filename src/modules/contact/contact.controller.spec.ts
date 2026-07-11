import { Test, TestingModule } from '@nestjs/testing';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';

const mockService = {
  create: jest.fn(),
};

describe('ContactController', () => {
  let controller: ContactController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactController],
      providers: [{ provide: ContactService, useValue: mockService }],
    }).compile();
    controller = module.get<ContactController>(ContactController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a contact message', async () => {
      mockService.create.mockResolvedValue({ success: true, reference: 'msg-1', receivedAt: new Date() });

      const result = await controller.create({
        name: 'Test User',
        email: 'test@test.com',
        subject: 'Hello',
        message: 'This is a test message with enough characters.',
      });

      expect(result.success).toBe(true);
      expect(mockService.create).toHaveBeenCalled();
    });
  });
});
