import { IsUUID } from 'class-validator';

export class VerificationIdParamDto {
  @IsUUID()
  id!: string;
}
