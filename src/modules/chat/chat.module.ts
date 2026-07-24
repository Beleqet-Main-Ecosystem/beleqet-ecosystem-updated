import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { KeysService } from './keys.service';
import { KeysController } from './keys.controller';
import { EncryptionService } from './encryption.service';
import { PrismaModule } from '../../prisma/prisma.module';


@Module({
  imports: [
    PrismaModule,
    
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_ACCESS_EXPIRES') },
      }),
    }),
  ],
  controllers: [KeysController],
  providers: [ChatService, ChatGateway, KeysService, EncryptionService],
  exports: [ChatService, KeysService, EncryptionService]
})
export class ChatModule {}
