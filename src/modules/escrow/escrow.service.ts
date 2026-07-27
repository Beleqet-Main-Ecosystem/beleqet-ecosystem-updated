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
const ESCROW_REINIT_BLOCKING_STATUSES = ['FUNDED', 'IN_REVIEW', 'RELEASED', 'DISPUTED'] as const;

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

    const platformFee = Math.round(grossAmount * PLATFORM_FEE_PCT);
    const netAmount = grossAmount - platformFee;
    const txRef = `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const funding = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`SELECT id FROM "freelance_jobs" WHERE id = ${freelanceJobId} FOR UPDATE`;

      const existingEscrow = await tx.escrowTransaction.findUnique({
        where: { freelanceJobId },
      });
      if (existingEscrow) {
        if (
          ESCROW_REINIT_BLOCKING_STATUSES.includes(
            existingEscrow.status as (typeof ESCROW_REINIT_BLOCKING_STATUSES)[number],
          )
        ) {
          throw new ConflictException('Escrow is already funded or active for this gig.');
        }
        `Escrow initiated without a contract for job ${freelanceJobId} — using budgetMax. Consider initiating escrow after bid acceptance.`,

    const employerWallet = await this.prisma.employerWallet.findUnique({
      where: { userId: clientId },
    const availableBalance = employerWallet?.balance || 0;

    let amountToPay = grossAmount;
    let walletAppliedAmount = 0;

    if (availableBalance > 0) {
      if (availableBalance >= grossAmount) {
        amountToPay = 0;
        walletAppliedAmount = grossAmount;
      } else {
        amountToPay = grossAmount - availableBalance;
        walletAppliedAmount = availableBalance;

      const updateResult = await this.prisma.employerWallet.updateMany({
        where: { userId: clientId, balance: { gte: walletAppliedAmount } },
        data: {
          balance: { decrement: walletAppliedAmount },
          lockedBalance: { increment: walletAppliedAmount },
        },
      if (updateResult.count === 0) {
        throw new BadRequestException('Insufficient balance or concurrent transaction');



    const escrow = await this.prisma.escrowTransaction.upsert({
      update: {
        grossAmount,
        platformFee,
        netAmount,
        walletAppliedAmount,
        status: amountToPay === 0 ? 'FUNDED' : 'PENDING',
        gatewayRef: txRef,
      },
      create: {
        freelanceJobId,
        grossAmount,
        platformFee,
        netAmount,
        walletAppliedAmount,
        status: amountToPay === 0 ? 'FUNDED' : 'PENDING',
        gatewayRef: txRef,
      },

    if (walletAppliedAmount > 0 && amountToPay > 0) {
      // Queue a job to unlock funds if Chapa payment is not completed in 24 hours
      await this.escrowQueue.add(
        ESCROW_JOBS.UNLOCK_FUNDS,
        {
          escrowId: escrow.id,
          clientId,
          amount: walletAppliedAmount,
        },
        { delay: 24 * 60 * 60 * 1000 },

    if (amountToPay === 0) {
      await this.prisma.employerWalletTransaction.create({
        data: {
          walletId: employerWallet!.id,
          type: 'DEBIT_WITHDRAWAL',
          amount: walletAppliedAmount,
          note: `Fully funded escrow for job ${freelanceJobId}`,
          escrowId: escrow.id,
        },

        if (existingEscrow.status === 'PENDING') {
          return {
            escrow: existingEscrow,
            amountToPay: Math.max(
              0,
              existingEscrow.grossAmount - existingEscrow.walletAppliedAmount,
            ),
            walletAppliedAmount: existingEscrow.walletAppliedAmount,
            platformFee: existingEscrow.platformFee,
            netAmount: existingEscrow.netAmount,
            existingPending: true,
            fundedFromWallet: false,
          };
        }
      }

      const employerWallet = await tx.employerWallet.findUnique({
        where: { userId: clientId },
        data: { lockedBalance: { decrement: walletAppliedAmount } },
      });
      const availableBalance = employerWallet?.balance || 0;
      let amountToPay = grossAmount;
      let walletAppliedAmount = 0;

      if (availableBalance > 0) {
        walletAppliedAmount = Math.min(availableBalance, grossAmount);
        amountToPay = grossAmount - walletAppliedAmount;

        const updateResult = await tx.employerWallet.updateMany({
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

      const escrowData = {
        grossAmount,
        platformFee,
        netAmount,
        walletAppliedAmount,
        currency: job.currency,
        status: amountToPay === 0 ? ('FUNDED' as const) : ('PENDING' as const),
        gatewayRef: txRef,
      };

      const escrow =
        existingEscrow?.status === 'REFUNDED'
          ? await tx.escrowTransaction.update({
              where: { id: existingEscrow.id },
              data: escrowData,
            })
          : await tx.escrowTransaction.create({
              data: {
                freelanceJobId,
                ...escrowData,
              },
            });

      if (amountToPay === 0) {
        if (!employerWallet) {
          throw new BadRequestException('Employer wallet is required for wallet funding.');
        }

        await tx.employerWalletTransaction.create({
          data: {
            walletId: employerWallet.id,
            type: 'DEBIT_WITHDRAWAL',
            amount: walletAppliedAmount,
            note: `Fully funded escrow for job ${freelanceJobId}`,
            escrowId: escrow.id,
          },
      this.logger.log(
        `Escrow initiated (fully funded via wallet): ${escrow.id} for job ${freelanceJobId} — amount: ETB ${grossAmount}`,
      );
      return {
        checkoutUrl: null,

    let checkoutUrl = `${this.config.get('FRONTEND_URL')}/freelance/pay?escrow=${escrow.id}`;

    const chapaSecret = this.config.get<string>('CHAPA_SECRET_KEY');
    if (chapaSecret) {
      try {
        const response = await fetch('https://api.chapa.co/v1/transaction/initialize', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${chapaSecret}`,
            'Content-Type': 'application/json',
          body: JSON.stringify({
            amount: amountToPay.toString(),
            email: job.client.email,
            first_name: job.client.firstName,
            last_name: job.client.lastName,
            tx_ref: txRef,
            callback_url: this.config.get<string>('CHAPA_CALLBACK_URL'),
            return_url: this.config.get<string>('CHAPA_RETURN_URL'),
            customization: {
              title: 'Beleqet Escrow',
              description: `Payment for Gig - ${job.title}`
                .replace(/[^a-zA-Z0-9\-_\.\s]/g, '')
                .substring(0, 50),
          }),
        });

        await tx.employerWallet.update({
          where: { userId: clientId },
          data: { lockedBalance: { decrement: walletAppliedAmount } },
        });

        await tx.freelanceJob.update({
          where: { id: freelanceJobId },
          data: { status: 'FUNDED' },
        });

        await tx.eventLog.create({
          data: {
            eventType: 'escrow.funded',
            entityId: escrow.id,
            entityType: 'EscrowTransaction',
            payload: { amount: grossAmount, walletAppliedAmount, source: 'employer_wallet' },
            processedBy: EscrowService.name,
          },
        });
      }

      return {
        escrow,
        amountToPay,
        walletAppliedAmount,
        platformFee,
        netAmount,
        existingPending: false,
        fundedFromWallet: amountToPay === 0,
      };
    });

    const { escrow, amountToPay, walletAppliedAmount, existingPending, fundedFromWallet } = funding;

    if (existingPending) {
      const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
      const checkoutUrl =
        amountToPay > 0 ? `${frontendUrl}/freelance/pay?escrow=${escrow.id}` : null;
      this.logger.debug(`Escrow ${escrow.id} is already pending; returning existing funding state`);
      return {
        escrowId: escrow.id,
        checkoutUrl,
        grossAmount: escrow.grossAmount,
        platformFee: funding.platformFee,
        netAmount: funding.netAmount,
        walletAppliedAmount,
        amountToPay,
      };
    }

    if (walletAppliedAmount > 0 && amountToPay > 0) {
      await this.escrowQueue.add(
        ESCROW_JOBS.UNLOCK_FUNDS,
        { escrowId: escrow.id, clientId, amount: walletAppliedAmount },
        { delay: 24 * 60 * 60 * 1000, jobId: `unlock-funds:${escrow.id}` },
      );
    }

    if (fundedFromWallet) {
      this.eventEmitter.emit('payment.escrow.funded', {
        escrowId: escrow.id,
        clientId,
        grossAmount: escrow.grossAmount,
        currency: job.currency,
        source: 'employer_wallet',
        timestamp: new Date().toISOString(),
      });

      return {
        escrowId: escrow.id,
        checkoutUrl: null,
        grossAmount: escrow.grossAmount,
        platformFee: funding.platformFee,
        netAmount: funding.netAmount,
        walletAppliedAmount,
        amountToPay,
      };
    }

    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    let checkoutUrl = `${frontendUrl}/freelance/pay?escrow=${escrow.id}`;
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
    this.logger.log(
      `Escrow initiated: ${escrow.id} for job ${freelanceJobId} — amountToPay: ETB ${amountToPay}, walletApplied: ETB ${walletAppliedAmount}`,

    this.eventEmitter.emit('payment.escrow.initiated', {
      escrowId: escrow.id,
      clientId,
      grossAmount: escrow.grossAmount,
      currency: job.currency,
      timestamp: new Date().toISOString(),
    });

    return {
      escrowId: escrow.id,
      checkoutUrl,
      grossAmount: escrow.grossAmount,
      platformFee: funding.platformFee,
      netAmount: funding.netAmount,
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
      await tx.eventLog.create({
        data: {
          eventType: 'milestone.approved',
          entityId: milestoneId,
          entityType: 'Milestone',
          payload: {
            milestoneId,
            freelancerId: milestone.contract.freelancerId,
            amount: milestone.amount,
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
    try {
      const contractCurrency = milestone.contract.currency || 'ETB';
      const grossAmountInETB = this.walletSvc.convertCurrency(
        milestone.amount,
        contractCurrency,
        'ETB',
      );
      const platformFee = Math.round(grossAmountInETB * PLATFORM_FEE_PCT);
      const netAmountInETB = grossAmountInETB - platformFee;

      await this.prisma.freelancerWallet.upsert({
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
    } catch (err) {
      this.logger.error(
        `Failed to enqueue auto-release for milestone ${milestoneId}`,
        err instanceof Error ? err.stack : err,
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
