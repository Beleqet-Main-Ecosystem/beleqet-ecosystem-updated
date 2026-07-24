import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { KeysService } from './keys.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { IsString, IsNotEmpty } from 'class-validator';

class RegisterKeyDto {
  @IsString()
  @IsNotEmpty()
  publicKey: string;
}

/**
 * Controller to manage client-side public key uploads/downloads.
 */
@Controller('chat/keys')
export class KeysController {
  constructor(private readonly keysService: KeysService) {}

  /**
   * Register or update the caller's E2EE public key.
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async registerKey(@Request() req: Express.Request & { user: { userId: string } }, @Body() body: RegisterKeyDto) {
    const userId = req.user.userId;
    return this.keysService.registerKey(userId, body.publicKey);
  }

  /**
   * Fetch another user's E2EE public key by their User ID.
   */
  @Get(':userId')
  @UseGuards(JwtAuthGuard)
  async getKey(@Param('userId') userId: string) {
    return this.keysService.getKey(userId);
  }

  /**
   * Delete the caller's E2EE public key (GDPR Right to Erasure / Reset).
   */
  @Delete()
  @UseGuards(JwtAuthGuard)
  async deleteKey(@Request() req: Express.Request & { user: { userId: string } }) {
    const userId = req.user.userId;
    return this.keysService.deleteKey(userId);
  }
}
