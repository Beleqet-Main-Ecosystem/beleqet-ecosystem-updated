"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const core_2 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
const helmet_1 = require("helmet");
const app_module_1 = require("./app.module");
const all_exceptions_filter_1 = require("./common/filters/all-exceptions.filter");
const error_recurrence_tracker_service_1 = require("./common/filters/error-recurrence-tracker.service");
const logging_interceptor_1 = require("./common/interceptors/logging.interceptor");
const prisma_service_1 = require("./prisma/prisma.service");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const connect_redis_1 = require("connect-redis");
const redis_io_adapter_1 = require("./common/adapters/redis-io.adapter");
const redis_module_1 = require("./modules/redis/redis.module");
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { bufferLogs: true, rawBody: true });
    const redisIoAdapter = new redis_io_adapter_1.RedisIoAdapter(app);
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);
    const configService = app.get(config_1.ConfigService);
    const port = configService.get('PORT', 4000);
    const nodeEnv = configService.get('NODE_ENV', 'development');
    const sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret) {
        throw new Error('Missing required environment variable "SESSION_SECRET".');
    }
    const sessionRedisClient = app.get(redis_module_1.REDIS_CLIENT);
    app.use(session({
        store: new connect_redis_1.RedisStore({ client: sessionRedisClient, prefix: 'beleqet:sess:' }),
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: nodeEnv === 'production',
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000,
        },
    }));
    const adminEmail = configService.get('ADMIN_EMAIL')?.toLowerCase().trim();
    const adminPassword = configService.get('ADMIN_PASSWORD');
    if (adminEmail && adminPassword) {
        if (adminPassword.length < 12)
            throw new Error('ADMIN_PASSWORD must contain at least 12 characters');
        const prisma = app.get(prisma_service_1.PrismaService);
        await prisma.user.upsert({
            where: { email: adminEmail },
            update: { role: 'ADMIN', isActive: true },
            create: {
                email: adminEmail,
                passwordHash: await bcrypt.hash(adminPassword, 12),
                firstName: configService.get('ADMIN_FIRST_NAME', 'Platform'),
                lastName: configService.get('ADMIN_LAST_NAME', 'Admin'),
                role: 'ADMIN',
                emailVerified: true,
            },
        });
        logger.log(`Admin account ensured: ${adminEmail}`);
    }
    app.use((0, helmet_1.default)({
        crossOriginEmbedderPolicy: nodeEnv === 'production',
        contentSecurityPolicy: nodeEnv === 'production' ? undefined : false,
    }));
    const allowedOrigins = configService
        .get('FRONTEND_URL', 'http://localhost:3000')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
    app.enableCors({
        origin: (origin, cb) => {
            if (!origin)
                return cb(null, true);
            if (allowedOrigins.includes('*') || allowedOrigins.includes(origin))
                return cb(null, true);
            if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin))
                return cb(null, true);
            return cb(null, false);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    }));
    app.useGlobalInterceptors(new common_1.ClassSerializerInterceptor(app.get(core_1.Reflector)));
    const httpAdapterHost = app.get(core_2.HttpAdapterHost);
    const recurrenceTracker = new error_recurrence_tracker_service_1.ErrorRecurrenceTrackerService();
    app.useGlobalFilters(new all_exceptions_filter_1.AllExceptionsFilter(httpAdapterHost, recurrenceTracker));
    app.useGlobalInterceptors(new logging_interceptor_1.LoggingInterceptor());
    if (configService.get('SWAGGER_ENABLED', 'true') !== 'false') {
        const swaggerConfig = new swagger_1.DocumentBuilder()
            .setTitle('Beleqet API')
            .setDescription('Beleqet Hiring Platform — Jobs Board, Freelance Marketplace, BeleqetSafe Escrow')
            .setVersion('1.0')
            .addBearerAuth()
            .addTag('auth', 'Authentication & session management')
            .addTag('users', 'User profile management')
            .addTag('jobs', 'Job listings & search')
            .addTag('applications', 'Job applications & workflow')
            .addTag('freelance', 'Freelance gigs, bids & contracts')
            .addTag('escrow', 'BeleqetSafe escrow & payments')
            .addTag('wallet', 'Freelancer wallet & withdrawals')
            .addTag('notifications', 'Notification management')
            .addTag('analytics', 'Platform analytics')
            .addTag('db-index-master', 'DB Index Master — query analysis & index health (admin only)')
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
        swagger_1.SwaggerModule.setup('api/docs', app, document);
        logger.log(`Swagger UI → http://localhost:${port}/api/docs`);
    }
    app.enableShutdownHooks();
    await app.listen(port, '0.0.0.0');
    logger.log(`🚀 Beleqet API running on ${port}/api/v1`);
    logger.log(`   Environment: ${nodeEnv}`);
}
bootstrap().catch((err) => {
    console.error('Fatal startup error', err);
    process.exit(1);
});
//# sourceMappingURL=main.js.map