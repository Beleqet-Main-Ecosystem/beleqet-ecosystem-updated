import { Controller, Post, Body, Headers, Req, Res, HttpStatus, BadRequestException } from '@nestjs/common';
import { Request, Response } from 'express';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-intent')
  async createIntent(@Body() createPaymentIntentDto: CreatePaymentIntentDto) {
    return this.paymentsService.createPaymentIntent(createPaymentIntentDto);
  }

  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<Response> {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    const rawBody = request.body as Buffer; 

    try {
      const event = this.paymentsService.constructWebhookEvent(rawBody, signature);

      switch (event.type) {
        case 'payment_intent.succeeded':
          // Target handling for successful payments
          break;
        case 'payment_intent.payment_failed':
          // Target handling for failed payments
          break;
        default:
          break;
      }

      return response.status(HttpStatus.OK).json({ received: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Webhook Error';
      return response.status(HttpStatus.BAD_REQUEST).send(`Webhook Error: ${msg}`);
    }
  }
}