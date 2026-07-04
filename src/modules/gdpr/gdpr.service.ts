import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GdprService {
  constructor(private readonly prisma: PrismaService) {}

  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        applications: true,
        bids: true,
        company: true,
        freelanceJobs: true,
        contractsAsClient: true,
        contractsAsFreelancer: true,
        notifications: true,
        savedJobs: true,
        wallet: true,
        employerWallet: true,
        cvDraft: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { passwordHash, ...safeUser } = user;

    return {
      user: safeUser,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };
  }

  async deleteUserAccount(userId: string): Promise<{ message: string; userId: string; deletedAt: string }> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `deleted_${userId}@example.com`,
          firstName: 'Deleted',
          lastName: 'User',
          phone: null,
          avatarUrl: null,
          passwordHash: 'anonymized',
          telegramId: null,
          isActive: false,
          emailVerified: false,
          bio: null,
          defaultResumeUrl: null,
          githubUrl: null,
          headline: null,
          linkedinUrl: null,
          location: null,
          portfolioUrl: null,
          skills: [],
          clientFeedback: Prisma.JsonNull,
          skillVerified: false,
        },
      });

      return {
        message: 'Account successfully deleted and anonymized',
        userId,
        deletedAt: new Date().toISOString(),
      };
    });
  }

  async getConsents(userId: string): Promise<Record<string, unknown>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      consentMarketing: false,
      consentAnalytics: false,
      consentDataProcessing: false,
      updatedAt: user.updatedAt,
    };
  }

  async updateConsents(
    userId: string,
    consentData: {
      consentMarketing?: boolean;
      consentAnalytics?: boolean;
      consentDataProcessing?: boolean;
    },
  ): Promise<Record<string, unknown>> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {},
    });

    return {
      id: userId,
      consentMarketing: consentData.consentMarketing ?? false,
      consentAnalytics: consentData.consentAnalytics ?? false,
      consentDataProcessing: consentData.consentDataProcessing ?? false,
      updatedAt: new Date(),
    };
  }
}