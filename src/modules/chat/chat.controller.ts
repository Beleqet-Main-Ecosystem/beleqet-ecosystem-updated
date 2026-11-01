import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';

@ApiTags('chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('rooms')
  @ApiOperation({ summary: 'Get current user chat rooms' })
  getMyRooms(@CurrentUser() user: CurrentUserPayload) {
    return this.chatService.getUserRooms(user.userId);
  }

  @Post('rooms')
  @ApiOperation({ summary: 'Create or get a chat room with another user' })
  createOrGetRoom(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { recipientId: string; contractId?: string },
  ) {
    return this.chatService.createOrGetRoom(user.userId, body.recipientId, body.contractId);
  }

  @Get('rooms/:id/messages')
  @ApiOperation({ summary: 'Get room message history' })
  getRoomMessages(@Param('id') roomId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.chatService.getRoomMessages(roomId, user.userId);
  }
}
