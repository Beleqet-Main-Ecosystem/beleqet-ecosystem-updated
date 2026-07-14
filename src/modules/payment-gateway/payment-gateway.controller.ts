import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Delete,
  Headers,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  Ip,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaymentGatewayService } from './payment-gateway.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { ConvertCurrencyDto } from './dto/convert-currency.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { TransactionEntity } from './entities/transaction.entity';
import { CurrencyConversionEntity } from './entities/currency-conversion.entity';
import { PaymentDataExportEntity } from './entities/gdpr-export.entity';
import { Request } from 'express';

/**
 * Controller for Global Payment Gateway operations.
 * Handles multi-currency payments, Stripe integration, and GDPR compliance.
 */
@ApiTags('Payment Gateway')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentGatewayController {
  constructor(private readonly paymentService: PaymentGatewayService) {}

  /**
   * Creates a new payment transaction.
   * Supports multi-currency with automatic conversion to base currency.
   */
  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new payment transaction',
    description: 'Creates a pending transaction. Use /process to complete payment.',
  })
  @ApiResponse({ status: 201, description: 'Payment created', type: TransactionEntity })
  @ApiResponse({ status: 400, description: 'Invalid input or unsupported currency' })
  @ApiResponse({ status: 403, description: 'GDPR consent not given' })
  async createPayment(
    @Body() dto: CreatePaymentDto,
    @Headers('accept-language') lang: string = 'en',
  ): Promise<TransactionEntity> {
    return this.paymentService.createPayment(dto, lang);
  }

  /**
   * Processes a pending payment through the selected provider.
   */
  @Post('process')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process a pending payment',
    description: 'Charges the payment method and completes the transaction.',
  })
  @ApiResponse({ status: 200, description: 'Payment processed', type: TransactionEntity })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async processPayment(
    @Body() dto: ProcessPaymentDto,
    @Headers('accept-language') lang: string = 'en',
  ): Promise<TransactionEntity> {
    return this.paymentService.processPayment(dto, lang);
  }

  /**
   * Refunds a completed transaction (full or partial).
   */
  @Post('refund')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refund a transaction',
    description: 'Supports full and partial refunds.',
  })
  @ApiResponse({ status: 200, description: 'Refund processed', type: TransactionEntity })
  @ApiResponse({ status: 400, description: 'Transaction not refundable' })
  async refundPayment(
    @Body() dto: RefundPaymentDto,
    @Headers('accept-language') lang: string = 'en',
  ): Promise<TransactionEntity> {
    return this.paymentService.refundPayment(dto, lang);
  }

  /**
   * Converts currency amount with real-time exchange rate.
   */
  @Post('convert')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Convert currency',
    description: 'Converts amount between supported currencies.',
  })
  @ApiResponse({ status: 200, description: 'Conversion result', type: CurrencyConversionEntity })
  @ApiResponse({ status: 400, description: 'Unsupported currency pair' })
  async convertCurrency(
    @Body() dto: ConvertCurrencyDto,
  ): Promise<CurrencyConversionEntity> {
    return this.paymentService.convertAmount(
      dto.amount,
      dto.fromCurrency,
      dto.toCurrency,
    );
  }

  /**
   * Retrieves transactions with filtering.
   */
  @Get('transactions')
  @ApiOperation({
    summary: 'Get transactions',
    description: 'Query transactions with optional filters.',
  })
  @ApiResponse({ status: 200, description: 'List of transactions', type: [TransactionEntity] })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED', 'DISPUTED'] })
  @ApiQuery({ name: 'type', required: false, enum: ['PAYMENT', 'SUBSCRIPTION', 'REFUND', 'PAYOUT', 'FEE'] })
  @ApiQuery({ name: 'currency', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getTransactions(
    @Query() filters: QueryTransactionsDto,
    @Headers('accept-language') lang: string = 'en',
  ): Promise<TransactionEntity[]> {
    return this.paymentService.findTransactions(filters, lang);
  }

  /**
   * GDPR: Export all payment data for a user.
   * Right to Access / Data Portability.
   */
  @Get('export/:userId')
  @ApiOperation({
    summary: 'GDPR: Export user payment data',
    description: 'Returns all payment data in a portable JSON format.',
  })
  @ApiResponse({ status: 200, description: 'User payment data exported', type: PaymentDataExportEntity })
  @ApiResponse({ status: 404, description: 'User not found' })
  async exportUserData(
    @Param('userId') userId: string,
  ): Promise<PaymentDataExportEntity> {
    return this.paymentService.exportUserPaymentData(userId);
  }

  /**
   * GDPR: Delete all user payment data.
   * Right to Erasure. Anonymizes financial records for audit compliance.
   */
  @Delete('purge/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'GDPR: Delete user payment data',
    description: 'Anonymizes all user-identifying payment data while preserving financial audit trail.',
  })
  @ApiResponse({ status: 200, description: 'Data anonymized' })
  async deleteUserData(
    @Param('userId') userId: string,
  ): Promise<{ message: string; deletedCount: number; anonymizedCount: number }> {
    const result = await this.paymentService.deleteUserPaymentData(userId);
    return {
      message: 'User payment data has been anonymized per GDPR request.',
      ...result,
    };
  }
}
