import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { PaypalAuthService } from './paypal-auth.service';
import { CreateOrderDto } from './dto/create-order.dto';
export declare class PaypalOrderService {
    private readonly prisma;
    private readonly auth;
    private readonly config;
    private readonly logger;
    constructor(prisma: PrismaService, auth: PaypalAuthService, config: ConfigService);
    createOrder(clientId: string, dto: CreateOrderDto): Promise<{
        transactionId: any;
        orderId: string;
        approveUrl: string;
        amount: number;
        currency: string;
        platformFee: number;
    }>;
    captureOrder(clientId: string, orderId: string): Promise<{
        status: string;
        captureId: any;
        transactionId: any;
        orderId?: undefined;
        amount?: undefined;
        currency?: undefined;
    } | {
        transactionId: any;
        orderId: string;
        captureId: string;
        status: string;
        amount: any;
        currency: any;
    }>;
}
