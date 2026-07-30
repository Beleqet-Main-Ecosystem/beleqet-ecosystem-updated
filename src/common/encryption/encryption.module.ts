import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';
import { ENCRYPTION_KEY } from './encryption.constants';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: ENCRYPTION_KEY,
      useFactory: (config: ConfigService) => {
        const raw = config.get<string>('ENCRYPTION_KEY');

        if (!raw) {
          throw new Error('ENCRYPTION_KEY is required');
        }

        return Buffer.from(raw, 'hex');
      },
      inject: [ConfigService],
    },
    EncryptionService,
  ],
  exports: [EncryptionService],
})
export class EncryptionModule { }