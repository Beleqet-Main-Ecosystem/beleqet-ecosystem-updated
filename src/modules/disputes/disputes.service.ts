import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bullmq';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { QUEUE_NAMES, NOTIFICATION_JOBS, ESCROW_JOBS } from '../queues/queues.constants';

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly notificationsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ESCROW)
    private readonly escrowQueue: Queue,
  ) {}

  /** Raise a dispute on a contract */
  async createDispute(userId: string, dto: CreateDisputeDto, lang?: string) {
    const contract = await this.prisma.contract.findFirst({
      where: {
        id: dto.contractId,
        OR: [{ clientId: userId }, { freelancerId: userId }],
      },
      include: {
        client: true,
        freelancer: true,
        freelanceJob: {
          include: {
            escrowTx: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException(
        this.i18n.t('disputes.contractNotFound', {
          defaultValue: 'Contract not found or you are not a party to it',
        }),
      );
    }

    const existingDispute = await this.prisma.dispute.findUnique({
      where: { contractId: dto.contractId },
    });
    if (existingDispute) {
      throw new BadRequestException(
        this.i18n.t('disputes.alreadyExists', {
          defaultValue: 'A dispute already exists for this contract',
        }),
      );
    }

    if (!['ACTIVE', 'DISPUTED'].includes(contract.status)) {
      throw new BadRequestException(
        this.i18n.t('disputes.invalidContractStatus', {
          defaultValue: 'Dispute can only be raised on active contracts',
        }),
      );
    }

    const isClient = contract.clientId === userId;
    const _otherPartyId = isClient ? contract.freelancerId : contract.clientId;
    const _otherParty = isClient ? contract.freelancer : contract.client;

    const dispute = await this.prisma.$transaction(async (tx) => {
      const dispute = await tx.dispute.create({
        data: {
          contractId: dto.contractId,
          raisedById: userId,
          reason: dto.reason,
          evidenceUrls: dto.evidenceUrls || [],
        },
      });

      await tx.contract.update({
        where: { id: dto.contractId },
        data: { status: 'DISPUTED' },
      });

      if (contract.freelanceJob.escrowTx) {
        await tx.escrowTransaction.update({
          where: { id: contract.freelanceJob.escrowTx.id },
          data: { status: 'DISPUTED' },
        });
      }

      await tx.eventLog.create({
        data: {
          eventType: 'dispute.raised',
          entityId: dispute.id,
          entityType: 'Dispute',
          payload: {
            disputeId: dispute.id,
            contractId: dto.contractId,
            raisedBy: userId,
            reason: dto.reason,
          },
          processedBy: 'DisputesService',
        },
      });

      return dispute;
    });

    const partyType = isClient
      ? this.i18n.t('notifications.disputes.notification.partyTypeClient', {
          lang,
          defaultValue: 'Client',
        })
      : this.i18n.t('notifications.disputes.notification.partyTypeFreelancer', {
          lang,
          defaultValue: 'Freelancer',
        });
    await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
      userId: isClient ? contract.freelancerId : contract.clientId,
      type: 'dispute.raised',
      title: this.i18n.t('notifications.disputes.notification.raisedForOtherTitle', {
        lang,
        defaultValue: 'Dispute raised on your contract',
      }),
      body: this.i18n.t('notifications.disputes.notification.raisedForOtherBody', {
        lang,
        args: { partyType, contractId: contract.id.slice(0, 8), reason: dto.reason.slice(0, 100) },
        defaultValue:
          '{partyType} has raised a dispute on contract #{contractId}. Reason: {reason}...',
      }),
      metadata: { disputeId: dispute.id, contractId: dto.contractId },
    });

    await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
      userId: userId,
      type: 'dispute.raised',
      title: this.i18n.t('notifications.disputes.notification.raisedForSelfTitle', {
        lang,
        defaultValue: 'Dispute submitted',
      }),
      body: this.i18n.t('notifications.disputes.notification.raisedForSelfBody', {
        lang,
        defaultValue:
          'Your dispute has been submitted. The other party has been notified. Our team will review the case.',
      }),
      metadata: { contractId: dto.contractId },
    });

    this.logger.log(`Dispute created: contract ${dto.contractId} by user ${userId}`);
    return {
      success: true,
      message: 'Dispute raised successfully. Both parties have been notified.',
    };
  }

  /** Get dispute by contract ID */
  async getDisputeByContract(contractId: string, userId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: {
        id: contractId,
        OR: [{ clientId: userId }, { freelancerId: userId }],
      },
    });

    if (!contract) {
      throw new NotFoundException(
        this.i18n.t('disputes.contractNotFoundGeneric', { defaultValue: 'Contract not found' }),
      );
    }

    const dispute = await this.prisma.dispute.findUnique({
      where: { contractId },
      include: {
        raisedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        contract: { select: { id: true, clientId: true, freelancerId: true } },
      },
    });

    if (!dispute) {
      throw new NotFoundException(
        this.i18n.t('disputes.noDisputeFound', {
          defaultValue: 'No dispute found for this contract',
        }),
      );
    }

    return dispute;
  }

  /** Get user's disputes */
  async getMyDisputes(userId: string) {
    return this.prisma.dispute.findMany({
      where: {
        OR: [
          { raisedById: userId },
          { contract: { clientId: userId } },
          { contract: { freelancerId: userId } },
        ],
      },
      include: {
        contract: { select: { id: true, status: true } },
        raisedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Admin: get all disputes */
  async fetchAllDisputes() {
    return this.prisma.dispute.findMany({
      include: {
        contract: {
          select: {
            id: true,
            status: true,
            client: { select: { id: true, firstName: true, lastName: true } },
            freelancer: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        raisedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Admin: resolve a dispute with fund handling */
  async resolveDispute(
    disputeId: string,
    resolution: string,
    resolutionType:
      'RELEASE_TO_FREELANCER' | 'REFUND_TO_CLIENT' | 'SPLIT_50_50' | 'PARTIAL_RELEASE',
    adminId: string,
    partialPercentage?: number,
    lang?: string,
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        contract: {
          include: {
            client: { select: { id: true, firstName: true } },
            freelancer: { select: { id: true, firstName: true } },
            freelanceJob: {
              include: {
                escrowTx: true,
              },
            },
          },
        },
      },
    });

    if (!dispute) {
      throw new NotFoundException(
        this.i18n.t('disputes.disputeNotFound', { defaultValue: 'Dispute not found' }),
      );
    }

    if (dispute.resolvedAt) {
      throw new BadRequestException(
        this.i18n.t('disputes.alreadyResolved', { defaultValue: 'Dispute is already resolved' }),
      );
    }

    const escrow = dispute.contract.freelanceJob?.escrowTx;
    if (!escrow) {
      throw new BadRequestException(
        this.i18n.t('disputes.noEscrowForContract', {
          defaultValue: 'No escrow found for this contract',
        }),
      );
    }

    if (escrow.status !== 'DISPUTED') {
      throw new BadRequestException(
        this.i18n.t('disputes.escrowNotDisputed', {
          args: { status: escrow.status },
          defaultValue: 'Escrow is in {status} status, must be DISPUTED',
        }),
      );
    }

    if (
      resolutionType === 'PARTIAL_RELEASE' &&
      (!partialPercentage || partialPercentage < 1 || partialPercentage > 99)
    ) {
      throw new BadRequestException(
        this.i18n.t('disputes.invalidPartialPercentage', {
          defaultValue: 'partialPercentage must be between 1 and 99 for PARTIAL_RELEASE',
        }),
      );
    }

    const freelancerId = dispute.contract.freelancerId;
    const clientId = dispute.contract.clientId;

    let chapaRefundAmount = 0;

    const _resolved = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.dispute.update({
        where: { id: disputeId },
        data: {
          resolution,
          resolutionType,
          resolvedAt: new Date(),
          resolvedById: adminId,
        },
      });

      let escrowStatus: string;
      let freelancerAmount = 0;
      let walletRefundAmount = 0;

      const chapaPaidAmount = Math.max(0, escrow.grossAmount - escrow.walletAppliedAmount);

      switch (resolutionType) {
        case 'RELEASE_TO_FREELANCER':
          escrowStatus = 'RELEASED';
          freelancerAmount = escrow.netAmount;
          walletRefundAmount = 0;
          chapaRefundAmount = 0;
          break;

        case 'REFUND_TO_CLIENT':
          escrowStatus = 'REFUNDED';
          freelancerAmount = 0;
          walletRefundAmount = escrow.walletAppliedAmount;
          chapaRefundAmount = chapaPaidAmount;
          break;

        case 'SPLIT_50_50': {
          escrowStatus = 'RELEASED';

          const halfGross = Math.floor(escrow.grossAmount / 2);
          freelancerAmount = halfGross;
          const totalClientRefund = escrow.grossAmount - freelancerAmount;
          walletRefundAmount = Math.min(totalClientRefund, escrow.walletAppliedAmount);
          chapaRefundAmount = totalClientRefund - walletRefundAmount;
          break;
        }

        case 'PARTIAL_RELEASE': {
          escrowStatus = 'RELEASED';

          freelancerAmount = Math.round(escrow.netAmount * (partialPercentage! / 100));
          const totalClientRefund = escrow.grossAmount - freelancerAmount;
          walletRefundAmount = Math.min(totalClientRefund, escrow.walletAppliedAmount);
          chapaRefundAmount = totalClientRefund - walletRefundAmount;
          break;
        }
      }

      await tx.escrowTransaction.update({
        where: { id: escrow.id },
        data: {
          status: escrowStatus as any,
          releasedAt: escrowStatus === 'RELEASED' ? new Date() : undefined,
        },
      });

      if (freelancerAmount > 0) {
        await tx.freelancerWallet.upsert({
          where: { userId: freelancerId },
          update: { pendingBalance: { increment: freelancerAmount } },
          create: { userId: freelancerId, pendingBalance: freelancerAmount, availableBalance: 0 },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: (await tx.freelancerWallet.findUnique({ where: { userId: freelancerId } }))!
              .id,
            type: 'CREDIT_PENDING',
            amount: freelancerAmount,
            note: `Dispute resolved: ${resolutionType.replace(/_/g, ' ').toLowerCase()}`,
          },
        });
      }

      if (walletRefundAmount > 0 && escrow.walletAppliedAmount > 0) {
        const wallet = await tx.employerWallet.findUnique({ where: { userId: clientId } });
        if (wallet) {
          await tx.employerWallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: walletRefundAmount } },
          });

          await tx.employerWalletTransaction.create({
            data: {
              walletId: wallet.id,
              type: 'CREDIT_AVAILABLE',
              amount: walletRefundAmount,
              note: `Dispute resolved: ${resolutionType.replace(/_/g, ' ').toLowerCase()}`,
              escrowId: escrow.id,
            },
          });
        }
      }

      await tx.contract.update({
        where: { id: dispute.contractId },
        data: { status: 'COMPLETED' },
      });

      await tx.eventLog.create({
        data: {
          eventType: 'dispute.resolved',
          entityId: disputeId,
          entityType: 'Dispute',
          payload: {
            disputeId,
            contractId: dispute.contractId,
            resolution,
            resolutionType,
            resolvedBy: adminId,
            escrowId: escrow.id,
            escrowStatus,
            freelancerAmount,
            walletRefundAmount,
            chapaRefundAmount,
          },
          processedBy: 'DisputesService',
        },
      });

      return updated;
    });

    if (chapaRefundAmount > 0 && escrow.gatewayRef) {
      await this.escrowQueue.add(ESCROW_JOBS.CANCEL_CHAPA_PAYMENT, {
        escrowId: escrow.id,
        gatewayRef: escrow.gatewayRef,
        clientId,
      });
      this.logger.log(
        `Queued CANCEL_CHAPA_PAYMENT for dispute ${disputeId} — gatewayRef=${escrow.gatewayRef}, amount=${chapaRefundAmount}`,
      );
    }

    const _clientName = dispute.contract.client?.firstName || 'Client';
    const _freelancerName = dispute.contract.freelancer?.firstName || 'Freelancer';

    const clientRefundTypes = ['REFUND_TO_CLIENT', 'SPLIT_50_50', 'PARTIAL_RELEASE'];
    const freelancerReleaseTypes = ['RELEASE_TO_FREELANCER', 'SPLIT_50_50', 'PARTIAL_RELEASE'];
    const clientResolutionDetail = clientRefundTypes.includes(resolutionType)
      ? this.i18n.t('notifications.disputes.notification.refundedDetail', {
          lang,
          defaultValue: 'Funds have been refunded to your wallet.',
        })
      : this.i18n.t('notifications.disputes.notification.closedDetail', {
          lang,
          defaultValue: 'The case has been reviewed and closed.',
        });
    const freelancerResolutionDetail = freelancerReleaseTypes.includes(resolutionType)
      ? this.i18n.t('notifications.disputes.notification.releasedDetail', {
          lang,
          defaultValue: 'Funds have been released to your wallet.',
        })
      : this.i18n.t('notifications.disputes.notification.closedDetail', {
          lang,
          defaultValue: 'The case has been reviewed and closed.',
        });

    await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
      userId: clientId,
      type: 'dispute.resolved',
      title: this.i18n.t('notifications.disputes.notification.resolvedTitle', {
        lang,
        defaultValue: 'Dispute resolved',
      }),
      body: this.i18n.t('notifications.disputes.notification.resolvedClientBody', {
        lang,
        args: {
          contractId: dispute.contractId.slice(0, 8),
          resolutionDetail: clientResolutionDetail,
        },
        defaultValue:
          'Your dispute on contract #{contractId} has been resolved. {resolutionDetail}',
      }),
      metadata: { disputeId, contractId: dispute.contractId, resolutionType },
    });

    await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
      userId: freelancerId,
      type: 'dispute.resolved',
      title: this.i18n.t('notifications.disputes.notification.resolvedTitle', {
        lang,
        defaultValue: 'Dispute resolved',
      }),
      body: this.i18n.t('notifications.disputes.notification.resolvedFreelancerBody', {
        lang,
        args: {
          contractId: dispute.contractId.slice(0, 8),
          resolutionDetail: freelancerResolutionDetail,
        },
        defaultValue:
          'Your dispute on contract #{contractId} has been resolved. {resolutionDetail}',
      }),
      metadata: { disputeId, contractId: dispute.contractId, resolutionType },
    });

    this.logger.log(`Dispute resolved: ${disputeId} by admin ${adminId} — type: ${resolutionType}`);
    return { success: true, message: 'Dispute resolved successfully.' };
  }
}
