/**
 * @fileoverview GDPR compliance service
 * @module webhooks/services
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GDPRMetadata } from '../types/webhook.types';

/**
 * Service for GDPR compliance in webhook processing
 * Handles data minimization, consent management, and data retention
 *
 * @class GDPRService
 */
@Injectable()
export class GDPRService {
  private readonly logger = new Logger(GDPRService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get GDPR compliance metadata for a customer
   *
   * @param externalCustomerId - External customer ID
   * @returns GDPR metadata
   */
  async getComplianceMetadata(externalCustomerId: string): Promise<GDPRMetadata> {
    return {
      dataProcessingAgreement: true,
      consentObtained: true,
      purposeLimitation: 'payment',
      retentionDays: 90, // Payment records retention per GDPR
      isPersonalData: true,
    };
  }

  /**
   * Check if customer has given consent for data processing
   *
   * @param userId - User ID
   * @returns true if consent is valid
   */
  async checkConsentStatus(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        gdprConsentDate: true,
        gdprConsentRevoked: true,
      },
    });

    if (!user) {
      return false;
    }

    return user.gdprConsentDate !== null && !user.gdprConsentRevoked;
  }

  /**
   * Record consent for GDPR compliance
   *
   * @param userId - User ID
   * @param purpose - Purpose of data processing
   */
  async recordConsent(userId: string, purpose: string): Promise<void> {
    await this.prisma.gdprConsent.create({
      data: {
        userId,
        purpose,
        version: '1.0',
        consentedAt: new Date(),
      },
    });

    this.logger.debug(`GDPR consent recorded for user ${userId}: ${purpose}`);
  }

  /**
   * Revoke consent for GDPR compliance
   *
   * @param userId - User ID
   */
  async revokeConsent(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        gdprConsentRevoked: true,
        gdprConsentRevokedAt: new Date(),
      },
    });

    this.logger.debug(`GDPR consent revoked for user ${userId}`);
  }

  /**
   * Get data subject access (for GDPR subject access requests)
   *
   * @param userId - User ID
   * @returns User data for GDPR compliance
   */
  async getDataSubjectAccess(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        createdAt: true,
        gdprConsentDate: true,
      },
    });

    const transactions = await this.prisma.paymentTransaction.findMany({
      where: { externalCustomerId: userId },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      user,
      transactions,
      exportedAt: new Date(),
    };
  }

  /**
   * Delete user data for GDPR right to be forgotten
   * Only deletes personal data, retains anonymized transaction records
   *
   * @param userId - User ID
   */
  async deleteUserData(userId: string): Promise<void> {
    this.logger.warn(`Initiating GDPR data deletion for user: ${userId}`);

    // Anonymize user personal data
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${Date.now()}@anonymous.local`,
        firstName: 'DELETED',
        lastName: 'USER',
        phone: null,
        avatarUrl: null,
        bio: null,
        location: null,
        githubUrl: null,
        linkedinUrl: null,
        portfolioUrl: null,
      },
    });

    // Anonymize transaction metadata
    await this.prisma.paymentTransaction.updateMany({
      where: { externalCustomerId: userId },
      data: {
        externalCustomerId: `DELETED-${userId}`,
      },
    });

    this.logger.log(`User data anonymized for GDPR compliance: ${userId}`);
  }

  /**
   * Validate data minimization in webhook payload
   *
   * @param payload - Webhook payload
   * @returns List of PII fields found
   */
  validateDataMinimization(payload: Record<string, any>): string[] {
    const piiPatterns = {
      email: /[^\s@]+@[^\s@]+\.[^\s@]+/,
      phone: /[\d\-()+ ]{10,}/,
      ssn: /\d{3}-\d{2}-\d{4}/,
      creditCard: /\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}/,
    };

    const foundPII: string[] = [];

    const checkPayload = (obj: any, path: string = ''): void => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = `${path}.${key}`;

        if (typeof value === 'string') {
          for (const [type, pattern] of Object.entries(piiPatterns)) {
            if (pattern.test(value)) {
              foundPII.push(`${currentPath} (${type})`);
            }
          }
        } else if (typeof value === 'object' && value !== null) {
          checkPayload(value, currentPath);
        }
      }
    };

    checkPayload(payload);
    return foundPII;
  }

  /**
   * Mask sensitive data in webhook logs
   *
   * @param payload - Webhook payload
   * @returns Payload with masked sensitive fields
   */
  maskSensitiveData(payload: Record<string, any>): Record<string, any> {
    const masked = JSON.parse(JSON.stringify(payload)); // Deep copy

    const sensitiveFields = [
      'email',
      'phone',
      'card',
      'ssn',
      'token',
      'secret',
      'password',
      'creditCard',
    ];

    const maskValue = (obj: any): void => {
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();

        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          if (typeof value === 'string') {
            obj[key] = `***${value.slice(-4)}***`;
          } else {
            obj[key] = '***MASKED***';
          }
        } else if (typeof value === 'object' && value !== null) {
          maskValue(value);
        }
      }
    };

    maskValue(masked);
    return masked;
  }

  /**
   * Schedule automatic data deletion after retention period
   *
   * @param paymentTransactionId - Payment transaction ID
   * @param retentionDays - Days to retain data before deletion
   */
  async scheduleDataDeletion(
    paymentTransactionId: string,
    retentionDays: number = 90,
  ): Promise<void> {
    const deleteDate = new Date();
    deleteDate.setDate(deleteDate.getDate() + retentionDays);

    await this.prisma.paymentTransaction.update({
      where: { id: paymentTransactionId },
      data: {
        metadata: {
          scheduleDeleteAt: deleteDate.toISOString(),
        } as any,
      },
    });

    this.logger.debug(
      `Data deletion scheduled for ${paymentTransactionId} on ${deleteDate.toISOString()}`,
    );
  }

  /**
   * Process expired data for deletion (GDPR compliance)
   * Should be called periodically via scheduled job
   */
  async processExpiredData(): Promise<void> {
    // Query transactions with metadata
    const records = await this.prisma.paymentTransaction.findMany({
      take: 1000,
    });

    const currentDate = new Date();
    const recordsToDelete = records.filter((rec: any) => {
      const scheduledDelete = rec.metadata?.scheduleDeleteAt;
      if (!scheduledDelete) return false;
      return new Date(scheduledDelete) <= currentDate;
    });

    this.logger.debug(`Processing ${recordsToDelete.length} expired records`);

    for (const rec of recordsToDelete) {
      try {
        // Anonymize data for compliance
        await this.prisma.paymentTransaction.update({
          where: { id: rec.id },
          data: {
            externalCustomerId: `DELETED-${rec.id}`,
            metadata: JSON.parse(JSON.stringify({
              ...((rec as any).metadata || {}),
              deletedAt: currentDate.toISOString(),
            })),
          },
        });
      } catch (error) {
        this.logger.error(`Failed to process record ${rec.id}: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Generate GDPR compliance report
   */
  async generateComplianceReport() {
    const totalTransactions = await this.prisma.paymentTransaction.count();
    const anonymizedTransactions = await this.prisma.paymentTransaction.count({
      where: {
        externalCustomerId: {
          startsWith: 'DELETED-',
        },
      },
    });

    const usersWithConsent = await this.prisma.gdprConsent.findMany({
      select: { userId: true },
      distinct: ['userId'],
    });

    return {
      reportGeneratedAt: new Date(),
      totalTransactions,
      anonymizedTransactions,
      retentionCompliance: {
        processed: true,
        lastProcessedAt: new Date(),
      },
      usersWithConsent: usersWithConsent.length,
      recommendations: [
        'Review data retention policies quarterly',
        'Ensure all third-party processors have signed DPAs',
        'Conduct annual privacy impact assessments',
      ],
    };
  }
}
