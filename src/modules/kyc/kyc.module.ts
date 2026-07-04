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
        // If API key is missing or is set to default dummy testing value, inject MockProvider
        if (!apiKey || apiKey === 'dummy_key_for_testing' || apiKey === 'sk-...') {
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
