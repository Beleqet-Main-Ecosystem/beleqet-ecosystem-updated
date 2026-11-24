import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../../prisma/prisma.module';
import { QUEUE_NAMES } from '../../platform/queues/queues.constants';
import { UserNotifier } from './user-notifier';

/** Global, like push: anything that happens to someone can tell them, without a module import. */
@Global()
@Module({
  imports: [PrismaModule, BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATIONS })],
  providers: [UserNotifier],
  exports: [UserNotifier],
})
export class UserNotifierModule {}
