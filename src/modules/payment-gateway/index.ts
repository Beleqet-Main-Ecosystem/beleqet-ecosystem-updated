/**
 * Global Payment Gateway Module
 * 
 * Issue #86: Stripe Integration with Multi-Currency & GDPR
 * 
 * Features:
 * - Multi-currency support (ETB, USD, EUR, GBP)
 * - Stripe PaymentIntent integration
 * - Automatic currency conversion to base currency (ETB)
 * - GDPR-compliant data export and deletion
 * - i18n error messages (English, Amharic)
 * - Partial and full refund support
 * - Clean NestJS architecture with DI
 * 
 * @module PaymentGatewayModule
 */

export { PaymentGatewayModule } from './payment-gateway.module';
export { PaymentGatewayController } from './payment-gateway.controller';
export { PaymentGatewayService } from './payment-gateway.service';
export { CreatePaymentDto } from './dto/create-payment.dto';
export { ProcessPaymentDto } from './dto/process-payment.dto';
export { RefundPaymentDto } from './dto/refund-payment.dto';
export { ConvertCurrencyDto } from './dto/convert-currency.dto';
export { QueryTransactionsDto } from './dto/query-transactions.dto';
export { TransactionEntity } from './entities/transaction.entity';
export { CurrencyConversionEntity } from './entities/currency-conversion.entity';
export { PaymentDataExportEntity } from './entities/gdpr-export.entity';
