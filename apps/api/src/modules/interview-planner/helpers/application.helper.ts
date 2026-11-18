import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
/**
 * Helper responsible for validating job applications
 * before an interview can be scheduled.
 *
 * Ensures the application exists, belongs to the
 * authenticated employer, and has not already been
 * scheduled for an interview.
 */
@Injectable()
export class ApplicationHelper {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Validates that an interview can be scheduled for
   * the specified job application.
   *
   * Validation includes:
   * - The application exists.
   * - The authenticated employer owns the job.
   * - The application does not already have an interview.
   *
   * @param employerId Authenticated employer user identifier
   * @param applicationId Job application identifier
   * @returns The validated application with its related
   * user, interview, job, and company data
   * @throws NotFoundException If the application does not exist
   * @throws ForbiddenException If the employer does not own the job
   * @throws ConflictException If an interview has already been scheduled
   */
  async validateInterviewApplication(employerId: string, applicationId: string) {
    const application = await this.prisma.application.findUnique({
      where: {
        id: applicationId,
      },
      include: {
        user: true,
        interview: true,
        job: {
          include: {
            company: true,
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException(
        await this.i18n.translate('interview.interview.applicationNotFound'),
      );
    }

    if (application.job.company.userId !== employerId) {
      throw new ForbiddenException(await this.i18n.translate('interview.interview.forbidden'));
    }

    if (application.interview) {
      throw new ConflictException(
        await this.i18n.translate('interview.interview.alreadyScheduled'),
      );
    }
    return application;
  }
}
