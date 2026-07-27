import { Module } from '@nestjs/common';
import { GdprGuardService } from './gdpr-guard.service';
import { GdprGuardController } from './gdpr-guard.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GdprGuardController],
  providers: [GdprGuardService],
  exports: [GdprGuardService],
})
export class GdprGuardModule {}
