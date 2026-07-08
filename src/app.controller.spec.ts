import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController Health Check', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root endpoint', () => {
    it('should return valid orchestration health status', () => {
      const response = appController.getHello(); // ወይም በ controller ፋይሉ ላይ ያለውን ዋና ፈንክሽን ስም እዚህ ይተኩ
      expect(response).toBeDefined();
    });
  });
});