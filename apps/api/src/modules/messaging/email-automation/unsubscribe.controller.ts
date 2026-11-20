import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { EmailGdprService } from './email-gdpr.service';

/**
 * Public, unauthenticated unsubscribe endpoint. Deliberately outside
 * the /admin/emails controller (and outside AdminGuard) since it must
 * be reachable by anyone who received a newsletter — including logged
 * out recipients. CAN-SPAM/GDPR require this to be a one-click action.
 */
@Controller('email')
export class UnsubscribeController {
  constructor(private readonly gdprService: EmailGdprService) {}

  @Get('unsubscribe')
  async unsubscribe(@Query('recipient') recipient: string, @Query('token') token: string) {
    if (!recipient || !token) {
      throw new BadRequestException('Missing recipient or token');
    }
    if (!this.gdprService.verifyUnsubscribeToken(recipient, token)) {
      throw new BadRequestException('Invalid or expired unsubscribe link');
    }

    await this.gdprService.suppress(recipient, 'unsubscribed');
    return { message: 'You have been unsubscribed from newsletter emails.' };
  }
}
