import { Module } from '@nestjs/common';
import { SmartSkillTesterController } from './smart-skill-tester.controller';
import { SmartSkillTesterService } from './smart-skill-tester.service';
import {
  AI_CHAT_PROVIDER,
  AiChatProvider,
} from '../resume-brain/ai/ai-chat-provider.interface';
import { GroqProvider } from '../resume-brain/ai/groq.provider';

@Module({
  controllers: [SmartSkillTesterController],
  providers: [
    SmartSkillTesterService,
    { provide: AI_CHAT_PROVIDER, useClass: GroqProvider },
  ],
  exports: [SmartSkillTesterService],
})
export class SmartSkillTesterModule {}
