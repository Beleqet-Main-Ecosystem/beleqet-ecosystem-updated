import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { I18nService, I18nContext } from 'nestjs-i18n';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { QUEUE_NAMES, FRAUD_JOBS } from '../queues/queues.constants';

@ApiTags('fraud-alert')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('fraud-alert')
export class FraudAlertController {
  constructor(
    @InjectQueue(QUEUE_NAMES.FRAUD) private readonly fraudQueue: Queue,
    private readonly i18n: I18nService,
  ) {}

  private t(key: string): string {
    try {
      const lang = I18nContext.current()?.lang ?? 'en';
      return this.i18n.t(key, { lang }) as string;
    } catch {
      return key;
    }
  }

  @Post('scan/user/:userId')
  @ApiOperation({ summary: 'Trigger fraud scan for a specific user' })
  async scanUser(@Param('userId') userId: string) {
    const job = await this.fraudQueue.add(FRAUD_JOBS.SCAN_USER, { userId });
    return { jobId: job.id, message: this.t('fraud.controller.scan_queued_user'), userId };
  }

  @Post('scan/message/:messageId')
  @ApiOperation({ summary: 'Trigger fraud scan for a specific chat message' })
  async scanMessage(@Param('messageId') messageId: string) {
    const job = await this.fraudQueue.add(FRAUD_JOBS.SCAN_MESSAGE, { messageId });
    return { jobId: job.id, message: this.t('fraud.controller.scan_queued_message'), messageId };
  }

  @Post('scan/transaction/:userId')
  @ApiOperation({ summary: 'Trigger fraud scan for wallet transactions of a user' })
  async scanTransaction(@Param('userId') userId: string) {
    const job = await this.fraudQueue.add(FRAUD_JOBS.SCAN_TRANSACTION, { userId });
    return { jobId: job.id, message: this.t('fraud.controller.scan_queued_transaction'), userId };
  }

  @Post('scan/escrow/:userId')
  @ApiOperation({ summary: 'Trigger fraud scan for escrow transactions of a client' })
  async scanEscrowTransaction(@Param('userId') userId: string) {
    const job = await this.fraudQueue.add(FRAUD_JOBS.SCAN_ESCROW_TRANSACTION, { userId });
    return { jobId: job.id, message: this.t('fraud.controller.scan_queued_escrow_transaction'), userId };
  }

  @Post('scan/job/:jobId')
  @ApiOperation({ summary: 'Trigger duplicate-listing scan for a job' })
  async scanJob(@Param('jobId') jobId: string) {
    const job = await this.fraudQueue.add(FRAUD_JOBS.SCAN_JOB, { jobId });
    return { jobId: job.id, message: this.t('fraud.controller.scan_queued_job') };
  }

  @Post('scan/all')
  @ApiOperation({ summary: 'Trigger a batch scan of all active users' })
  async scanAll() {
    const job = await this.fraudQueue.add(FRAUD_JOBS.SCAN_ALL, { skip: 0, take: 100 });
    return { jobId: job.id, message: this.t('fraud.controller.scan_queued_all') };
  }
}
