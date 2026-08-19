import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { DisputeQueryDto } from './dto/dispute-query.dto';
import { I18nService } from 'nestjs-i18n';
import type { Dispute } from '@prisma/client';

/**
 * Manages dispute creation, review, and resolution.
 */
@Injectable()
export class DisputeManagerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Creates a dispute for a contract that the current user is allowed to review.
   */
  async createDispute(userId: string, createDisputeDto: CreateDisputeDto): Promise<Dispute> {
    return this.prisma.$transaction(async (transaction) => {
      const contract = await transaction.contract.findUnique({
        where: { id: createDisputeDto.contractId },
      });

      if (!contract) {
        throw new NotFoundException(this.translate('CONTRACT_NOT_FOUND', createDisputeDto.lang));
      }

      if (contract.clientId !== userId && contract.freelancerId !== userId) {
        throw new BadRequestException(
          this.translate('UNAUTHORIZED_DISPUTE', createDisputeDto.lang),
        );
      }

      if (contract.status !== 'ACTIVE') {
        throw new ConflictException(this.translate('CONTRACT_NOT_ACTIVE', createDisputeDto.lang));
      }

      const stateChange = await transaction.contract.updateMany({
        where: { id: contract.id, status: 'ACTIVE' },
        data: { status: 'DISPUTED' },
      });
      if (stateChange.count !== 1) {
        throw new ConflictException(this.translate('CONCURRENT_UPDATE', createDisputeDto.lang));
      }

      await transaction.escrowTransaction.updateMany({
        where: {
          freelanceJobId: contract.freelanceJobId,
          status: { in: ['FUNDED', 'IN_REVIEW'] },
        },
        data: { status: 'DISPUTED' },
      });

      return transaction.dispute.create({
        data: {
          contractId: createDisputeDto.contractId,
          raisedById: userId,
          reason: this.sanitizePii(createDisputeDto.reason),
          evidenceUrls: createDisputeDto.evidenceUrls,
        },
      });
    });
  }

  /**
   * Redacts personal data from dispute text before it is stored.
   */
  private sanitizePii(text: string): string {
    if (!text) return text;
    let sanitized = text.replace(
      /[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+/gi,
      '[REDACTED EMAIL]',
    );
    sanitized = sanitized.replace(
      /(\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9})/g,
      '[REDACTED PHONE]',
    );
    return sanitized;
  }

  /**
   * Resolves an open dispute and updates the related contract state.
   */
  async resolveDispute(
    disputeId: string,
    adminUserId: string,
    resolveDto: ResolveDisputeDto,
  ): Promise<{ message: string; dispute: Dispute }> {
    const refundAmount = resolveDto.refundAmount;
    const refundCurrency = resolveDto.refundCurrency;
    const resolvedAt = new Date();
    const updatedDispute = await this.prisma.$transaction(async (transaction) => {
      const dispute = await transaction.dispute.findUnique({
        where: { id: disputeId },
        include: { contract: true },
      });

      if (!dispute) {
        throw new NotFoundException(this.translate('INVALID_DISPUTE', resolveDto.lang));
      }
      if (dispute.resolvedAt || dispute.resolution) {
        throw new ConflictException(this.translate('ALREADY_RESOLVED', resolveDto.lang));
      }
      if (dispute.contract.status !== 'DISPUTED') {
        throw new ConflictException(this.translate('CONTRACT_NOT_DISPUTED', resolveDto.lang));
      }
      if (refundAmount !== undefined && refundAmount > dispute.contract.agreedAmount) {
        throw new BadRequestException(this.translate('REFUND_TOO_LARGE', resolveDto.lang));
      }
      if (refundAmount !== undefined && refundCurrency !== dispute.contract.currency) {
        throw new BadRequestException(this.translate('REFUND_CURRENCY_MISMATCH', resolveDto.lang));
      }

      let employerWalletId: string | undefined;
      let escrowId: string | undefined;
      if (refundAmount !== undefined) {
        const employerWallet = await transaction.employerWallet.findUnique({
          where: { userId: dispute.contract.clientId },
        });
        if (!employerWallet) {
          throw new NotFoundException(this.translate('WALLET_NOT_FOUND', resolveDto.lang));
        }
        if (employerWallet.currency !== dispute.contract.currency) {
          throw new BadRequestException(
            this.translate('WALLET_CURRENCY_MISMATCH', resolveDto.lang),
          );
        }
        employerWalletId = employerWallet.id;

        const escrow = await transaction.escrowTransaction.findUnique({
          where: { freelanceJobId: dispute.contract.freelanceJobId },
        });
        if (!escrow || escrow.status !== 'DISPUTED') {
          throw new ConflictException(this.translate('ESCROW_NOT_DISPUTED', resolveDto.lang));
        }
        if (escrow.currency !== dispute.contract.currency) {
          throw new BadRequestException(
            this.translate('ESCROW_CURRENCY_MISMATCH', resolveDto.lang),
          );
        }
        if (refundAmount > escrow.grossAmount) {
          throw new BadRequestException(this.translate('REFUND_EXCEEDS_ESCROW', resolveDto.lang));
        }
        escrowId = escrow.id;
      }

      const resolutionUpdate = await transaction.dispute.updateMany({
        where: { id: disputeId, resolvedAt: null, resolution: null },
        data: {
          resolution: this.sanitizePii(resolveDto.resolution),
          resolvedById: adminUserId,
          refundAmount,
          refundCurrency,
          resolvedAt,
        },
      });
      if (resolutionUpdate.count !== 1) {
        throw new ConflictException(this.translate('CONCURRENT_UPDATE', resolveDto.lang));
      }

      if (refundAmount !== undefined && employerWalletId) {
        await transaction.employerWallet.update({
          where: { id: employerWalletId },
          data: { balance: { increment: refundAmount } },
        });
        await transaction.employerWalletTransaction.create({
          data: {
            walletId: employerWalletId,
            type: 'CREDIT_AVAILABLE',
            amount: refundAmount,
            escrowId,
            note: `Dispute ${disputeId} refund for contract ${dispute.contractId}`,
          },
        });
        const escrowUpdate = await transaction.escrowTransaction.updateMany({
          where: { id: escrowId, status: 'DISPUTED' },
          data: { status: 'REFUNDED' },
        });
        if (escrowUpdate.count !== 1) {
          throw new ConflictException(this.translate('CONCURRENT_UPDATE', resolveDto.lang));
        }
      }

      const contractUpdate = await transaction.contract.updateMany({
        where: { id: dispute.contractId, status: 'DISPUTED' },
        data: { status: refundAmount !== undefined ? 'CANCELLED' : 'COMPLETED' },
      });
      if (contractUpdate.count !== 1) {
        throw new ConflictException(this.translate('CONCURRENT_UPDATE', resolveDto.lang));
      }

      return transaction.dispute.findUniqueOrThrow({ where: { id: disputeId } });
    });

    return {
      message: this.translate('DISPUTE_RESOLVED', resolveDto.lang),
      dispute: updatedDispute,
    };
  }

  /**
   * Lists all disputes for admin review.
   */
  async getAllDisputes(query: DisputeQueryDto): Promise<{
    items: Dispute[];
    total: number;
    page: number;
    limit: number;
  }> {
    const where =
      query.status === 'OPEN'
        ? { resolvedAt: null }
        : query.status === 'RESOLVED'
          ? { resolvedAt: { not: null } }
          : {};
    const [items, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          contract: {
            select: {
              id: true,
              status: true,
              agreedAmount: true,
              currency: true,
            },
          },
        },
      }),
      this.prisma.dispute.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  /** Resolves a localized dispute message with a safe English fallback. */
  private translate(key: string, lang: 'en' | 'am' = 'en'): string {
    const fallback: Record<string, string> = {
      CONTRACT_NOT_FOUND: 'Contract not found',
      UNAUTHORIZED_DISPUTE: 'You are not authorized to manage this dispute',
      CONTRACT_NOT_ACTIVE: 'Only active contracts can be disputed',
      CONCURRENT_UPDATE: 'The dispute was changed by another request; refresh and try again',
      INVALID_DISPUTE: 'Invalid or non-existent dispute',
      ALREADY_RESOLVED: 'Dispute is already resolved',
      CONTRACT_NOT_DISPUTED: 'The related contract is not in a disputed state',
      REFUND_TOO_LARGE: 'Refund amount cannot exceed the contract agreed amount',
      REFUND_CURRENCY_MISMATCH: 'Refund currency must match the contract currency',
      WALLET_NOT_FOUND: 'Employer wallet not found',
      WALLET_CURRENCY_MISMATCH: 'Employer wallet currency does not match the contract currency',
      ESCROW_NOT_DISPUTED: 'The contract escrow is not available for dispute settlement',
      ESCROW_CURRENCY_MISMATCH: 'Escrow currency does not match the contract currency',
      REFUND_EXCEEDS_ESCROW: 'Refund amount cannot exceed the funded escrow amount',
      DISPUTE_RESOLVED: 'Dispute resolved successfully',
    };
    const translated = this.i18n.t(`dispute-manager.${key}`, {
      lang,
      defaultValue: fallback[key] || key,
    });
    return typeof translated === 'string' ? translated : fallback[key] || key;
  }
}
