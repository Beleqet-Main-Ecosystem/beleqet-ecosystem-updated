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
   * and the candidate based on their registered notification preferences
   * and GDPR settings.
   *
   * This method:
   * - Loads user details along with notification preferences.
   * - Verifies channel enablement (IN_APP, EMAIL, TELEGRAM, PUSH, SMS).
   * - Queues jobs only for channels that are enabled and have required user identifiers.
   *
   * @param interviewId Unique interview identifier.
   * @param employerId Employer user identifier.
   * @param candidateId Candidate user identifier.
   * @param jobTitle Title of the job associated with the interview.
   * @param startTime Interview start date and time.
   * @param endTime Interview end date and time.
   * @param timezone Time zone used when formatting the interview time.
   * @returns A promise that resolves after all enabled notification jobs have been queued.
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
          phone: true,
          telegramId: true,
          notificationPreference: true,
        },
      }),

      this.prisma.user.findUnique({
        where: { id: employerId },
        select: {
          email: true,
          phone: true,
          telegramId: true,
          notificationPreference: true,
        },
      }),
    ]);

    const candidatePref = candidate?.notificationPreference ?? {
      inAppEnabled: true,
      emailEnabled: true,
      telegramEnabled: true,
      pushEnabled: false,
      smsEnabled: false,
      language: 'en',
    };

    const employerPref = employer?.notificationPreference ?? {
      inAppEnabled: true,
      emailEnabled: true,
      telegramEnabled: true,
      pushEnabled: false,
      smsEnabled: false,
      language: 'en',
    };

    const candidateLang = candidatePref.language || 'en';
    const employerLang = employerPref.language || 'en';

    const [candidateTitle, employerTitle] = await Promise.all([
      this.i18n.translate('interview.notification.scheduledTitle', { lang: candidateLang }),
      this.i18n.translate('interview.notification.scheduledTitle', { lang: employerLang }),
    ]);

    const notificationType = NOTIFICATION_TYPES.INTERVIEW_SCHEDULED;
    const formattedStart = startTime.toLocaleString('en-US', {
      timeZone: timezone,
    });

    const formattedEnd = endTime.toLocaleString('en-US', {
      timeZone: timezone,
    });

    const [candidateBody, employerBody] = await Promise.all([
      this.i18n.translate('interview.notification.candidateScheduledBody', {
        lang: candidateLang,
        args: {
          jobTitle: jobTitle,
          startTime: formattedStart,
          endTime: formattedEnd,
          timezone: timezone,
        },
      }),
      this.i18n.translate('interview.notification.employerScheduledBody', {
        lang: employerLang,
        args: {
          jobTitle: jobTitle,
          startTime: formattedStart,
          endTime: formattedEnd,
          timezone: timezone,
        },
      }),
    ]);

    const metadata = {
      interviewId,
      jobTitle,
      startTime: formattedStart,
      endTime: formattedEnd,
      timezone,
    };

    const jobsToQueue: Promise<unknown>[] = [];

    // Candidate jobs according to user preferences
    if (candidatePref.inAppEnabled) {
      jobsToQueue.push(
        this.notificationQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
          userId: candidateId,
          type: notificationType,
          title: candidateTitle,
          body: candidateBody,
          metadata,
        }),
      );
    }

    if (candidatePref.emailEnabled && candidate?.email) {
      jobsToQueue.push(
        this.notificationQueue.add(NOTIFICATION_JOBS.SEND_EMAIL, {
          to: candidate.email,
          subject: candidateTitle,
          html: `<p>${candidateBody}</p>`,
        }),
      );
    }

    if (candidatePref.telegramEnabled && candidate?.telegramId) {
      jobsToQueue.push(
        this.notificationQueue.add(NOTIFICATION_JOBS.SEND_TELEGRAM, {
          telegramId: candidate.telegramId,
          message: candidateBody,
        }),
      );
    }

    if (candidatePref.pushEnabled) {
      jobsToQueue.push(
        this.notificationQueue.add(NOTIFICATION_JOBS.SEND_PUSH, {
          userId: candidateId,
          title: candidateTitle,
          body: candidateBody,
          payload: metadata,
        }),
      );
    }

    if (candidatePref.smsEnabled && candidate?.phone) {
      jobsToQueue.push(
        this.notificationQueue.add(NOTIFICATION_JOBS.SEND_SMS, {
          to: candidate.phone,
          message: candidateBody,
        }),
      );
    }

    // Employer jobs according to user preferences
    if (employerPref.inAppEnabled) {
      jobsToQueue.push(
        this.notificationQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
          userId: employerId,
          type: notificationType,
          title: employerTitle,
          body: employerBody,
          metadata,
        }),
      );
    }

    if (employerPref.emailEnabled && employer?.email) {
      jobsToQueue.push(
        this.notificationQueue.add(NOTIFICATION_JOBS.SEND_EMAIL, {
          to: employer.email,
          subject: employerTitle,
          html: `<p>${employerBody}</p>`,
        }),
      );
    }

    if (employerPref.telegramEnabled && employer?.telegramId) {
      jobsToQueue.push(
        this.notificationQueue.add(NOTIFICATION_JOBS.SEND_TELEGRAM, {
          telegramId: employer.telegramId,
          message: employerBody,
        }),
      );
    }

    if (employerPref.pushEnabled) {
      jobsToQueue.push(
        this.notificationQueue.add(NOTIFICATION_JOBS.SEND_PUSH, {
          userId: employerId,
          title: employerTitle,
          body: employerBody,
          payload: metadata,
        }),
      );
    }

    if (employerPref.smsEnabled && employer?.phone) {
      jobsToQueue.push(
        this.notificationQueue.add(NOTIFICATION_JOBS.SEND_SMS, {
          to: employer.phone,
          message: employerBody,
        }),
      );
    }

    await Promise.all(jobsToQueue);
  }
}
