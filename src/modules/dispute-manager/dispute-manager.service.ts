import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { I18nService } from 'nestjs-i18n';
import type { Dispute } from '@prisma/client';

/**
 * Manages dispute creation, review, and resolution.
 */
/** Same as a milestone release (EscrowService). */
const DISPUTE_PLATFORM_FEE_PCT = 0.1;

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
   * Settles a dispute: what is still held in escrow (funded amount minus milestones already
   * released) goes to the client, the freelancer, or both, in one transaction. The freelancer's
   * share pays the same platform fee as a milestone release and is available straight away,
   * since an admin has decided it.
   */
  async resolveDispute(
    disputeId: string,
    resolveDto: ResolveDisputeDto,
    adminId?: string,
  ): Promise<{ message: string; dispute: Dispute }> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { contract: { include: { freelanceJob: { include: { escrowTx: true } } } } },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (dispute.resolvedAt) {
      throw new BadRequestException('Dispute is already resolved');
    }

    const { contract } = dispute;
    const escrow = contract.freelanceJob?.escrowTx;
    // Only money that was actually paid in can be paid out.
    const holdsMoney = escrow && (escrow.status === 'DISPUTED' || escrow.status === 'FUNDED');
    const released = await this.prisma.milestone.aggregate({
      where: { contractId: contract.id, status: 'APPROVED' },
      _sum: { amount: true },
    });
    const held = holdsMoney ? Math.max(0, escrow.grossAmount - (released._sum.amount ?? 0)) : 0;

    const freelancerGross =
      resolveDto.outcome === 'REFUND'
        ? 0
        : resolveDto.outcome === 'RELEASE'
          ? held
          : resolveDto.freelancerAmount;
    if (freelancerGross === undefined) {
      throw new BadRequestException("Give the freelancer's share when splitting");
    }
    if (freelancerGross > held) {
      throw new BadRequestException(
        `The freelancer's share can't be more than the ${held} still held in escrow`,
      );
    }
    const clientRefund = held - freelancerGross;
    const freelancerNet = freelancerGross - Math.round(freelancerGross * DISPUTE_PLATFORM_FEE_PCT);

    const updatedDispute = await this.prisma.$transaction(async (tx) => {
      // A second, concurrent resolution matches nothing and stops here, so money moves once.
      const { count } = await tx.dispute.updateMany({
        where: { id: disputeId, resolvedAt: null },
        data: {
          resolution: resolveDto.resolution,
          resolvedAt: new Date(),
          outcome: resolveDto.outcome,
          clientAmount: clientRefund,
          freelancerAmount: freelancerGross,
          resolvedById: adminId ?? null,
        },
      });
      if (count === 0) throw new BadRequestException('Dispute is already resolved');

      if (clientRefund > 0) {
        const wallet = await tx.employerWallet.upsert({
          where: { userId: contract.clientId },
          update: { balance: { increment: clientRefund } },
          create: { userId: contract.clientId, balance: clientRefund, lockedBalance: 0 },
        });
        await tx.employerWalletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'CREDIT_AVAILABLE',
            amount: clientRefund,
            note: `Dispute settlement refund for contract ${contract.id}`,
            escrowId: escrow?.id,
          },
        });
      }

      if (freelancerNet > 0) {
        const wallet = await tx.freelancerWallet.upsert({
          where: { userId: contract.freelancerId },
          update: { availableBalance: { increment: freelancerNet } },
          create: {
            userId: contract.freelancerId,
            availableBalance: freelancerNet,
            pendingBalance: 0,
          },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'CREDIT_AVAILABLE',
            amount: freelancerNet,
            note: `Dispute settlement for contract ${contract.id}`,
          },
        });
      }

      if (holdsMoney) {
        await tx.escrowTransaction.update({
          where: { id: escrow.id },
          data:
            freelancerGross > 0
              ? { status: 'RELEASED', releasedAt: new Date() }
              : { status: 'REFUNDED' },
        });
      }

      // Nothing to the freelancer means the work was not accepted.
      await tx.contract.update({
        where: { id: contract.id },
        data: { status: freelancerGross === 0 && held > 0 ? 'CANCELLED' : 'COMPLETED' },
      });

      await tx.eventLog.create({
        data: {
          eventType: 'dispute.resolved',
          entityId: disputeId,
          entityType: 'Dispute',
          payload: {
            contractId: contract.id,
            outcome: resolveDto.outcome,
            held,
            clientRefund,
            freelancerGross,
            freelancerNet,
          },
          processedBy: DisputeManagerService.name,
        },
      });

      return tx.dispute.findUniqueOrThrow({ where: { id: disputeId } });
    });

    const lang = resolveDto.lang || 'en';
    const message = this.i18n.t('dispute-manager.DISPUTE_RESOLVED', {
      lang,
      defaultValue: 'Dispute resolved successfully',
    });

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
          },
        },
      },
    });
  }
}
