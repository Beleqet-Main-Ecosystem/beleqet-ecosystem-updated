import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { GdprGuardService } from './gdpr-guard.service';
import { DataErasureRequestDto } from './dto/data-erasure-request.dto';

@Controller('v1/compliance/gdpr')
export class GdprGuardController {
  constructor(private readonly gdprGuardService: GdprGuardService) {}

  /**
   * REST endpoint to process high-priority GDPR data erasure requests.
   * @param dto Validated DataErasureRequestDto payload.
   */
  @Post('erase')
  @HttpCode(HttpStatus.OK)
  async requestErasure(
    @Body() dto: DataErasureRequestDto,
  ): Promise<{ success: boolean; scrubbedAt: string; referenceId: string }> {
    return await this.gdprGuardService.executeDataErasure(dto.userId);
  }
}
