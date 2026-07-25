import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EmailService } from './email.service';
import { SendEmailDto } from './dto/send-email.dto';
import { QueryEmailLogDto } from './dto/query-email-log.dto';
import { AdminGuard } from '../../common/guards/admin.guard';

/**
 * Admin-only REST surface for the Email Automation & Service module.
 * The public unsubscribe endpoint lives separately in
 * UnsubscribeController, since it must never sit behind AdminGuard.
 */
@Controller()
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  /** Manually trigger an email (e.g. re-send a welcome email from the admin panel). */
  @UseGuards(AdminGuard)
  @Post('admin/emails/send')
  send(@Body() dto: SendEmailDto) {
    return this.emailService.dispatch(dto);
  }

  /** Paginated, filterable dispatch history for the Email Logs & Status Viewer. */
  @UseGuards(AdminGuard)
  @Get('admin/emails/logs')
  findLogs(@Query() query: QueryEmailLogDto) {
    return this.emailService.findLogs(query);
  }

  /** Single log detail, e.g. to inspect an error message or payload. */
  @UseGuards(AdminGuard)
  @Get('admin/emails/logs/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.emailService.findLogById(id);
  }

  /** Re-queue a failed (or any) email by its log id. */
  @UseGuards(AdminGuard)
  @Post('admin/emails/logs/:id/resend')
  resend(@Param('id', ParseUUIDPipe) id: string) {
    return this.emailService.resend(id);
  }
}
