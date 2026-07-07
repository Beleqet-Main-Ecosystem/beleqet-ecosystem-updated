import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ForumService } from './forum.service';
import { CreateThreadDto } from './dto/create-thread.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { ForumQueryDto } from './dto/forum-query.dto';

@ApiTags('community-forum')
@Controller('forum')
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  @Post('threads')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new forum thread' })
  async createThread(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateThreadDto,
  ) {
    const displayName = `${user.email}`;
    return this.forumService.createThread(user.userId, displayName, dto);
  }

  @Get('threads')
  @ApiOperation({ summary: 'List forum threads with pagination, search, and sort' })
  async listThreads(@Query() query: ForumQueryDto) {
    return this.forumService.findThreads(query);
  }

  @Get('threads/:id')
  @ApiOperation({ summary: 'Get a single thread by ID with replies' })
  async getThread(@Param('id', ParseUUIDPipe) id: string) {
    const thread = await this.forumService.findThreadById(id);
    const replies = await this.forumService.findRepliesByThread(id);
    return { ...thread, replies };
  }

  @Post('threads/:id/replies')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reply to a thread' })
  async createReply(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) threadId: string,
    @Body() dto: CreateReplyDto,
  ) {
    const displayName = `${user.email}`;
    return this.forumService.createReply(user.userId, displayName, threadId, dto);
  }

  @Post('threads/:id/upvote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle upvote on a thread' })
  async upvoteThread(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) threadId: string,
  ) {
    return this.forumService.upvoteThread(user.userId, threadId);
  }

  @Post('replies/:id/upvote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle upvote on a reply' })
  async upvoteReply(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) replyId: string,
  ) {
    return this.forumService.upvoteReply(user.userId, replyId);
  }
}
