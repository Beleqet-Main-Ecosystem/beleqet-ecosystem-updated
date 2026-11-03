import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES, ESCROW_JOBS } from '../queues/queues.constants';
import { WalletService } from '../wallet/wallet.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfirmMilestoneDto } from './dto/confirm-milestone.dto';
import { BeleqetPayService } from '../beleqet-pay/beleqet-pay.service';

const PLATFORM_FEE_PCT = 0.1;

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly walletSvc: WalletService,
    private readonly paySwitch: BeleqetPayService,
    @InjectQueue(QUEUE_NAMES.ESCROW) private readonly escrowQueue: Queue,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async initiate(clientId: string, freelanceJobId: string) {
    const job = await this.prisma.freelanceJob.findFirst({
      where: { id: freelanceJobId, clientId },
      include: { client: true, contract: true },
    });
    if (!job) throw new NotFoundException('Gig not found');

    // ── Idempotency guard ──────────────────────────────────────────────────────
    const existingEscrow = await this.prisma.escrowTransaction.findUnique({
      where: { freelanceJobId },
    });
    if (existingEscrow) {
      if (existingEscrow.status !== 'PENDING') {
        throw new BadRequestException('Escrow is already funded or active for this gig.');
      }
      // An unpaid escrow: start a fresh checkout so an abandoned payment can be finished. If it was
      // set up from the budget before a bid was accepted, charge the agreed amount instead.
      let { grossAmount, platformFee, netAmount } = existingEscrow;
      if (job.contract && job.contract.agreedAmount !== grossAmount) {
        grossAmount = job.contract.agreedAmount;
        platformFee = Math.round(grossAmount * PLATFORM_FEE_PCT);
        netAmount = grossAmount - platformFee;
        await this.prisma.escrowTransaction.update({
          where: { id: existingEscrow.id },
          data: { grossAmount, platformFee, netAmount },
        });
      }
      const walletAppliedAmount = existingEscrow.walletAppliedAmount ?? 0;
      const amountToPay = Math.max(0, grossAmount - walletAppliedAmount);
      const checkoutUrl = await this.startCheckout(existingEscrow.id, job, amountToPay);
      return {
        escrowId: existingEscrow.id,
        checkoutUrl,
        grossAmount,
        platformFee,
        netAmount,
        walletAppliedAmount,
        amountToPay,
      };
    }

    const grossAmount = job.contract ? job.contract.agreedAmount : job.budgetMax;
    if (!job.contract) {
      this.logger.warn(
        `Escrow initiated without a contract for job ${freelanceJobId} — using budgetMax.`,
      );
    }

    // ── Wallet deduction (unchanged) ──────────────────────────────────────────
    const employerWallet = await this.prisma.employerWallet.findUnique({
      where: { userId: clientId },
    });
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
      }

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
    });

    // ── Wallet-fully-funded path ───────────────────────────────────────────────
    if (amountToPay === 0) {
      if (walletAppliedAmount > 0) {
        await this.prisma.employerWalletTransaction.create({
          data: {
            walletId: employerWallet!.id,
            type: 'DEBIT_WITHDRAWAL',
            amount: walletAppliedAmount,
            note: `Fully funded escrow for job ${freelanceJobId}`,
            escrowId: escrow.id,
          },
        });

        await this.prisma.employerWallet.update({
          where: { userId: clientId },
          data: { lockedBalance: { decrement: walletAppliedAmount } },
        });
      }

      await this.prisma.freelanceJob.update({
        where: { id: freelanceJobId },
        data: { status: 'FUNDED' },
      });

      await this.prisma.eventLog.create({
        data: {
          eventType: 'escrow.funded',
          entityId: escrow.id,
          entityType: 'EscrowTransaction',
          payload: { escrowId: escrow.id, source: 'employer_wallet', clientId },
          processedBy: EscrowService.name,
        },
      });

      this.eventEmitter.emit('payment.escrow.funded', {
        escrowId: escrow.id,
        clientId,
        source: 'employer_wallet',
        grossAmount,
        currency: job.currency,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(
        `Escrow ${escrow.id} fully funded via wallet for job ${freelanceJobId} — ETB ${grossAmount}`,
      );

      return {
        escrowId: escrow.id,
        checkoutUrl: null,
        grossAmount,
        platformFee,
        netAmount,
        walletAppliedAmount,
        amountToPay: 0,
      };
    }

    // ── Queue 24-hour wallet-unlock in case payment is abandoned ─────────────
    if (walletAppliedAmount > 0) {
      await this.escrowQueue.add(
        ESCROW_JOBS.UNLOCK_FUNDS,
        { escrowId: escrow.id, clientId, amount: walletAppliedAmount },
        { delay: 24 * 60 * 60 * 1000 },
      );
    }

    const checkoutUrl = await this.startCheckout(escrow.id, job, amountToPay);

    this.eventEmitter.emit('payment.escrow.initiated', {
      escrowId: escrow.id,
      clientId,
      grossAmount,
      currency: job.currency,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `Escrow initiated: ${escrow.id} for job ${freelanceJobId} — amountToPay: ETB ${amountToPay}, walletApplied: ETB ${walletAppliedAmount}`,
    );

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
   * Opens a Beleqet Pay checkout for what is left to pay. The contract page shows live escrow
   * status, so payers return there (or to the gig page when funding happens before a bid is
   * accepted). If the checkout can't be created, that page is returned instead.
   */
  private async startCheckout(
    escrowId: string,
    job: {
      id: string;
      currency: string | null;
      client: { email: string };
      contract: { id: string } | null;
    },
    amountToPay: number,
  ): Promise<string> {
    const returnUrl = job.contract
      ? `${this.config.get('FRONTEND_URL')}/freelance/contracts/${job.contract.id}`
      : `${this.config.get('FRONTEND_URL')}/freelance/${job.id}`;
    try {
      const session = await this.paySwitch.createCheckoutSession({
        amount: amountToPay.toString(),
        currency: job.currency ?? 'ETB',
        customerEmail: job.client.email,
        preferredProvider: 'CHAPA',
        successRedirectUrl: this.config.get<string>('CHAPA_RETURN_URL') ?? returnUrl,
        externalRef: escrowId,
      });
      // Persist the Beleqet Pay txRef so the processor can verify it later
      await this.prisma.escrowTransaction.update({
        where: { id: escrowId },
        data: { gatewayRef: session.txRef },
      });
      this.logger.log(
        `[beleqet-pay] Checkout session created: txRef=${session.txRef} provider=${session.provider}`,
      );
      return session.checkoutUrl;
    } catch (err) {
      // Non-fatal: user can still pay via manual-payment module
      this.logger.error(
        `[beleqet-pay] Failed to create checkout session — falling back to manual URL: ${(err as Error).message}`,
      );
      return returnUrl;
    }
  }

  async handleWebhook(payload: { reference: string; status: string; [k: string]: unknown }) {
    await this.escrowQueue.add(ESCROW_JOBS.PROCESS_WEBHOOK, payload);
  }

  async releaseMilestone(milestoneId: string, clientId: string) {
    const milestone = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, contract: { clientId } },
      include: { contract: { include: { freelanceJob: { include: { escrowTx: true } } } } },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');

    if (milestone.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted milestones can be approved and released.');
    }

    const escrow = milestone.contract.freelanceJob?.escrowTx;
    if (!escrow || escrow.status !== 'FUNDED') {
      throw new BadRequestException('Escrow must be funded before releasing a milestone.');
    }

    const contractCurrency = milestone.contract.currency || 'ETB';
    const grossAmountInETB = this.walletSvc.convertCurrency(
      milestone.amount,
      contractCurrency,
      'ETB',
    );
    const platformFee = Math.round(grossAmountInETB * PLATFORM_FEE_PCT);
    const netAmountInETB = grossAmountInETB - platformFee;

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Conditional update: a concurrent or repeated approval matches zero rows
      // and aborts, so the wallet is credited at most once per milestone.
      const { count } = await tx.milestone.updateMany({
        where: { id: milestoneId, status: 'SUBMITTED' },
        data: { status: 'APPROVED', approvedAt: new Date() },
      });
      if (count === 0) {
        throw new BadRequestException('Milestone has already been approved.');
      }

      const released = await tx.milestone.aggregate({
        where: { contractId: milestone.contractId, status: 'APPROVED' },
        _sum: { amount: true },
      });
      if ((released._sum.amount ?? 0) > escrow.grossAmount) {
        throw new BadRequestException('Released milestones would exceed the funded escrow amount.');
      }

      await tx.freelancerWallet.upsert({
        where: { userId: milestone.contract.freelancerId },
        update: { pendingBalance: { increment: netAmountInETB } },
        create: {
          userId: milestone.contract.freelancerId,
          pendingBalance: netAmountInETB,
          availableBalance: 0,
        },
      });

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
          processedBy: EscrowService.name,
        },
      });
    });

    try {
      const releaseAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      await this.escrowQueue.add(
        ESCROW_JOBS.AUTO_RELEASE,
        {
          milestoneId,
          freelancerId: milestone.contract.freelancerId,
          amount: netAmountInETB,
          releaseAt,
        },
        { delay: releaseAt.getTime() - Date.now(), jobId: `auto-release-${milestoneId}` },
      );
    } catch (err) {
      this.logger.error(
        `Failed to enqueue auto-release for milestone ${milestoneId}`,
        err instanceof Error ? err.stack : err,
      );
    }

    this.logger.log(`Milestone ${milestoneId} approved — payout queued`);
    return { success: true };
  }

  /**
   * Dual-confirmation milestone release: both the employer and the freelancer
   * must confirm before funds move.
   */
  async confirmMilestone(milestoneId: string, actorId: string, _body?: ConfirmMilestoneDto) {
    const milestone = await this.prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT id FROM "milestones" WHERE id = ${milestoneId} FOR UPDATE`;
      return tx.milestone.findFirst({
        where: { id: milestoneId },
        include: {
          contract: {
            include: { freelanceJob: { include: { escrowTx: true } } },
          },
        },
      });
    });

    if (!milestone) throw new NotFoundException('Milestone not found');

    const contract = milestone.contract;
    const isEmployer = actorId === contract.clientId;
    const isFreelancer = actorId === contract.freelancerId;

    if (!isEmployer && !isFreelancer) {
      throw new NotFoundException('Milestone not found');
    }

    if (
      milestone.status === 'APPROVED' &&
      milestone.employerApprovedAt &&
      milestone.freelancerApprovedAt
    ) {
      const grossAmountInETB = this.walletSvc.convertCurrency(
        milestone.amount,
        contract.currency || 'ETB',
        'ETB',
      );
      const netAmountInETB = Math.round(grossAmountInETB * (1 - PLATFORM_FEE_PCT));
      const releaseAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      await this.escrowQueue.add(
        ESCROW_JOBS.AUTO_RELEASE,
        { milestoneId, freelancerId: contract.freelancerId, amount: netAmountInETB, releaseAt },
        { delay: releaseAt.getTime() - Date.now(), jobId: `auto-release-${milestoneId}` },
      );
      return { success: true, released: true, alreadyReleased: true };
    }

    const updateData: Record<string, Date> = {};
    if (isEmployer) updateData.employerApprovedAt = new Date();
    else updateData.freelancerApprovedAt = new Date();

    const updatedEmployerTs = isEmployer
      ? updateData.employerApprovedAt
      : milestone.employerApprovedAt;
    const updatedFreelancerTs = isFreelancer
      ? updateData.freelancerApprovedAt
      : milestone.freelancerApprovedAt;
    const bothConfirmed = Boolean(updatedEmployerTs && updatedFreelancerTs);

    let alreadyReleased = false;
    let netAmountInETB = 0;
    const releaseAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT id FROM "milestones" WHERE id = ${milestoneId} FOR UPDATE`;
      await tx.milestone.update({ where: { id: milestoneId }, data: updateData });

      if (!bothConfirmed) return;

      const grossAmountInETB = this.walletSvc.convertCurrency(
        milestone.amount,
        contract.currency || 'ETB',
        'ETB',
      );
      netAmountInETB = Math.round(grossAmountInETB * (1 - PLATFORM_FEE_PCT));

      const updated = await tx.milestone.updateMany({
        where: { id: milestoneId, status: { not: 'APPROVED' } },
        data: { status: 'APPROVED', approvedAt: new Date() },
      });

      if (updated.count === 0) {
        alreadyReleased = true;
        return;
      }

      const freelancerWallet = await tx.freelancerWallet.upsert({
        where: { userId: contract.freelancerId },
        update: { pendingBalance: { increment: netAmountInETB } },
        create: {
          userId: contract.freelancerId,
          pendingBalance: netAmountInETB,
          availableBalance: 0,
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: freelancerWallet.id,
          type: 'CREDIT_PENDING',
          amount: netAmountInETB,
          milestoneId,
        },
      });

      await tx.eventLog.create({
        data: {
          eventType: 'milestone.dual_confirmed',
          entityId: milestoneId,
          entityType: 'Milestone',
          payload: { milestoneId, freelancerId: contract.freelancerId, amount: netAmountInETB },
          processedBy: EscrowService.name,
        },
      });
    });

    if (bothConfirmed && netAmountInETB > 0) {
      await this.escrowQueue.add(
        ESCROW_JOBS.AUTO_RELEASE,
        { milestoneId, freelancerId: contract.freelancerId, amount: netAmountInETB, releaseAt },
        { delay: releaseAt.getTime() - Date.now(), jobId: `auto-release-${milestoneId}` },
      );
    }

    if (!bothConfirmed) {
      return {
        success: true,
        released: false,
        waitingFor: !updatedEmployerTs ? 'EMPLOYER' : 'FREELANCER',
      };
    }

    return { success: true, released: true, ...(alreadyReleased ? { alreadyReleased: true } : {}) };
  }
}
