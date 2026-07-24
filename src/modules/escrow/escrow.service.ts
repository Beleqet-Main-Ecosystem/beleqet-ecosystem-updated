import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES, ESCROW_JOBS } from '../queues/queues.constants';
import { WalletService } from '../wallet/wallet.service';
import { ChapaClient } from '../chapa/chapa.client';
import { ChapaWebhookPayload } from '../chapa/chapa.types';
import { ConfirmMilestoneDto } from './dto/confirm-milestone.dto';
import { isMilestoneFullyConfirmed } from './escrow-state';

const PLATFORM_FEE_PCT = 0.1;
const MILESTONE_HOLD_MS = 3 * 24 * 60 * 60 * 1000;

type MilestoneWithEscrow = Prisma.MilestoneGetPayload<{
  include: { contract: { include: { freelanceJob: { include: { escrowTx: true } } } } };
}>;
type MilestoneActor = 'EMPLOYER' | 'FREELANCER';

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly walletSvc: WalletService,
    private readonly chapaClient: ChapaClient,
    @InjectQueue(QUEUE_NAMES.ESCROW) private readonly escrowQueue: Queue,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates or refreshes an escrow transaction for a freelance gig and
   * initializes Chapa hosted checkout for any portion not already covered by
   * the employer wallet. Chapa checkout creation is not treated as proof of
   * funding; webhooks are verified by the processor before funds become locked.
   */
  async initiate(clientId: string, freelanceJobId: string) {
    const job = await this.prisma.freelanceJob.findFirst({
      where: { id: freelanceJobId, clientId },
      include: { client: true, contract: true },
    });
    if (!job) throw new NotFoundException('Gig not found');

    const grossAmount = job.contract ? job.contract.agreedAmount : job.budgetMax;
    if (!job.contract) {
      this.logger.warn(
        `Escrow initiated without a contract for job ${freelanceJobId}; using budgetMax.`,
      );
    }

    const employerWallet = await this.prisma.employerWallet.findUnique({
      where: { userId: clientId },
    });
    const availableBalance = employerWallet?.balance || 0;
    let amountToPay = grossAmount;
    let walletAppliedAmount = 0;

    if (availableBalance > 0) {
      walletAppliedAmount = Math.min(availableBalance, grossAmount);
      amountToPay = grossAmount - walletAppliedAmount;

      const updateResult = await this.prisma.employerWallet.updateMany({
        where: { userId: clientId, balance: { gte: walletAppliedAmount } },
        data: {
          balance: { decrement: walletAppliedAmount },
          lockedBalance: { increment: walletAppliedAmount },
        },
      });
      if (updateResult.count === 0) {
        throw new BadRequestException('Insufficient balance or concurrent transaction');
      }
    }

    const platformFee = Math.round(grossAmount * PLATFORM_FEE_PCT);
    const netAmount = grossAmount - platformFee;
    const txRef = `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const escrow = await this.prisma.escrowTransaction.upsert({
      where: { freelanceJobId },
      update: {
        grossAmount,
        platformFee,
        netAmount,
        walletAppliedAmount,
        currency: job.currency,
        status: amountToPay === 0 ? 'FUNDED' : 'PENDING',
        gatewayRef: txRef,
      },
      create: {
        freelanceJobId,
        grossAmount,
        platformFee,
        netAmount,
        walletAppliedAmount,
        currency: job.currency,
        status: amountToPay === 0 ? 'FUNDED' : 'PENDING',
        gatewayRef: txRef,
      },
    });

    if (walletAppliedAmount > 0 && amountToPay > 0) {
      await this.escrowQueue.add(
        ESCROW_JOBS.UNLOCK_FUNDS,
        { escrowId: escrow.id, clientId, amount: walletAppliedAmount },
        { delay: 24 * 60 * 60 * 1000 },
      );
    }

    if (amountToPay === 0) {
      await this.prisma.$transaction([
        this.prisma.employerWalletTransaction.create({
          data: {
            walletId: employerWallet!.id,
            type: 'DEBIT_WITHDRAWAL',
            amount: walletAppliedAmount,
            note: `Fully funded escrow for job ${freelanceJobId}`,
            escrowId: escrow.id,
          },
        }),
        this.prisma.employerWallet.update({
          where: { userId: clientId },
          data: { lockedBalance: { decrement: walletAppliedAmount } },
        }),
        this.prisma.freelanceJob.update({
          where: { id: freelanceJobId },
          data: { status: 'FUNDED' },
        }),
        this.prisma.eventLog.create({
          data: {
            eventType: 'escrow.funded',
            entityId: escrow.id,
            entityType: 'EscrowTransaction',
            payload: { amount: grossAmount, walletAppliedAmount, source: 'employer_wallet' },
            processedBy: EscrowService.name,
          },
        }),
      ]);

      this.eventEmitter.emit('payment.escrow.funded', {
        escrowId: escrow.id,
        clientId,
        grossAmount,
        currency: job.currency,
        source: 'employer_wallet',
        timestamp: new Date().toISOString(),
      });

      return {
        escrowId: escrow.id,
        checkoutUrl: null,
        grossAmount,
        platformFee,
        netAmount,
        walletAppliedAmount,
        amountToPay,
      };
    }

    let checkoutUrl = `${this.config.get('FRONTEND_URL')}/freelance/pay?escrow=${escrow.id}`;
    if (this.config.get<string>('CHAPA_SECRET_KEY')) {
      try {
        const data = await this.chapaClient.initializePayment({
          amount: amountToPay.toString(),
          currency: job.currency,
          email: job.client.email,
          firstName: job.client.firstName,
          lastName: job.client.lastName,
          txRef,
          callbackUrl: this.config.get<string>('CHAPA_CALLBACK_URL'),
          returnUrl: this.config.get<string>('CHAPA_RETURN_URL'),
          title: 'Beleqet Escrow',
          description: `Payment for Gig - ${job.title}`
            .replace(/[^a-zA-Z0-9\-_.\s]/g, '')
            .substring(0, 50),
        });
        checkoutUrl = data.data?.checkout_url ?? checkoutUrl;
      } catch (err) {
        this.logger.error(`Failed to initialize Chapa checkout: ${(err as Error).message}`);
      }
    }

    this.eventEmitter.emit('payment.escrow.initiated', {
      escrowId: escrow.id,
      clientId,
      grossAmount,
      currency: job.currency,
      timestamp: new Date().toISOString(),
    });

    return {
      escrowId: escrow.id,
      checkoutUrl,
      grossAmount,
      platformFee,
      netAmount,
      walletAppliedAmount,
      amountToPay,
    };
  }

  /**
   * Enqueues a signed Chapa webhook for verified processing. The deterministic
   * job id keeps webhook retries idempotent at the queue layer.
   */
  async handleWebhook(payload: ChapaWebhookPayload) {
    const txRef = String(payload.tx_ref ?? payload.trx_ref ?? payload.reference ?? 'unknown');
    const eventKey = [
      payload.event ?? payload.type ?? 'payment',
      txRef,
      payload.reference ?? 'no-provider-reference',
      payload.status ?? 'no-status',
    ].join(':');

    await this.escrowQueue.add(ESCROW_JOBS.PROCESS_WEBHOOK, payload, { jobId: eventKey });
    return { queued: true, eventKey };
  }

  /**
   * Records either employer or professional completion confirmation. Payout is
   * queued automatically only after both parties have confirmed and the escrow
   * transaction is funded.
   */
  async confirmMilestone(milestoneId: string, userId: string, _dto: ConfirmMilestoneDto = {}) {
    void _dto;

    return this.recordMilestoneConfirmation(milestoneId, userId);
  }

  /**
   * Backward-compatible employer release endpoint. It now records employer
   * confirmation and waits for the professional confirmation before queuing
   * release, satisfying the two-party escrow requirement.
   */
  async releaseMilestone(milestoneId: string, clientId: string) {
    return this.recordMilestoneConfirmation(milestoneId, clientId, 'EMPLOYER');
  }

  private async recordMilestoneConfirmation(
    milestoneId: string,
    userId: string,
    requiredActor?: MilestoneActor,
  ) {
    const { actor, updated } = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        await tx.$queryRaw`SELECT id FROM "milestones" WHERE id = ${milestoneId} FOR UPDATE`;

        const milestone = await tx.milestone.findFirst({
          where: {
            id: milestoneId,
            contract: { OR: [{ clientId: userId }, { freelancerId: userId }] },
          },
          include: { contract: { include: { freelanceJob: { include: { escrowTx: true } } } } },
        });
        if (!milestone) throw new NotFoundException('Milestone not found');

        const escrow = milestone.contract.freelanceJob.escrowTx;
        if (!escrow || escrow.status !== 'FUNDED') {
          throw new ConflictException('Escrow must be funded before milestone confirmation.');
        }

        const actor: MilestoneActor =
          milestone.contract.clientId === userId ? 'EMPLOYER' : 'FREELANCER';
        if (requiredActor && actor !== requiredActor) {
          throw new NotFoundException('Milestone not found');
        }

        const confirmedAt = new Date();
        const confirmationData =
          actor === 'EMPLOYER'
            ? { employerApprovedAt: milestone.employerApprovedAt ?? confirmedAt }
            : { freelancerApprovedAt: milestone.freelancerApprovedAt ?? confirmedAt };

        const updated = await tx.milestone.update({
          where: { id: milestoneId },
          data: confirmationData,
          include: { contract: { include: { freelanceJob: { include: { escrowTx: true } } } } },
        });

        await tx.eventLog.create({
          data: {
            eventType: 'milestone.confirmed',
            entityId: milestoneId,
            entityType: 'Milestone',
            payload: { actor, userId, milestoneId },
            processedBy: EscrowService.name,
          },
        });

        return { actor, updated };
      },
    );

    if (!isMilestoneFullyConfirmed(updated)) {
      return {
        success: true,
        released: false,
        waitingFor: actor === 'EMPLOYER' ? 'FREELANCER' : 'EMPLOYER',
      };
    }

    return this.queueMilestoneRelease(updated);
  }

  private async queueMilestoneRelease(milestone: MilestoneWithEscrow) {
    const netAmountInETB = this.netMilestoneAmountInETB(milestone);

    if (milestone.status === 'APPROVED') {
      await this.enqueueMilestoneAutoRelease(
        milestone,
        netAmountInETB,
        milestone.approvedAt ?? new Date(),
      );
      return { success: true, released: true, alreadyReleased: true };
    }

    if (!isMilestoneFullyConfirmed(milestone)) {
      throw new ForbiddenException(
        'Both employer and professional must confirm milestone completion.',
      );
    }

    const approvedAt = new Date();

    const claimedApproval = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const approval = await tx.milestone.updateMany({
        where: { id: milestone.id, status: { not: 'APPROVED' } },
        data: { status: 'APPROVED', approvedAt },
      });
      if (approval.count === 0) {
        return false;
      }

      const wallet = await tx.freelancerWallet.upsert({
        where: { userId: milestone.contract.freelancerId },
        update: { pendingBalance: { increment: netAmountInETB } },
        create: {
          userId: milestone.contract.freelancerId,
          pendingBalance: netAmountInETB,
          availableBalance: 0,
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'CREDIT_PENDING',
          amount: netAmountInETB,
          note: `Milestone ${milestone.id} approved - pending hold`,
          milestoneId: milestone.id,
        },
      });

      await tx.eventLog.create({
        data: {
          eventType: 'milestone.approved',
          entityId: milestone.id,
          entityType: 'Milestone',
          payload: {
            milestoneId: milestone.id,
            freelancerId: milestone.contract.freelancerId,
            amount: milestone.amount,
          },
          processedBy: EscrowService.name,
        },
      });

      return true;
    });

    if (!claimedApproval) {
      await this.enqueueMilestoneAutoRelease(
        milestone,
        netAmountInETB,
        milestone.approvedAt ?? approvedAt,
      );
      return { success: true, released: true, alreadyReleased: true };
    }

    await this.enqueueMilestoneAutoRelease(milestone, netAmountInETB, approvedAt);

    this.logger.log(`Milestone ${milestone.id} approved after both confirmations; payout queued`);
    return { success: true, released: true };
  }

  private netMilestoneAmountInETB(milestone: MilestoneWithEscrow): number {
    const contractCurrency = milestone.contract.currency || 'ETB';
    const grossAmountInETB = this.walletSvc.convertCurrency(
      milestone.amount,
      contractCurrency,
      'ETB',
    );
    const platformFee = Math.round(grossAmountInETB * PLATFORM_FEE_PCT);
    return grossAmountInETB - platformFee;
  }

  private async enqueueMilestoneAutoRelease(
    milestone: MilestoneWithEscrow,
    amount: number,
    approvedAt: Date,
  ): Promise<void> {
    const releaseAt = new Date(approvedAt.getTime() + MILESTONE_HOLD_MS);
    const delay = Math.max(0, releaseAt.getTime() - Date.now());

    await this.escrowQueue.add(
      ESCROW_JOBS.AUTO_RELEASE,
      {
        milestoneId: milestone.id,
        freelancerId: milestone.contract.freelancerId,
        amount,
        releaseAt,
      },
      {
        delay,
        jobId: `auto-release:${milestone.id}`,
      },
    );
  }
}
