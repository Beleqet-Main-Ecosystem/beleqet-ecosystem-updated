import { Test, TestingModule } from '@nestjs/testing';
import { Injectable, Controller } from '@nestjs/common';

@Injectable()
class MockAppService {
  getHello(): string {
    return 'Hello World!';
  }
}

@Controller()
class MockAppController {
  constructor(private readonly appService: MockAppService) {}
  getHello(): string {
    return this.appService.getHello();
  }
}

describe('AppController', () => {
  let appController: MockAppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [MockAppController],
      providers: [MockAppService],
    }).compile();

    appController = app.get<MockAppController>(MockAppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});