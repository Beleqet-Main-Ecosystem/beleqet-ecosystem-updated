import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { TelegramTmaService } from './telegram-tma.service';
import { TmaAuthDto } from './dto/telegram-tma.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('telegram')
@Controller('telegram')
export class TelegramController {
  constructor(private readonly tmaService: TelegramTmaService) {}

  @Post('tma-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user from Telegram Mini App initData' })
  @ApiResponse({
    status: 200,
    description: 'Successfully authenticated and returned JWT token pair',
  })
  @ApiResponse({ status: 401, description: 'Invalid signature or expired timestamp' })
  async tmaLogin(@Body() dto: TmaAuthDto) {
    return this.tmaService.authenticateTmaUser(dto.initData);
  }

  @Post('tma-link')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Link verified Telegram account to logged-in user session' })
  @ApiResponse({ status: 200, description: 'Telegram account linked successfully' })
  @ApiResponse({ status: 409, description: 'Telegram ID already linked to another account' })
  async tmaLink(@CurrentUser() user: CurrentUserPayload, @Body() dto: TmaAuthDto) {
    return this.tmaService.linkTelegramAccount(user.userId, dto.initData);
  }
}
