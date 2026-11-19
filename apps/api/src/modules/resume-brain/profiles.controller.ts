import { Body, Controller, ForbiddenException, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { I18n, I18nContext, I18nService } from 'nestjs-i18n';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AutofillProfileDto } from './dto/autofill-profile.dto';
import { ResumeBrainService } from './resume-brain.service';

/**
 * REST controller applying Resume Brain's parsed CV data onto a professional's profile.
 * Kept as a separate controller (rather than nested under `/resumes`) because it
 * addresses a different resource root (`/profiles`), while still sharing
 * `ResumeBrainService` via dependency injection.
 */
@ApiTags('profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profiles')
export class ProfilesController {
  constructor(
    private readonly resumeBrainService: ResumeBrainService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Applies a parsed resume's personal details and skills onto the caller's own profile.
   *
   * @param id - Target user (profile) ID; must match the authenticated user.
   * @param dto - Identifies which parsed resume to apply.
   * @param user - Current authenticated professional.
   */
  @Patch(':id/autofill')
  @ApiOperation({ summary: "Auto-fill a professional's profile from a parsed resume" })
  async autofill(
    @Param('id') id: string,
    @Body() dto: AutofillProfileDto,
    @CurrentUser() user: CurrentUserPayload,
    @I18n() i18n: I18nContext,
  ) {
    if (id !== user.userId) {
      throw new ForbiddenException(
        this.i18n.t('resume-brain.FORBIDDEN_PROFILE_AUTOFILL', { lang: i18n.lang }),
      );
    }
    return this.resumeBrainService.autofillProfile(user.userId, dto.resumeId, i18n.lang, {
      personalInfo: dto.personalInfo,
      skills: dto.skills,
    });
  }
}
