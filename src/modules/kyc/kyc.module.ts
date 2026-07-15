import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { UploadsModule } from '../uploads/uploads.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { MockKycProvider } from './providers/mock-kyc-provider.service';
import { OpenAiKycProvider } from './providers/openai-kyc-provider.service';

/**
 * NestJS Module bundling KYC submission endpoints, file processing, and identity providers.
 */
@Module({
  imports: [PrismaModule, ConfigModule, UploadsModule],
  controllers: [KycController],
  providers: [
    KycService,
    MockKycProvider,
    OpenAiKycProvider,
    {
      provide: 'KycProvider',
      useFactory: (
        config: ConfigService,
        mockProvider: MockKycProvider,
        openAiProvider: OpenAiKycProvider,
      ) => {
        const apiKey = config.get<string>('OPENAI_API_KEY');
        const isProduction = config.get<string>('NODE_ENV') === 'production' || process.env.NODE_ENV === 'production';
        const isApiKeyMissingOrDummy = !apiKey || apiKey === 'dummy_key_for_testing' || apiKey === 'sk-...';

        if (isApiKeyMissingOrDummy) {
          if (isProduction) {
            throw new Error('OPENAI_API_KEY is missing or set to a dummy value in production environment.');
          }
          return mockProvider;
        }
        return openAiProvider;
      },
      inject: [ConfigService, MockKycProvider, OpenAiKycProvider],
    },
  ],
  exports: [KycService],
})
export class KycModule {}
