import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ErrorRecurrenceTrackerService } from './common/filters/error-recurrence-tracker.service';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { PrismaService } from './prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 4000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  const adminEmail = configService.get<string>('ADMIN_EMAIL')?.toLowerCase().trim();
  const adminPassword = configService.get<string>('ADMIN_PASSWORD');
  if (adminEmail && adminPassword) {
    if (adminPassword.length < 12)
      throw new Error('ADMIN_PASSWORD must contain at least 12 characters');
    const prisma = app.get(PrismaService);
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { role: 'ADMIN', isActive: true },
      create: {
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        firstName: configService.get<string>('ADMIN_FIRST_NAME', 'Platform'),
        lastName: configService.get<string>('ADMIN_LAST_NAME', 'Admin'),
        role: 'ADMIN',
        emailVerified: true,
      },
    });
    logger.log(`Admin account ensured: ${adminEmail}`);
  }

  // ── Security ──────────────────────────────────────────────────────────────
  app.use(helmet());
  const allowedOrigins = configService
    .get<string>('FRONTEND_URL', 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
      if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // ── Global prefix ─────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── Validation ────────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown props
      forbidNonWhitelisted: true,
      transform: true, // auto-transform to DTO types
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Serialization ─────────────────────────────────────────────────────────
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // ── Exception filter ──────────────────────────────────────────────────────
  const httpAdapterHost = app.get(HttpAdapterHost);
  const recurrenceTracker = new ErrorRecurrenceTrackerService();
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost, recurrenceTracker));

  // ── Logging interceptor ───────────────────────────────────────────────────
  app.useGlobalInterceptors(new LoggingInterceptor());

  // ── Swagger (enabled by default; set SWAGGER_ENABLED=false to disable) ─────
  if (configService.get<string>('SWAGGER_ENABLED', 'true') !== 'false') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Beleqet API')
      .setDescription(
        'Beleqet Hiring Platform — Jobs Board, Freelance Marketplace, BeleqetSafe Escrow',
      )
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

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    logger.log(`Swagger UI → http://localhost:${port}/api/docs`);
  }

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`🚀 Beleqet API running on http://localhost:${port}/api/v1`);
  logger.log(`   Environment: ${nodeEnv}`);
}

bootstrap().catch((err) => {
  console.error('Fatal startup error', err);
  process.exit(1);
});
