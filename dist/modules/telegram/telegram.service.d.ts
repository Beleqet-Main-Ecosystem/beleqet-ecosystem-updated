import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
export declare class TelegramService implements OnModuleInit, OnModuleDestroy {
    private config;
    private prisma;
    private bot;
    private readonly logger;
    constructor(config: ConfigService, prisma: PrismaService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): void;
}
