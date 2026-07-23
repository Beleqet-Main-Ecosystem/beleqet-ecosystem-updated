/**
 * @file update-plan.dto.ts
 * @description Partial-update DTO for an existing Plan (admin only).
 */
import { PartialType } from '@nestjs/swagger';
import { CreatePlanDto } from './create-plan.dto';

export class UpdatePlanDto extends PartialType(CreatePlanDto) {}
