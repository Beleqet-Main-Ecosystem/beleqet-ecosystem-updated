import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES, ESCROW_JOBS } from '../queues/queues.constants';
import { WalletService } from '../wallet/wallet.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any

const PLATFORM_FEE_PCT = 0.10;

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly walletSvc: WalletService,
    @InjectQueue(QUEUE_NAMES.ESCROW) private readonly escrowQueue: Queue,
  ) {}

  /** Initiate escrow — returns Chapa/Telebirr payment link */
  async initiate(clientId: string, freelanceJobId: string) {
    const job = await this.prisma.freelanceJob.findFirst({ 
      where: { id: freelanceJobId, clientId },
      include: { client: true, contract: true }
    });
    if (!job) throw new NotFoundException('Gig not found');

    // Use the agreed contract amount if a contract exists, otherwise fall back to budgetMax
    // Best practice: escrow should only be initiated after a bid is accepted and a contract exists
    const grossAmount = job.contract ? job.contract.agreedAmount : job.budgetMax;
    if (!job.contract) {
      this.logger.warn(`Escrow initiated without a contract for job ${freelanceJobId} — using budgetMax. Consider initiating escrow after bid acceptance.`);
    }

    const employerWallet = await this.prisma.employerWallet.findUnique({ where: { userId: clientId } });
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

      await this.prisma.employerWallet.update({
        where: { userId: clientId },
        data: {
          balance: { decrement: walletAppliedAmount },
          lockedBalance: { increment: walletAppliedAmount }
        }
      });
    }

    const platformFee  = Math.round(grossAmount * PLATFORM_FEE_PCT);
    const netAmount    = grossAmount - platformFee;

    const txRef = `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const escrow = await this.prisma.escrowTransaction.upsert({
      where: { freelanceJobId },
      update: { grossAmount, platformFee, netAmount, walletAppliedAmount, status: amountToPay === 0 ? 'FUNDED' : 'PENDING', gatewayRef: txRef },
      create: { freelanceJobId, grossAmount, platformFee, netAmount, walletAppliedAmount, status: amountToPay === 0 ? 'FUNDED' : 'PENDING', gatewayRef: txRef },
    });

    if (walletAppliedAmount > 0 && amountToPay > 0) {
      // Queue a job to unlock funds if Chapa payment is not completed in 24 hours
      await this.escrowQueue.add('UNLOCK_FUNDS', {
        escrowId: escrow.id,
        clientId,
        amount: walletAppliedAmount
      }, { delay: 24 * 60 * 60 * 1000 });
    }

    if (amountToPay === 0) {
      // Fully funded by wallet
      await this.prisma.employerWalletTransaction.create({
        data: {
          walletId: employerWallet!.id,
          type: 'DEBIT_WITHDRAWAL',
          amount: walletAppliedAmount,
          note: `Fully funded escrow for job ${freelanceJobId}`,
          escrowId: escrow.id,
        }
      });

      // Move locked balance to zero since it's fully spent
      await this.prisma.employerWallet.update({
        where: { userId: clientId },
        data: { lockedBalance: { decrement: walletAppliedAmount } }
      });

      this.logger.log(`Escrow initiated (fully funded via wallet): ${escrow.id} for job ${freelanceJobId} — amount: ETB ${grossAmount}`);
      return { escrowId: escrow.id, checkoutUrl: null, grossAmount, platformFee, netAmount, walletAppliedAmount };
    }

    let checkoutUrl = `${this.config.get('FRONTEND_URL')}/freelance/pay?escrow=${escrow.id}`;
    
    const chapaSecret = this.config.get<string>('CHAPA_SECRET_KEY');
    if (chapaSecret) {
      try {
        const response = await fetch('https://api.chapa.co/v1/transaction/initialize', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${chapaSecret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: amountToPay.toString(),
            currency: 'ETB',
            email: job.client.email,
            first_name: job.client.firstName,
            last_name: job.client.lastName,
            tx_ref: txRef,
            callback_url: this.config.get<string>('CHAPA_CALLBACK_URL'),
            return_url: this.config.get<string>('CHAPA_RETURN_URL'),
            customization: {
              title: 'Beleqet Escrow',
              description: `Payment for Gig - ${job.title}`.replace(/[^a-zA-Z0-9\-_\.\s]/g, '').substring(0, 50),
            }
          }),
        });

        const data = await response.json();
        if (data.status === 'success') {
          checkoutUrl = data.data.checkout_url;
        } else {
          this.logger.warn(`Chapa initialization failed: ${JSON.stringify(data)}`);
        }
      } catch (err) {
        this.logger.error(`Failed to reach Chapa: ${(err as Error).message}`);
      }
    }

    this.logger.log(`Escrow initiated: ${escrow.id} for job ${freelanceJobId} — amountToPay: ETB ${amountToPay}, walletApplied: ETB ${walletAppliedAmount}`);
    return { escrowId: escrow.id, checkoutUrl, grossAmount, platformFee, netAmount, walletAppliedAmount, amountToPay };
  }

  /** Called by Chapa webhook — verifies signature, marks escrow funded */
  async handleWebhook(payload: { reference: string; status: string; [k: string]: unknown }) {
    await this.escrowQueue.add(ESCROW_JOBS.PROCESS_WEBHOOK, payload);
  }

  /** Called when employer approves milestone */
  async releaseMilestone(milestoneId: string, clientId: string) {
    const milestone = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, contract: { clientId } },
      include: { contract: { include: { freelanceJob: { include: { escrowTx: true } } } } },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
            freelancerId: milestone.contract.freelancerId, 
            amount: milestone.amount 
          },
          processedBy: EscrowService.name,
        },
      });
    });

    try {
      // Handle currency conversion if necessary. Base currency is ETB.
      const contractCurrency = milestone.contract.currency || 'ETB';
      const amountInETB = this.walletSvc.convertCurrency(milestone.amount, contractCurrency, 'ETB');

      // Add to wallet pending balance (3-day hold)
      await this.prisma.freelancerWallet.upsert({
        where: { userId: milestone.contract.freelancerId },
        update: { pendingBalance: { increment: amountInETB } },
        create: {
          userId: milestone.contract.freelancerId,
          pendingBalance: amountInETB,
          availableBalance: 0,
        },
      });

      await this.escrowQueue.add(ESCROW_JOBS.AUTO_RELEASE, {
        milestoneId,
        freelancerId: milestone.contract.freelancerId,
        amount: amountInETB,
        releaseAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
      });
    } catch (err) {
      this.logger.error(`Failed to enqueue auto-release for milestone ${milestoneId}`, err instanceof Error ? err.stack : err);
    }

    this.logger.log(`Milestone ${milestoneId} approved — payout queued`);
    return { success: true };
  }
}
