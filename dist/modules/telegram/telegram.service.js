"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var TelegramService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const telegraf_1 = require("telegraf");
const prisma_service_1 = require("../../prisma/prisma.service");
let TelegramService = TelegramService_1 = class TelegramService {
    constructor(config, prisma) {
        this.config = config;
        this.prisma = prisma;
        this.logger = new common_1.Logger(TelegramService_1.name);
        const token = this.config.get('TELEGRAM_BOT_TOKEN');
        if (token && token !== 'your_bot_token_here') {
            this.bot = new telegraf_1.Telegraf(token);
        }
    }
    async onModuleInit() {
        if (!this.bot) {
            this.logger.warn('Valid TELEGRAM_BOT_TOKEN not provided. Telegram bot listener disabled.');
            return;
        }
        this.bot.command('start', async (ctx) => {
            const telegramId = String(ctx.from.id);
            await ctx.reply(`Welcome to Beleqet! Your Telegram ID is: ${telegramId}.\n\n` +
                `To receive instant notifications for your gigs, please copy this ID and save it in your Beleqet Profile Settings.`);
            this.logger.log(`Telegram /start triggered by ${telegramId}`);
        });
        this.bot.on('text', (ctx) => {
            ctx.reply('I am an automated notification bot for Beleqet. Please use the main website to interact with gigs!');
        });
        try {
            this.bot.launch();
            this.logger.log('Telegram bot listener started successfully.');
        }
        catch (err) {
            this.logger.error('Failed to start Telegram bot', err.message);
        }
    }
    onModuleDestroy() {
        if (this.bot) {
            this.bot.stop('SIGINT');
        }
    }
};
exports.TelegramService = TelegramService;
exports.TelegramService = TelegramService = TelegramService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], TelegramService);
//# sourceMappingURL=telegram.service.js.map