// =============================================================================
// src/modules/notifications/notifications.service.ts
// =============================================================================

import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { I18nService } from 'nestjs-i18n';

import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES, NOTIFICATION_JOBS } from '../queues/queues.constants';
import { NOTIFICATION_TYPES } from '@common/constants/notification-types';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,

    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly notificationQueue: Queue,
  ) {}

  /**
   * Sends interview scheduled notifications to both the employer
   * and the candidate.
   *
   * This method:
   * - Creates in-app notifications.
   * - Queues email notifications when an email address exists.
   * - Queues Telegram notifications when a Telegram account is linked.
   *
   * @param interviewId Unique interview identifier.
   * @param employerId Employer user identifier.
   * @param candidateId Candidate user identifier.
   * @param jobTitle Title of the job associated with the interview.
   * @param startTime Interview start date and time.
   * @param endTime Interview end date and time.
   * @param timezone Time zone used when formatting the interview time.
   * @returns A promise that resolves after all notification jobs have been queued.
   */
  async sendInterviewScheduled(
    interviewId: string,
    employerId: string,
    candidateId: string,
    jobTitle: string,
    startTime: Date,
    endTime: Date,
    timezone: string,
  ): Promise<void> {
    const [candidate, employer] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: candidateId },
        select: {
          email: true,
          telegramId: true,
        },
      }),

      this.prisma.user.findUnique({
        where: { id: employerId },
        select: {
          email: true,
          telegramId: true,
        },
      }),
    ]);

    const title = await this.i18n.translate('interview.notification.scheduledTitle');
    const notificationType = NOTIFICATION_TYPES.INTERVIEW_SCHEDULED;
    const formattedStart = startTime.toLocaleString('en-US', {
      timeZone: timezone,
    });

    const formattedEnd = endTime.toLocaleString('en-US', {
      timeZone: timezone,
    });
    const candidateBody = await this.i18n.translate(
      'interview.notification.candidateScheduledBody',
      {
        args: {
          jobTitle: jobTitle,
          startTime: formattedStart,
          endTime: formattedEnd,
          timezone: timezone,
        },
      },
    );

    const employerBody = await this.i18n.translate('interview.notification.employerScheduledBody', {
      args: {
        jobTitle: jobTitle,
        startTime: formattedStart,
        endTime: formattedEnd,
        timezone: timezone,
      },
    });

    const metadata = {
      interviewId,
      jobTitle,
      startTime: formattedStart,
      endTime: formattedEnd,
      timezone,
    };
    await Promise.all([
      this.notificationQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
        userId: candidateId,
        type: notificationType,
        title: title,
        body: candidateBody,
        metadata,
      }),

      this.notificationQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
        userId: employerId,
        type: notificationType,
        title: title,
        body: employerBody,
        metadata,
      }),

      candidate?.email
        ? this.notificationQueue.add(NOTIFICATION_JOBS.SEND_EMAIL, {
            to: candidate.email,
            subject: title,
            html: `<p>${candidateBody}</p>`,
          })
        : Promise.resolve(),

      employer?.email
        ? this.notificationQueue.add(NOTIFICATION_JOBS.SEND_EMAIL, {
            to: employer.email,
            subject: title,
            html: `<p>${employerBody}</p>`,
          })
        : Promise.resolve(),

      candidate?.telegramId
        ? this.notificationQueue.add(NOTIFICATION_JOBS.SEND_TELEGRAM, {
            telegramId: candidate.telegramId,
            message: candidateBody,
          })
        : Promise.resolve(),

      employer?.telegramId
        ? this.notificationQueue.add(NOTIFICATION_JOBS.SEND_TELEGRAM, {
            telegramId: employer.telegramId,
            message: employerBody,
          })
        : Promise.resolve(),
    ]);
  }
}
