import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Marked @Global so PrismaService is available to all modules without re-importing */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
