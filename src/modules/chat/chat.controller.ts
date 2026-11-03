import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';

class CreateRoomDto {
  @IsString() recipientId: string;
  @IsOptional() @IsString() contractId?: string;
}

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
  createOrGetRoom(@CurrentUser() user: CurrentUserPayload, @Body() body: CreateRoomDto) {
    return this.chatService.createOrGetRoom(user.userId, body.recipientId, body.contractId);
  }

  @Get('rooms/:id/messages')
  @ApiOperation({ summary: 'Get room message history' })
  getRoomMessages(@Param('id') roomId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.chatService.getRoomMessages(roomId, user.userId);
  }

  @Post('rooms/:id/read')
  @ApiOperation({ summary: 'Mark a room read' })
  markRead(@Param('id') roomId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.chatService.markRead(roomId, user.userId);
  }
}
