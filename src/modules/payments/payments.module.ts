/**
 * @file payments.module.ts
 * @description
 * NestJS module that wires together the Global Payment Gateway
 * (Stripe + PayPal) for the Beleqet platform.
 *
 * Registers:
 *  - StripeService        (Global-Payments-001)
 *  - PaypalService        (Global-Payments-002)
 *  - StripeController
 *  - StripeWebhookController
 *  - PaypalController
 *  - PaypalWebhookController
 *  - PrismaModule         (for DB persistence)
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../../prisma/prisma.module';

import { StripeService }             from './stripe.service';
import { PaypalService }             from './paypal.service';
import {
  StripeController,
  StripeWebhookController,
  PaypalController,
  PaypalWebhookController,
} from './payments.controller';

@Module({
  imports: [
    ConfigModule, // provides ConfigService to both services
    PrismaModule, // provides PrismaService for DB persistence
  ],
  controllers: [
    StripeController,
    StripeWebhookController,
    PaypalController,
    PaypalWebhookController,
  ],
  providers: [
    StripeService,
    PaypalService,
  ],
  exports: [
    StripeService,
    PaypalService,
  ],
})
export class PaymentsModule {}
