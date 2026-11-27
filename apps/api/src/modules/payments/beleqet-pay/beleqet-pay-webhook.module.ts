import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../../platform/queues/queues.constants';
import { BeleqetPayWebhookController } from './beleqet-pay-webhook.controller';

/** Beleqet Pay's webhook, apart from the client so modules using the client need no queues. */
@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.ESCROW }, { name: QUEUE_NAMES.WALLET })],
  controllers: [BeleqetPayWebhookController],
})
export class BeleqetPayWebhookModule {}
