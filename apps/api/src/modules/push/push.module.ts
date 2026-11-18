import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PushController } from './push.controller';
import { PushService } from './push.service';

/** Global, so anything that creates a notification can push it to the mobile app too. */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
