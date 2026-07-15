import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
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
  ) { }

  /**
   * Creates a dispute for a contract that the current user is allowed to review.
   */
  async createDispute(userId: string, createDisputeDto: CreateDisputeDto): Promise<Dispute> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: createDisputeDto.contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.clientId !== userId && contract.freelancerId !== userId) {
      throw new BadRequestException('You are not authorized to raise a dispute for this contract');
    }

    const sanitizedReason = this.sanitizePii(createDisputeDto.reason);
    await this.prisma.contract.update({
      where: { id: contract.id },
      data: { status: 'DISPUTED' },
    });

    return this.prisma.dispute.create({
      data: {
        contractId: createDisputeDto.contractId,
        raisedById: userId,
        reason: sanitizedReason,
        evidenceUrls: createDisputeDto.evidenceUrls,
      },
    });
  }

  /**
   * Redacts personal data from dispute text before it is stored.
   */
  private sanitizePii(text: string): string {
    if (!text) return text;
    let sanitized = text.replace(/[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+/gi, '[REDACTED EMAIL]');
    sanitized = sanitized.replace(/(\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9})/g, '[REDACTED PHONE]');
    return sanitized;
  }

  /**
   * Resolves an open dispute and updates the related contract state.
   */
  async resolveDispute(disputeId: string, resolveDto: ResolveDisputeDto): Promise<{ message: string; dispute: Dispute }> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { contract: true },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (dispute.resolution) {
      throw new BadRequestException('Dispute is already resolved');
    }

    if (resolveDto.refundAmount && resolveDto.refundAmount > dispute.contract.agreedAmount) {
      throw new BadRequestException('Refund amount cannot exceed the contract agreed amount');
    }

    const updatedDispute = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        resolution: resolveDto.resolution,
        resolvedAt: new Date(),
      },
    });

    // Apply any approved refund to the employer wallet.
    if (resolveDto.refundAmount && resolveDto.refundAmount > 0) {
      const employerWallet = await this.prisma.employerWallet.findUnique({
        where: { userId: dispute.contract.clientId },
      });

      if (employerWallet) {
        await this.prisma.$transaction([
          this.prisma.employerWallet.update({
            where: { id: employerWallet.id },
            data: { balance: { increment: resolveDto.refundAmount } },
          }),
          this.prisma.employerWalletTransaction.create({
            data: {
              walletId: employerWallet.id,
              type: 'CREDIT_AVAILABLE',
              amount: resolveDto.refundAmount,
              note: `Admin dispute resolution refund for contract ${dispute.contractId}`,
            },
          }),
        ]);
      }
    }

    // Choose the final contract state after the dispute resolution.
    const finalContractStatus = (resolveDto.refundAmount && resolveDto.refundAmount > 0) ? 'CANCELLED' : 'COMPLETED';

    await this.prisma.contract.update({
      where: { id: dispute.contractId },
      data: { status: finalContractStatus },
    });

    const lang = resolveDto.lang || 'en';
    const message = this.i18n.t('dispute-manager.DISPUTE_RESOLVED', { lang, defaultValue: 'Dispute resolved successfully' });

    return {
      message: typeof message === 'string' ? message : 'Dispute resolved successfully',
      dispute: updatedDispute,
    };
  }

  /**
   * Lists all disputes for admin review.
   */
  async getAllDisputes(): Promise<Dispute[]> {
    return this.prisma.dispute.findMany({
      include: {
        contract: {
          select: {
            id: true,
            status: true,
            agreedAmount: true,
            currency: true,
          }
        }
      }
    });
  }
}
