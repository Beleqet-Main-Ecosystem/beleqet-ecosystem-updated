import { Module, Global, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisModule } from '../redis/redis.module';
import { QueuesModule } from '../queues/queues.module';
import { AuthModule } from '../auth/auth.module';
import { TwoFactorController } from './two-factor.controller';
import { TwoFactorService } from './two-factor.service';
import { EncryptionService } from './encryption.service';
import { BackupCodeService } from './backup-code.service';
import { TwoFactorProcessor } from './two-factor.processor';
import { StepUpGuard } from './guards/step-up.guard';

@Global()
@Module({
  imports: [
    forwardRef(() => AuthModule),
    RedisModule,
    QueuesModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_ACCESS_EXPIRES', '15m') },
      }),
    }),
  ],
  controllers: [TwoFactorController],
  providers: [
    TwoFactorService,
    EncryptionService,
    BackupCodeService,
    TwoFactorProcessor,
    StepUpGuard,
  ],
  exports: [TwoFactorService, EncryptionService, StepUpGuard, JwtModule],
})
export class TwoFactorModule {}
