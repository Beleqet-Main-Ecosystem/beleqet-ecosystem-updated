import { Injectable } from '@nestjs/common';
import { FreelanceJobStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MoneyRow } from './types/admin-stats.types';

const ACTIVE_PROJECT_STATUSES: FreelanceJobStatus[] = [
  FreelanceJobStatus.DRAFT,
  FreelanceJobStatus.FUNDED,
  FreelanceJobStatus.OPEN,
  FreelanceJobStatus.IN_PROGRESS,
];

/**
 * Data-access layer for Admin Stats. Controllers/services must not call Prisma directly.
 */
@Injectable()
export class AdminStatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  countTotalUsers(): Promise<number> {
    return this.prisma.user.count();
  }

  countActiveUsersByLastLogin(since: Date): Promise<number> {
    return this.prisma.user.count({
      where: { lastLoginAt: { gte: since } },
    });
  }

  /**
   * Distinct users with lastLoginAt in window OR a refresh token created in window.
   */
  async countActiveUsers(since: Date): Promise<{ count: number; basis: 'last_login' | 'refresh_token' }> {
    const byLogin = await this.countActiveUsersByLastLogin(since);
    if (byLogin > 0) {
      return { count: byLogin, basis: 'last_login' };
    }
    const byToken = await this.countActiveUsersByRefreshToken(since);
    return { count: byToken, basis: byToken > 0 ? 'refresh_token' : 'last_login' };
  }

  countActiveUsersByRefreshToken(since: Date): Promise<number> {
    return this.prisma.refreshToken
      .findMany({
        where: { createdAt: { gte: since } },
        distinct: ['userId'],
        select: { userId: true },
      })
      .then((rows) => rows.length);
  }

  countTotalProjects(): Promise<number> {
    return this.prisma.freelanceJob.count();
  }

  countActiveProjects(): Promise<number> {
    return this.prisma.freelanceJob.count({
      where: { status: { in: ACTIVE_PROJECT_STATUSES } },
    });
  }

  countActiveContracts(): Promise<number> {
    return this.prisma.contract.count({ where: { status: 'ACTIVE' } });
  }

  countCompletedFreelanceJobs(): Promise<number> {
    return this.prisma.freelanceJob.count({ where: { status: 'COMPLETED' } });
  }

  async findEscrowPlatformFees(from: Date, to: Date): Promise<MoneyRow[]> {
    const rows = await this.prisma.escrowTransaction.findMany({
      where: {
        status: 'RELEASED',
        OR: [
          { releasedAt: { gte: from, lte: to } },
          { releasedAt: null, updatedAt: { gte: from, lte: to } },
        ],
      },
      select: { platformFee: true, currency: true, releasedAt: true, updatedAt: true },
    });

    return rows.map((row) => ({
      amount: row.platformFee,
      currency: row.currency || 'ETB',
      at: row.releasedAt ?? row.updatedAt,
    }));
  }

  async findSucceededPayments(from: Date, to: Date): Promise<MoneyRow[]> {
    const rows = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.SUCCEEDED,
        createdAt: { gte: from, lte: to },
      },
      select: { amount: true, currency: true, createdAt: true },
    });
    return rows.map((row) => ({
      amount: row.amount,
      currency: row.currency || 'ETB',
      at: row.createdAt,
    }));
  }

  async findRefundedPayments(from: Date, to: Date): Promise<MoneyRow[]> {
    const rows = await this.prisma.payment.findMany({
      where: {
        status: { in: [PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED] },
        OR: [
          { refundedAt: { gte: from, lte: to } },
          { refundedAt: null, updatedAt: { gte: from, lte: to } },
        ],
      },
      select: { amount: true, currency: true, refundedAt: true, updatedAt: true },
    });
    return rows.map((row) => ({
      amount: -Math.abs(row.amount),
      currency: row.currency || 'ETB',
      at: row.refundedAt ?? row.updatedAt,
    }));
  }

  async findSucceededSubscriptionTx(from: Date, to: Date): Promise<MoneyRow[]> {
    const rows = await this.prisma.subscriptionTransaction.findMany({
      where: {
        status: PaymentStatus.SUCCEEDED,
        createdAt: { gte: from, lte: to },
      },
      select: { amount: true, currency: true, createdAt: true },
    });
    return rows.map((row) => ({
      amount: row.amount,
      currency: row.currency || 'ETB',
      at: row.createdAt,
    }));
  }

  async findUserRegistrationDates(from: Date, to: Date): Promise<Date[]> {
    const rows = await this.prisma.user.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { createdAt: true },
    });
    return rows.map((r) => r.createdAt);
  }

  async findUserLastLoginDates(from: Date, to: Date): Promise<Date[]> {
    const rows = await this.prisma.user.findMany({
      where: { lastLoginAt: { gte: from, lte: to } },
      select: { lastLoginAt: true },
    });
    return rows.map((r) => r.lastLoginAt!).filter(Boolean);
  }

  async groupProjectsByStatus(): Promise<Array<{ status: FreelanceJobStatus; count: number }>> {
    const grouped = await this.prisma.freelanceJob.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    return grouped.map((g) => ({ status: g.status, count: g._count._all }));
  }

  findRecentProjects(limit: number, from?: Date, to?: Date) {
    const where: Prisma.FreelanceJobWhereInput = {};
    if (from && to) {
      where.createdAt = { gte: from, lte: to };
    }

    return this.prisma.freelanceJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        status: true,
        budgetMin: true,
        budgetMax: true,
        currency: true,
        createdAt: true,
        client: { select: { firstName: true } },
      },
    });
  }

  async groupUsersByRole(): Promise<Array<{ role: string; count: number }>> {
    const grouped = await this.prisma.user.groupBy({
      by: ['role'],
      _count: { _all: true },
    });
    return grouped.map((g) => ({ role: g.role, count: g._count._all }));
  }

  countInactiveUsers(): Promise<number> {
    return this.prisma.user.count({ where: { isActive: false } });
  }

  countUnverifiedEmails(): Promise<number> {
    return this.prisma.user.count({ where: { emailVerified: false } });
  }

  countKycByStatus(status: 'PENDING' | 'APPROVED' | 'REJECTED'): Promise<number> {
    return this.prisma.kycVerification.count({ where: { status } });
  }

  async groupEmploymentJobsByStatus(): Promise<Array<{ status: string; count: number }>> {
    const grouped = await this.prisma.job.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    return grouped.map((g) => ({ status: g.status, count: g._count._all }));
  }

  async groupContractsByStatus(): Promise<Array<{ status: string; count: number }>> {
    const grouped = await this.prisma.contract.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    return grouped.map((g) => ({ status: g.status, count: g._count._all }));
  }

  countApplications(from?: Date, to?: Date): Promise<number> {
    if (from && to) {
      return this.prisma.application.count({ where: { createdAt: { gte: from, lte: to } } });
    }
    return this.prisma.application.count();
  }

  countBids(from?: Date, to?: Date): Promise<number> {
    if (from && to) {
      return this.prisma.bid.count({ where: { createdAt: { gte: from, lte: to } } });
    }
    return this.prisma.bid.count();
  }

  countOpenDisputes(): Promise<number> {
    return this.prisma.dispute.count({ where: { resolvedAt: null } });
  }

  countActiveSubscriptions(): Promise<number> {
    return this.prisma.subscription.count({ where: { status: 'ACTIVE' } });
  }

  countEscrowByStatus(status: string): Promise<number> {
    return this.prisma.escrowTransaction.count({ where: { status: status as never } });
  }

  async sumEscrowGrossReleased(from: Date, to: Date): Promise<MoneyRow[]> {
    const rows = await this.prisma.escrowTransaction.findMany({
      where: {
        status: 'RELEASED',
        OR: [
          { releasedAt: { gte: from, lte: to } },
          { releasedAt: null, updatedAt: { gte: from, lte: to } },
        ],
      },
      select: { grossAmount: true, currency: true, releasedAt: true, updatedAt: true },
    });
    return rows.map((row) => ({
      amount: row.grossAmount,
      currency: row.currency || 'ETB',
      at: row.releasedAt ?? row.updatedAt,
    }));
  }

  countPaymentsByStatus(status: PaymentStatus, from: Date, to: Date): Promise<number> {
    return this.prisma.payment.count({
      where: { status, createdAt: { gte: from, lte: to } },
    });
  }

  async groupRegistrationsByRole(from: Date, to: Date): Promise<Array<{ role: string; count: number }>> {
    const grouped = await this.prisma.user.groupBy({
      by: ['role'],
      where: { createdAt: { gte: from, lte: to } },
      _count: { _all: true },
    });
    return grouped.map((g) => ({ role: g.role, count: g._count._all }));
  }
}
