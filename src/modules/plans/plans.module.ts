import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
