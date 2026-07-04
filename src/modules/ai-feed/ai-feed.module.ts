import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // ✅ Correct path
import { AiFeedController } from './ai-feed.controller';
import { AiFeedService } from './ai-feed.service';

@Module({
  controllers: [AiFeedController],
  providers: [AiFeedService, PrismaService], // Add PrismaService here
  exports: [AiFeedService],
})
export class AiFeedModule {}
