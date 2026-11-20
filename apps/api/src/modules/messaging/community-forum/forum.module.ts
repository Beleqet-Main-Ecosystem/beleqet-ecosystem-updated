import { Module } from '@nestjs/common';
import { ForumService } from './forum.service';
import { ForumController } from './forum.controller';

@Module({
  providers: [ForumService],
  controllers: [ForumController],
  exports: [ForumService],
})
export class CommunityForumModule {}
