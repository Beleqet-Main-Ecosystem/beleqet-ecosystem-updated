import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

/**
 * Deployment-safety health endpoints (liveness/readiness).
 *
 * Added for the CI/CD pipeline: the staging deploy gates on
 * `/api/v1/health/ready` and the container HEALTHCHECKs poll
 * `/api/v1/health`. `REDIS_CLIENT` comes from the global RedisModule.
 */
@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
