import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ResumeBrainModule } from '../resume-brain/resume-brain.module';
import { SkillTesterInvalidPayloadFilter } from './skill-tester-invalid-payload.filter';
import { SmartSkillTesterController } from './smart-skill-tester.controller';
import { SmartSkillTesterService } from './smart-skill-tester.service';

@Module({
  imports: [PrismaModule, ResumeBrainModule],
  controllers: [SmartSkillTesterController],
  providers: [SmartSkillTesterService, SkillTesterInvalidPayloadFilter],
  exports: [SmartSkillTesterService],
})
export class SmartSkillTesterModule {}
