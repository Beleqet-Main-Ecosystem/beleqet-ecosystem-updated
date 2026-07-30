import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  Headers,
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
    const displayName = user.email.substring(0, user.email.indexOf('@'));
    return this.forumService.createThread(user.userId, displayName, dto);
  }

  @Get('threads')
  @ApiOperation({ summary: 'List forum threads with pagination, search, and sort' })
  async listThreads(@Query() query: ForumQueryDto) {
    return this.forumService.findThreads(query);
  }

  @Get('threads/:id')
  @ApiOperation({ summary: 'Get a single thread by ID with replies' })
  async getThread(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('accept-language') lang = 'en',
  ) {
    const thread = await this.forumService.findThreadById(id, lang);
    const replies = await this.forumService.findRepliesByThread(id, lang);
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
    @Headers('accept-language') lang = 'en',
  ) {
    const displayName = user.email.substring(0, user.email.indexOf('@'));
    return this.forumService.createReply(user.userId, displayName, threadId, dto, lang);
  }

  @Post('threads/:id/upvote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle upvote on a thread' })
  async upvoteThread(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) threadId: string,
    @Headers('accept-language') lang = 'en',
  ) {
    return this.forumService.upvoteThread(user.userId, threadId, lang);
  }

  @Post('replies/:id/upvote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle upvote on a reply' })
  async upvoteReply(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) replyId: string,
    @Headers('accept-language') lang = 'en',
  ) {
    return this.forumService.upvoteReply(user.userId, replyId, lang);
  }

  @Delete('my-data')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'GDPR erasure — anonymize all forum data for the current user' })
  async eraseMyData(@CurrentUser() user: CurrentUserPayload) {
    await this.forumService.anonymizeUserData(user.userId);
    return { message: 'Your forum data has been anonymized.' };
  }
}
