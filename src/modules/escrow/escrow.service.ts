import {
  Injectable,
  NotFoundException,
  Logger,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES, ESCROW_JOBS, NOTIFICATION_JOBS } from '../queues/queues.constants';
import { WalletService } from '../wallet/wallet.service';
import { randomUUID } from 'crypto';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly config: ConfigService,
    private readonly walletSvc: WalletService,
    @InjectQueue(QUEUE_NAMES.ESCROW) private readonly escrowQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notificationsQueue: Queue,
  ) {}

  /** Initiate escrow — returns Chapa/Telebirr payment link */
  async initiate(clientId: string, freelanceJobId: string, lang?: string) {
    const job = await this.prisma.freelanceJob.findFirst({
      where: { id: freelanceJobId, clientId },
      include: { client: true, contract: true },
    });
    if (!job)
      throw new NotFoundException(
        this.i18n.t('escrow.gigNotFound', { defaultValue: 'Gig not found' }),
      );

    if (!job.contract) {
      throw new BadRequestException(
        this.i18n.t('escrow.noContractForInitiate', {
          defaultValue:
            'Cannot initiate escrow: no accepted bid/contract exists for this gig. Accept a bid first.',
        }),
      );
    }
    const grossAmount = job.contract.agreedAmount;
    const currency = job.contract.currency;

    const feePct = this.config.get<number>('PLATFORM_FEE_PCT', 0.1);
    const platformFee = Math.round(grossAmount * feePct);
    const netAmount = grossAmount - platformFee;

    const txRef = `tx-${randomUUID()}`;

    let escrow: { id: string; grossAmount: number; walletAppliedAmount: number };
    let walletAppliedAmount = 0;
    let amountToPay = grossAmount;

    try {
      escrow = await this.prisma.$transaction(async (tx) => {
        const employerWallet = await tx.$queryRaw<{ id: string; balance: number }[]>`
          SELECT id, balance FROM employer_wallets WHERE "userId" = ${clientId} FOR UPDATE
        `;
        const availableBalance = employerWallet[0]?.balance || 0;
        const employerWalletId = employerWallet[0]?.id || null;

        if (availableBalance > 0) {
          if (availableBalance >= grossAmount) {
            amountToPay = 0;
            walletAppliedAmount = grossAmount;
          } else {
            amountToPay = grossAmount - availableBalance;
            walletAppliedAmount = availableBalance;
          }
        }

        const existingEscrow = await tx.escrowTransaction.findUnique({ where: { freelanceJobId } });
        if (existingEscrow && !['PENDING', 'REFUNDED'].includes(existingEscrow.status)) {
          throw new BadRequestException(
            this.i18n.t('escrow.escrowAlreadyExists', {
              args: { status: existingEscrow.status },
              defaultValue: 'Escrow already exists in {status} status — cannot re-initiate',
            }),
          );
        }

        const created = existingEscrow
          ? await tx.escrowTransaction.update({
              where: { freelanceJobId },
              data: {
                grossAmount,
                platformFee,
                netAmount,
                walletAppliedAmount,
                status: amountToPay === 0 ? 'FUNDED' : 'PENDING',
                gatewayRef: txRef,
                currency,
              },
            })
          : await tx.escrowTransaction.create({
              data: {
                freelanceJobId,
                grossAmount,
                platformFee,
                netAmount,
                walletAppliedAmount,
                status: amountToPay === 0 ? 'FUNDED' : 'PENDING',
                gatewayRef: txRef,
                currency,
              },
            });

        if (walletAppliedAmount > 0 && employerWalletId) {
          await tx.employerWallet.update({
            where: { id: employerWalletId },
            data: {
              balance: { decrement: walletAppliedAmount },
              lockedBalance: { increment: walletAppliedAmount },
            },
          });
        }

        return created;
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === 'P2002' || err.code === 'P2003')
      ) {
        throw new BadRequestException(
          this.i18n.t('escrow.insufficientWalletBalance', {
            defaultValue:
              'Insufficient wallet balance — please top up or reduce the escrow amount.',
          }),
        );
      }
      throw err;
    }

    if (walletAppliedAmount > 0 && amountToPay > 0) {
      await this.escrowQueue.add(
        ESCROW_JOBS.UNLOCK_FUNDS,
        {
          escrowId: escrow.id,
          clientId,
          amount: walletAppliedAmount,
        },
        { delay: 24 * 60 * 60 * 1000 },
      );
    }

    if (amountToPay === 0) {
      await this.prisma.$transaction(async (tx) => {
        const wallet = await tx.employerWallet.findUnique({ where: { userId: clientId } });
        if (!wallet)
          throw new NotFoundException(
            this.i18n.t('escrow.employerWalletNotFound', {
              defaultValue: 'Employer wallet not found',
            }),
          );

        await tx.employerWalletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'DEBIT_WITHDRAWAL',
            amount: walletAppliedAmount,
            note: `Fully funded escrow for job ${freelanceJobId}`,
            escrowId: escrow.id,
          },
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
            payload: { amount: escrow.grossAmount },
            processedBy: 'EscrowService',
          },
        });
      });

      const fundedBody = this.i18n.t('notifications.escrow.notification.fundedBody', {
        lang,
        args: { currency, amount: grossAmount.toLocaleString() },
        defaultValue:
          '{currency} {amount} has been secured. Freelancers can now bid on your project.',
      });
      await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
        userId: clientId,
        type: 'escrow.funded',
        title: this.i18n.t('notifications.escrow.notification.fundedTitle', {
          lang,
          defaultValue: 'Escrow funded — your gig is now live!',
        }),
        body: fundedBody,
        metadata: { escrowId: escrow.id, freelanceJobId },
      });

      this.logger.log(
        `Escrow initiated (fully funded via wallet): ${escrow.id} for job ${freelanceJobId} — amount: ${currency} ${grossAmount}`,
      );
      return {
        escrowId: escrow.id,
        checkoutUrl: null,
        grossAmount,
        platformFee,
        netAmount,
        walletAppliedAmount,
      };
    }

    let checkoutUrl = `${this.config.get('FRONTEND_URL')}/freelance/pay?escrow=${escrow.id}`;

    const chapaSecret = this.config.get<string>('CHAPA_SECRET_KEY');
    if (!chapaSecret) {
      this.logger.error('CHAPA_SECRET_KEY not configured');
      throw new InternalServerErrorException(
        this.i18n.t('escrow.paymentProviderNotConfigured', {
          defaultValue: 'Payment provider not configured',
        }),
      );
    }

    try {
      const response = await fetch('https://api.chapa.co/v1/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${chapaSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountToPay.toString(),
          currency: currency,
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
          },
        }),
      });

      const data = await response.json();
      if (data.status !== 'success') {
        this.logger.error(`Chapa initialization failed: ${JSON.stringify(data)}`);
        throw new InternalServerErrorException(
          this.i18n.t('escrow.paymentProviderError', {
            args: { message: data.message || 'Unknown error' },
            defaultValue: 'Payment provider error: {message}',
          }),
        );
      }
      checkoutUrl = data.data.checkout_url;
    } catch (err) {
      this.logger.error(`Failed to reach Chapa: ${(err as Error).message}`);
      throw err instanceof InternalServerErrorException
        ? err
        : new InternalServerErrorException(
            this.i18n.t('escrow.couldNotReachPaymentProvider', {
              defaultValue: 'Could not reach payment provider',
            }),
          );
    }

    this.logger.log(
      `Escrow initiated: ${escrow.id} for job ${freelanceJobId} — amountToPay: ${currency} ${amountToPay}, walletApplied: ${currency} ${walletAppliedAmount}`,
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

  /** Called by Chapa webhook — verifies signature, marks escrow funded */
  async handleWebhook(payload: { reference: string; status: string; [k: string]: unknown }) {
    await this.escrowQueue.add(ESCROW_JOBS.PROCESS_WEBHOOK, payload);
  }

  /** Called when employer approves milestone */
  async releaseMilestone(milestoneId: string, clientId: string) {
    const milestoneOuter = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, contract: { clientId } },
      include: { contract: { include: { freelanceJob: { include: { escrowTx: true } } } } },
    });
    if (!milestoneOuter)
      throw new NotFoundException(
        this.i18n.t('escrow.milestoneNotFound', { defaultValue: 'Milestone not found' }),
      );
    if (milestoneOuter.contract.status !== 'ACTIVE') {
      throw new BadRequestException(
        this.i18n.t('escrow.milestoneContractNotActive', {
          args: { status: milestoneOuter.contract.status },
          defaultValue: 'Cannot approve milestone: contract is {status}, must be ACTIVE',
        }),
      );
    }

    const escrowTx = milestoneOuter.contract.freelanceJob.escrowTx;
    if (!escrowTx || escrowTx.status !== 'FUNDED') {
      throw new BadRequestException(
        this.i18n.t('escrow.escrowNotFundedForRelease', {
          args: { status: escrowTx?.status || 'none' },
          defaultValue: 'Cannot release milestone: escrow is not funded (status: {status})',
        }),
      );
    }

    const freelancerId = milestoneOuter.contract.freelancerId;
    const creditAmount = milestoneOuter.amount;

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const locked = await tx.$queryRaw<{ status: string }[]>`
        SELECT status FROM milestones WHERE id = ${milestoneId} FOR UPDATE
      `;
      const currentStatus = locked[0]?.status;
      if (currentStatus !== 'SUBMITTED') {
        throw new BadRequestException(
          this.i18n.t('escrow.milestoneNotSubmitted', {
            args: { status: currentStatus },
            defaultValue:
              'Milestone must be in SUBMITTED status to approve. Current status: {status}',
          }),
        );
      }

      await tx.milestone.update({
        where: { id: milestoneId },
        data: { status: 'APPROVED', approvedAt: new Date() },
      });

      await tx.eventLog.create({
        data: {
          eventType: 'milestone.approved',
          entityId: milestoneId,
          entityType: 'Milestone',
          payload: {
            milestoneId,
            freelancerId: milestoneOuter.contract.freelancerId,
            amount: milestoneOuter.amount,
            currency: (milestoneOuter as any).currency || 'ETB',
          },
          processedBy: EscrowService.name,
        },
      });

      await tx.freelancerWallet.upsert({
        where: { userId: freelancerId },
        update: { pendingBalance: { increment: creditAmount } },
        create: { userId: freelancerId, pendingBalance: creditAmount, availableBalance: 0 },
      });
    });

    await this.escrowQueue.add(
      ESCROW_JOBS.AUTO_RELEASE,
      {
        milestoneId,
        freelancerId,
        amount: creditAmount,
        releaseAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
      { jobId: `auto-release-${milestoneId}` },
    );

    this.logger.log(`Milestone ${milestoneId} approved — payout queued`);
    return { success: true };
  }

  async requestRevision(milestoneId: string, clientId: string, reason: string, lang?: string) {
    const milestone = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, contract: { clientId } },
      include: { contract: true },
    });
    if (!milestone)
      throw new NotFoundException(
        this.i18n.t('escrow.milestoneNotFound', { defaultValue: 'Milestone not found' }),
      );

    if (milestone.status !== 'SUBMITTED') {
      throw new BadRequestException(
        this.i18n.t('escrow.milestoneNotSubmittedForRevision', {
          args: { status: milestone.status },
          defaultValue: 'Cannot request revision: milestone is {status}, must be SUBMITTED',
        }),
      );
    }

    if (milestone.contract.status !== 'ACTIVE') {
      throw new BadRequestException(
        this.i18n.t('escrow.milestoneContractNotActiveForRevision', {
          args: { status: milestone.contract.status },
          defaultValue: 'Cannot request revision: contract is {status}, must be ACTIVE',
        }),
      );
    }

    const updated = await this.prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        status: 'REVISION_REQUESTED',
        revisionNotes: reason,
        revisionCount: { increment: 1 },
      },
    });

    await this.prisma.eventLog.create({
      data: {
        eventType: 'milestone.revision_requested',
        entityId: milestoneId,
        entityType: 'Milestone',
        payload: { reason, revisionCount: updated.revisionCount, contractId: milestone.contractId },
        processedBy: 'EscrowService',
      },
    });

    await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
      userId: milestone.contract.freelancerId,
      type: 'milestone.revision_requested',
      title: this.i18n.t('notifications.escrow.notification.revisionRequestedTitle', {
        lang,
        defaultValue: 'Revision Requested',
      }),
      body: this.i18n.t('notifications.escrow.notification.revisionRequestedBody', {
        lang,
        args: { milestoneTitle: milestone.title },
        defaultValue:
          'Your client has requested changes on "{milestoneTitle}". Please review their feedback and resubmit.',
      }),
      metadata: { milestoneId, contractId: milestone.contractId, reason },
    });

    this.logger.log(
      `Revision requested on milestone ${milestoneId} (revision #${updated.revisionCount})`,
    );
    return { success: true, revisionCount: updated.revisionCount };
  }

  /** Cancel escrow and refund client — only if work not started */
  async cancelEscrow(escrowId: string, clientId: string, lang?: string) {
    const escrow = await this.prisma.escrowTransaction.findFirst({
      where: { id: escrowId, freelanceJob: { clientId } },
      include: {
        freelanceJob: {
          include: {
            contract: { include: { milestones: true } },
            client: true,
          },
        },
      },
    });
    if (!escrow)
      throw new NotFoundException(
        this.i18n.t('escrow.escrowNotFound', { defaultValue: 'Escrow not found' }),
      );

    const cannotCancel = ['IN_REVIEW', 'RELEASED', 'REFUNDED', 'DISPUTED'];
    if (cannotCancel.includes(escrow.status)) {
      throw new BadRequestException(
        this.i18n.t('escrow.cannotCancelInStatus', {
          args: { status: escrow.status },
          defaultValue: 'Cannot cancel escrow in {status} status',
        }),
      );
    }

    const hasActiveMilestone = escrow.freelanceJob.contract?.milestones?.some((m) =>
      ['SUBMITTED', 'APPROVED', 'IN_PROGRESS'].includes(m.status),
    );
    if (hasActiveMilestone) {
      throw new BadRequestException(
        this.i18n.t('escrow.cannotCancelWorkStarted', {
          defaultValue: 'Cannot cancel: freelancer has started work',
        }),
      );
    }

    const originalStatus = escrow.status;

    await this.prisma.$transaction(async (tx) => {
      await tx.escrowTransaction.update({
        where: { id: escrowId },
        data: {
          status: 'REFUNDED',
          gatewayResponse: {
            ...(escrow.gatewayResponse as object),
            cancelledAt: new Date(),
            cancelledBy: clientId,
          },
        },
      });

      if (escrow.walletAppliedAmount > 0) {
        const wallet = await tx.employerWallet.findUnique({ where: { userId: clientId } });
        if (wallet) {
          const fundsStillLocked = originalStatus === 'PENDING';
          await tx.employerWallet.update({
            where: { id: wallet.id },
            data: {
              ...(fundsStillLocked
                ? { lockedBalance: { decrement: escrow.walletAppliedAmount } }
                : {}),
              balance: { increment: escrow.walletAppliedAmount },
            },
          });
          await tx.employerWalletTransaction.create({
            data: {
              walletId: wallet.id,
              type: 'CREDIT_AVAILABLE',
              amount: escrow.walletAppliedAmount,
              note: `Refund for cancelled escrow ${escrowId}`,
              escrowId,
            },
          });
        }
      }

      await tx.freelanceJob.update({
        where: { id: escrow.freelanceJobId },
        data: { status: 'DRAFT' },
      });

      await tx.eventLog.create({
        data: {
          eventType: 'escrow.cancelled',
          entityId: escrowId,
          entityType: 'EscrowTransaction',
          payload: { amount: escrow.grossAmount, refundedAmount: escrow.walletAppliedAmount },
          processedBy: 'EscrowService',
        },
      });
    });

    const amountToPay = escrow.grossAmount - escrow.walletAppliedAmount;
    if (amountToPay > 0 && escrow.gatewayRef && originalStatus === 'FUNDED') {
      await this.escrowQueue.add(ESCROW_JOBS.CANCEL_CHAPA_PAYMENT, {
        escrowId,
        gatewayRef: escrow.gatewayRef,
        clientId,
      });
      this.logger.log(
        `Queued CANCEL_CHAPA_PAYMENT for escrow ${escrowId} — gatewayRef=${escrow.gatewayRef}, amount=${amountToPay}`,
      );
    }

    const chapaSuffix =
      amountToPay > 0
        ? this.i18n.t('notifications.escrow.notification.chapaSuffix', {
            lang,
            args: { currency: escrow.currency, chapaAmount: amountToPay.toLocaleString() },
            defaultValue: ', {currency} {chapaAmount} Chapa refund processing',
          })
        : '';
    await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
      userId: clientId,
      type: 'escrow.cancelled',
      title: this.i18n.t('notifications.escrow.notification.cancelledTitle', {
        lang,
        defaultValue: 'Escrow cancelled — funds refunded',
      }),
      body: `${escrow.currency} ${escrow.walletAppliedAmount.toLocaleString()} refunded to wallet${chapaSuffix}.`,
      metadata: {
        escrowId,
        refundedAmount: escrow.walletAppliedAmount,
        chapaRefundAmount: amountToPay,
      },
    });

    this.logger.log(
      `Escrow cancelled: ${escrowId} by client ${clientId} — wallet refunded ${escrow.currency} ${escrow.walletAppliedAmount}, Chapa refund pending ${escrow.currency} ${amountToPay}`,
    );
    return {
      success: true,
      message: 'Escrow cancelled and funds refunded',
      refundedAmount: escrow.walletAppliedAmount,
      chapaRefundAmount: amountToPay,
      refundedTo: 'wallet',
    };
  }

  /** Summary stats for an employer's escrows */
  async getEmployerEscrowSummary(clientId: string) {
    const rows = (await this.prisma.$queryRaw`
      SELECT
        COUNT(*)::int AS "totalEscrows",
        COUNT(*) FILTER (WHERE e.status IN ('PENDING', 'FUNDED'))::int AS "activeEscrows",
        COUNT(*) FILTER (WHERE e.status = 'IN_REVIEW')::int AS "inReview",
        COUNT(*) FILTER (WHERE e.status = 'RELEASED')::int AS "released",
        COUNT(*) FILTER (WHERE e.status = 'REFUNDED')::int AS "refunded",
        COUNT(*) FILTER (WHERE e.status = 'DISPUTED')::int AS "disputed",
        COALESCE(SUM(e."grossAmount") FILTER (WHERE e.status = 'RELEASED'), 0)::int AS "totalSpent",
        COALESCE(SUM(e."grossAmount") FILTER (WHERE e.status IN ('PENDING', 'FUNDED')), 0)::int AS "committedAmount"
      FROM escrow_transactions e
      JOIN freelance_jobs fj ON fj.id = e."freelanceJobId"
      WHERE fj."clientId" = ${clientId}
    `) as unknown as any[];

    const r = rows[0] || {};
    return {
      totalEscrows: r.totalEscrows || 0,
      activeEscrows: r.activeEscrows || 0,
      inReview: r.inReview || 0,
      released: r.released || 0,
      refunded: r.refunded || 0,
      disputed: r.disputed || 0,
      totalSpent: r.totalSpent || 0,
      committedAmount: r.committedAmount || 0,
    };
  }

  /** Summary stats for a freelancer's escrows */
  async getFreelancerEscrowSummary(freelancerId: string) {
    const rows = (await this.prisma.$queryRaw`
      SELECT
        COUNT(*)::int AS "totalEscrows",
        COUNT(*) FILTER (WHERE e.status IN ('PENDING', 'FUNDED'))::int AS "activeEscrows",
        COUNT(*) FILTER (WHERE e.status = 'IN_REVIEW')::int AS "inReview",
        COUNT(*) FILTER (WHERE e.status = 'RELEASED')::int AS "released",
        COUNT(*) FILTER (WHERE e.status = 'REFUNDED')::int AS "refunded",
        COUNT(*) FILTER (WHERE e.status = 'DISPUTED')::int AS "disputed",
        COALESCE(SUM(e."netAmount") FILTER (WHERE e.status = 'RELEASED'), 0)::int AS "totalEarned",
        COALESCE(SUM(e."netAmount") FILTER (WHERE e.status IN ('PENDING', 'FUNDED')), 0)::int AS "pendingAmount"
      FROM escrow_transactions e
      JOIN freelance_jobs fj ON fj.id = e."freelanceJobId"
      JOIN contracts ct ON ct."freelanceJobId" = fj.id
      WHERE ct."freelancerId" = ${freelancerId}
    `) as unknown as any[];

    const r = rows[0] || {};
    return {
      totalEscrows: r.totalEscrows || 0,
      activeEscrows: r.activeEscrows || 0,
      inReview: r.inReview || 0,
      released: r.released || 0,
      refunded: r.refunded || 0,
      disputed: r.disputed || 0,
      totalEarned: r.totalEarned || 0,
      pendingAmount: r.pendingAmount || 0,
    };
  }

  /** List escrows belonging to an employer (client), paginated */
  async listByClient(clientId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.$queryRaw`
        SELECT
          e.id,
          e."grossAmount",
          e."platformFee",
          e."netAmount",
          e.currency,
          e.status,
          e."createdAt",
          fj.title AS "jobTitle",
          fj.id AS "freelanceJobId",
          CONCAT(fl."firstName", ' ', fl."lastName") AS "freelancerName",
          fl.id AS "freelancerId",
          ct.id AS "contractId"
        FROM escrow_transactions e
        JOIN freelance_jobs fj ON fj.id = e."freelanceJobId"
        LEFT JOIN contracts ct ON ct."freelanceJobId" = fj.id
        LEFT JOIN users fl ON fl.id = ct."freelancerId"
        WHERE fj."clientId" = ${clientId}
        ORDER BY e."createdAt" DESC
        LIMIT ${limit} OFFSET ${skip}
      ` as unknown as any[],
      this.prisma.$queryRaw`
        SELECT COUNT(*)::int AS count
        FROM escrow_transactions e
        JOIN freelance_jobs fj ON fj.id = e."freelanceJobId"
        WHERE fj."clientId" = ${clientId}
      ` as unknown as any[],
    ]);

    return {
      items: items.map((r: any) => ({
        id: r.id,
        grossAmount: r.grossAmount,
        platformFee: r.platformFee,
        netAmount: r.netAmount,
        currency: r.currency,
        status: r.status,
        createdAt: r.createdAt,
        jobTitle: r.jobTitle,
        freelanceJobId: r.freelanceJobId,
        freelancerName: r.freelancerName || 'Unassigned',
        freelancerId: r.freelancerId || null,
        contractId: r.contractId || null,
      })),
      total: total[0]?.count || 0,
      page,
      totalPages: Math.ceil((total[0]?.count || 0) / limit),
    };
  }

  /** Get a single escrow by ID with milestones, verifying employer ownership */
  async getByIdForClient(escrowId: string, clientId: string) {
    const escrow = await this.prisma.escrowTransaction.findFirst({
      where: { id: escrowId, freelanceJob: { clientId } },
      include: {
        freelanceJob: {
          include: {
            contract: {
              include: {
                milestones: { orderBy: { createdAt: 'asc' } },
                freelancer: { select: { id: true, firstName: true, lastName: true, email: true } },
              },
            },
          },
        },
      },
    });
    if (!escrow)
      throw new NotFoundException(
        this.i18n.t('escrow.escrowNotFound', { defaultValue: 'Escrow not found' }),
      );

    const contract = escrow.freelanceJob.contract;
    const milestones = contract?.milestones || [];
    const freelancer = contract?.freelancer || null;

    return {
      id: escrow.id,
      grossAmount: escrow.grossAmount,
      platformFee: escrow.platformFee,
      netAmount: escrow.netAmount,
      currency: escrow.currency,
      status: escrow.status,
      createdAt: escrow.createdAt,
      jobTitle: escrow.freelanceJob.title,
      freelanceJobId: escrow.freelanceJobId,
      contractId: contract?.id || null,
      contractStatus: contract?.status || null,
      freelancer: freelancer
        ? {
            id: freelancer.id,
            name: `${freelancer.firstName} ${freelancer.lastName}`,
            email: freelancer.email,
          }
        : null,
      milestones: milestones.map((m: any) => ({
        id: m.id,
        title: m.title,
        amount: m.amount,
        status: m.status,
        deadline: m.deadline,
        approvedAt: m.approvedAt,
      })),
    };
  }

  /** List escrows for a freelancer (pagination) */
  async listByFreelancer(freelancerId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.$queryRaw`
        SELECT
          e.id,
          e."grossAmount",
          e."platformFee",
          e."netAmount",
          e.currency,
          e.status,
          e."createdAt",
          fj.title AS "jobTitle",
          fj.id AS "freelanceJobId",
          CONCAT(cl."firstName", ' ', cl."lastName") AS "clientName",
          cl.id AS "clientId",
          ct.id AS "contractId"
        FROM escrow_transactions e
        JOIN freelance_jobs fj ON fj.id = e."freelanceJobId"
        JOIN contracts ct ON ct."freelanceJobId" = fj.id
        JOIN users cl ON cl.id = fj."clientId"
        WHERE ct."freelancerId" = ${freelancerId}
        ORDER BY e."createdAt" DESC
        LIMIT ${limit} OFFSET ${skip}
      ` as unknown as any[],
      this.prisma.$queryRaw`
        SELECT COUNT(*)::int AS count
        FROM escrow_transactions e
        JOIN freelance_jobs fj ON fj.id = e."freelanceJobId"
        JOIN contracts ct ON ct."freelanceJobId" = fj.id
        WHERE ct."freelancerId" = ${freelancerId}
      ` as unknown as any[],
    ]);

    return {
      items: items.map((r: any) => ({
        id: r.id,
        grossAmount: r.grossAmount,
        platformFee: r.platformFee,
        netAmount: r.netAmount,
        currency: r.currency,
        status: r.status,
        createdAt: r.createdAt,
        jobTitle: r.jobTitle,
        freelanceJobId: r.freelanceJobId,
        clientName: r.clientName || 'Unknown',
        clientId: r.clientId || null,
        contractId: r.contractId || null,
      })),
      total: total[0]?.count || 0,
      page,
      totalPages: Math.ceil((total[0]?.count || 0) / limit),
    };
  }

  /** Get a single escrow by ID with milestones, verifying freelancer ownership */
  async getByIdForFreelancer(escrowId: string, freelancerId: string) {
    const escrow = await this.prisma.escrowTransaction.findFirst({
      where: {
        id: escrowId,
        freelanceJob: {
          contract: { freelancerId },
        },
      },
      include: {
        freelanceJob: {
          include: {
            client: { select: { id: true, firstName: true, lastName: true, email: true } },
            contract: {
              include: {
                milestones: { orderBy: { createdAt: 'asc' } },
              },
            },
          },
        },
      },
    });
    if (!escrow)
      throw new NotFoundException(
        this.i18n.t('escrow.escrowNotFound', { defaultValue: 'Escrow not found' }),
      );

    const contract = escrow.freelanceJob.contract;
    const milestones = contract?.milestones || [];
    const client = escrow.freelanceJob.client;

    return {
      id: escrow.id,
      grossAmount: escrow.grossAmount,
      platformFee: escrow.platformFee,
      netAmount: escrow.netAmount,
      currency: escrow.currency,
      status: escrow.status,
      createdAt: escrow.createdAt,
      jobTitle: escrow.freelanceJob.title,
      freelanceJobId: escrow.freelanceJobId,
      contractId: contract?.id || null,
      contractStatus: contract?.status || null,
      client: {
        id: client.id,
        name: `${client.firstName} ${client.lastName}`,
        email: client.email,
      },
      milestones: milestones.map((m: any) => ({
        id: m.id,
        title: m.title,
        amount: m.amount,
        status: m.status,
        deadline: m.deadline,
        approvedAt: m.approvedAt,
      })),
    };
  }

  /** Admin: get any escrow detail (no ownership check) */
  async adminGetEscrowDetail(escrowId: string) {
    const escrow = await this.prisma.escrowTransaction.findUnique({
      where: { id: escrowId },
      include: {
        freelanceJob: {
          include: {
            client: { select: { id: true, firstName: true, lastName: true, email: true } },
            contract: {
              include: {
                milestones: { orderBy: { createdAt: 'asc' } },
                freelancer: { select: { id: true, firstName: true, lastName: true, email: true } },
              },
            },
          },
        },
      },
    });
    if (!escrow)
      throw new NotFoundException(
        this.i18n.t('escrow.escrowNotFound', { defaultValue: 'Escrow not found' }),
      );

    const contract = escrow.freelanceJob.contract;
    const milestones = contract?.milestones || [];

    return {
      id: escrow.id,
      grossAmount: escrow.grossAmount,
      platformFee: escrow.platformFee,
      netAmount: escrow.netAmount,
      currency: escrow.currency,
      status: escrow.status,
      createdAt: escrow.createdAt,
      jobTitle: escrow.freelanceJob.title,
      freelanceJobId: escrow.freelanceJobId,
      contractId: contract?.id || null,
      contractStatus: contract?.status || null,
      client: escrow.freelanceJob.client
        ? {
            id: escrow.freelanceJob.client.id,
            name: `${escrow.freelanceJob.client.firstName} ${escrow.freelanceJob.client.lastName}`,
            email: escrow.freelanceJob.client.email,
          }
        : null,
      freelancer: contract?.freelancer
        ? {
            id: contract.freelancer.id,
            name: `${contract.freelancer.firstName} ${contract.freelancer.lastName}`,
            email: contract.freelancer.email,
          }
        : null,
      milestones: milestones.map((m: any) => ({
        id: m.id,
        title: m.title,
        amount: m.amount,
        status: m.status,
        deadline: m.deadline,
        approvedAt: m.approvedAt,
      })),
    };
  }

  /** Admin: force-release escrow funds to freelancer */
  async adminForceRelease(escrowId: string, adminId: string) {
    const escrow = await this.prisma.escrowTransaction.findUnique({
      where: { id: escrowId },
      include: {
        freelanceJob: {
          include: {
            contract: { include: { milestones: true } },
          },
        },
      },
    });
    if (!escrow)
      throw new NotFoundException(
        this.i18n.t('escrow.escrowNotFound', { defaultValue: 'Escrow not found' }),
      );

    if (!['FUNDED', 'DISPUTED'].includes(escrow.status)) {
      throw new BadRequestException(
        this.i18n.t('escrow.forceReleaseInvalidStatus', {
          args: { status: escrow.status },
          defaultValue:
            'Cannot force-release escrow in {status} status — must be FUNDED or DISPUTED',
        }),
      );
    }

    const contract = escrow.freelanceJob.contract;
    if (!contract) {
      throw new BadRequestException(
        this.i18n.t('escrow.noContractForForceRelease', {
          defaultValue: 'No contract exists for this escrow',
        }),
      );
    }
    const freelancerId = contract.freelancerId;

    const alreadyReleasedAmount =
      contract.milestones
        ?.filter((m: { status: string }) => m.status === 'APPROVED')
        .reduce((sum: number, m: { amount: number }) => sum + m.amount, 0) || 0;
    const creditAmount = Math.max(0, escrow.netAmount - alreadyReleasedAmount);

    if (creditAmount <= 0) {
      throw new BadRequestException(
        this.i18n.t('escrow.allFundsAlreadyReleased', {
          defaultValue: 'All escrow funds have already been released via milestone approvals',
        }),
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.escrowTransaction.update({
        where: { id: escrowId },
        data: { status: 'RELEASED', releasedAt: new Date() },
      });

      await tx.freelancerWallet.upsert({
        where: { userId: freelancerId },
        update: { pendingBalance: { increment: creditAmount } },
        create: { userId: freelancerId, pendingBalance: creditAmount, availableBalance: 0 },
      });

      await tx.freelanceJob.update({
        where: { id: escrow.freelanceJobId },
        data: { status: 'COMPLETED' },
      });

      await tx.eventLog.create({
        data: {
          eventType: 'escrow.admin-force-release',
          entityId: escrowId,
          entityType: 'EscrowTransaction',
          payload: { amount: escrow.netAmount, adminId },
          processedBy: 'EscrowService',
        },
      });
    });

    const autoReleaseDelay = (this.config.get<number>('AUTO_RELEASE_HOURS') ?? 72) * 60 * 60 * 1000;
    await this.escrowQueue.add(
      ESCROW_JOBS.AUTO_RELEASE,
      {
        milestoneId: `admin-force:${escrowId}`,
        freelancerId,
        amount: creditAmount,
        releaseAt: new Date(Date.now() + autoReleaseDelay),
      },
      { jobId: `auto-release:admin:${escrowId}` },
    );

    this.logger.log(
      `Admin force-release: escrow ${escrowId} by admin ${adminId} — auto-release queued for +${autoReleaseDelay / (60 * 60 * 1000)}h`,
    );
    return {
      success: true,
      message: 'Escrow force-released to freelancer',
      autoReleaseQueued: true,
    };
  }

  /** Admin: force-refund escrow funds back to client */
  async adminForceRefund(escrowId: string, adminId: string, lang?: string) {
    const escrow = await this.prisma.escrowTransaction.findUnique({
      where: { id: escrowId },
      include: {
        freelanceJob: {
          include: {
            client: true,
          },
        },
      },
    });
    if (!escrow)
      throw new NotFoundException(
        this.i18n.t('escrow.escrowNotFound', { defaultValue: 'Escrow not found' }),
      );

    if (!['FUNDED', 'DISPUTED'].includes(escrow.status)) {
      throw new BadRequestException(
        this.i18n.t('escrow.forceRefundInvalidStatus', {
          args: { status: escrow.status },
          defaultValue:
            'Cannot force-refund escrow in {status} status — must be FUNDED or DISPUTED',
        }),
      );
    }

    const clientId = escrow.freelanceJob.clientId;

    await this.prisma.$transaction(async (tx) => {
      await tx.escrowTransaction.update({
        where: { id: escrowId },
        data: {
          status: 'REFUNDED',
          gatewayResponse: {
            ...((escrow.gatewayResponse as object) || {}),
            adminRefundAt: new Date(),
            adminRefundBy: adminId,
          },
        },
      });

      if (escrow.walletAppliedAmount > 0) {
        const wallet = await tx.employerWallet.findUnique({ where: { userId: clientId } });
        if (wallet) {
          await tx.employerWallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: escrow.walletAppliedAmount } },
          });
          await tx.employerWalletTransaction.create({
            data: {
              walletId: wallet.id,
              type: 'CREDIT_AVAILABLE',
              amount: escrow.walletAppliedAmount,
              note: `Admin refund for escrow ${escrowId}`,
              escrowId,
            },
          });
        }
      }

      await tx.freelanceJob.update({
        where: { id: escrow.freelanceJobId },
        data: { status: 'DRAFT' },
      });

      await tx.eventLog.create({
        data: {
          eventType: 'escrow.admin-force-refund',
          entityId: escrowId,
          entityType: 'EscrowTransaction',
          payload: {
            amount: escrow.grossAmount,
            refundedAmount: escrow.walletAppliedAmount,
            adminId,
          },
          processedBy: 'EscrowService',
        },
      });
    });

    const amountToPay = escrow.grossAmount - escrow.walletAppliedAmount;
    if (amountToPay > 0 && escrow.gatewayRef) {
      await this.escrowQueue.add(ESCROW_JOBS.CANCEL_CHAPA_PAYMENT, {
        escrowId,
        gatewayRef: escrow.gatewayRef,
        clientId,
      });
      this.logger.log(
        `Queued CANCEL_CHAPA_PAYMENT for admin refund ${escrowId} — gatewayRef=${escrow.gatewayRef}, amount=${amountToPay}`,
      );
    }

    const chapaSuffix =
      amountToPay > 0
        ? this.i18n.t('notifications.escrow.notification.chapaSuffix', {
            lang,
            args: { currency: escrow.currency, chapaAmount: amountToPay.toLocaleString() },
            defaultValue: ', {currency} {chapaAmount} Chapa refund processing',
          })
        : '';
    await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
      userId: clientId,
      type: 'escrow.admin-refund',
      title: this.i18n.t('notifications.escrow.notification.adminRefundedTitle', {
        lang,
        defaultValue: 'Escrow refunded by admin',
      }),
      body: `${escrow.currency} ${escrow.walletAppliedAmount.toLocaleString()} refunded to wallet${chapaSuffix}.`,
      metadata: {
        escrowId,
        adminId,
        refundedAmount: escrow.walletAppliedAmount,
        chapaRefundAmount: amountToPay,
      },
    });

    this.logger.log(`Admin force-refund: escrow ${escrowId} by admin ${adminId}`);
    return { success: true, message: 'Escrow force-refunded to client' };
  }

  /**
   * Complete a contract — callable by either client or freelancer.
   * Guards: contract must be ACTIVE, no milestones in SUBMITTED status.
   * Updates contract → COMPLETED, escrow → RELEASED, job → COMPLETED.
   */
  async completeContract(contractId: string, userId: string, lang?: string) {
    const contract = await this.prisma.contract.findFirst({
      where: {
        id: contractId,
        OR: [{ clientId: userId }, { freelancerId: userId }],
      },
      include: {
        milestones: true,
        freelanceJob: { include: { escrowTx: true } },
      },
    });
    if (!contract)
      throw new NotFoundException(
        this.i18n.t('escrow.contractNotFound', { defaultValue: 'Contract not found' }),
      );

    if (contract.status !== 'ACTIVE') {
      throw new BadRequestException(
        this.i18n.t('escrow.completeContractInvalidStatus', {
          args: { status: contract.status },
          defaultValue: 'Cannot complete contract in {status} status — must be ACTIVE',
        }),
      );
    }

    const submittedCount = contract.milestones.filter((m) => m.status === 'SUBMITTED').length;
    if (submittedCount > 0) {
      throw new BadRequestException(
        this.i18n.t('escrow.completeContractPendingMilestones', {
          args: { count: submittedCount },
          defaultValue:
            'Cannot complete contract: {count} milestone(s) pending review. Approve or request revision first.',
        }),
      );
    }

    const approvedCount = contract.milestones.filter((m) => m.status === 'APPROVED').length;

    await this.prisma.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id: contractId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      if (contract.freelanceJob.escrowTx && contract.freelanceJob.escrowTx.status === 'FUNDED') {
        await tx.escrowTransaction.update({
          where: { id: contract.freelanceJob.escrowTx.id },
          data: { status: 'RELEASED', releasedAt: new Date() },
        });
      }

      await tx.freelanceJob.update({
        where: { id: contract.freelanceJobId },
        data: { status: 'COMPLETED' },
      });

      await tx.eventLog.create({
        data: {
          eventType: 'contract.completed',
          entityId: contractId,
          entityType: 'Contract',
          payload: {
            completedBy: userId,
            totalMilestones: contract.milestones.length,
            approvedMilestones: approvedCount,
          },
          processedBy: 'EscrowService',
        },
      });
    });

    const otherPartyId = contract.clientId === userId ? contract.freelancerId : contract.clientId;
    for (const uid of [userId, otherPartyId]) {
      await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
        userId: uid,
        type: 'contract.completed',
        title: this.i18n.t('notifications.escrow.notification.contractCompletedTitle', {
          lang,
          defaultValue: 'Contract Completed',
        }),
        body:
          uid === userId
            ? this.i18n.t('notifications.escrow.notification.contractCompletedOwnerBody', {
                lang,
                defaultValue: 'You have successfully completed this contract.',
              })
            : this.i18n.t('notifications.escrow.notification.contractCompletedOtherBody', {
                lang,
                defaultValue: 'Your contract has been marked as complete by the other party.',
              }),
        metadata: { contractId },
      });
    }

    this.logger.log(
      `Contract ${contractId} completed by user ${userId} (${approvedCount}/${contract.milestones.length} milestones approved)`,
    );
    return { success: true, message: 'Contract completed successfully' };
  }
}
