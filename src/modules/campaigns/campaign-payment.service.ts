import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Campaign, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ChapaClient } from '../chapa/chapa.client';
import { ChapaWebhookPayload } from '../chapa/chapa.types';
import { WalletService } from '../wallet/wallet.service';

const WALLET_CURRENCY = 'ETB';

export interface ReserveBudgetResult {
  campaign: Campaign;
  checkoutUrl?: string;
  amountDueEtb: number;
  reservedFromWalletEtb: number;
  fxRate: number;
}

/**
 * Reserves campaign budget via employer wallet lock and optional Chapa
 * checkout. Stores the FX rate used at write time for historical reporting.
 */
@Injectable()
export class CampaignPaymentService {
  private readonly logger = new Logger(CampaignPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly chapa: ChapaClient,
    private readonly config: ConfigService,
  ) {}

  /**
   * Authorizes `totalBudget` for a campaign: converts to ETB at the live rate,
   * locks as much as possible from the employer wallet, and opens Chapa for
   * any remainder. Fully wallet-funded campaigns become ACTIVE immediately;
   * otherwise status stays PENDING_PAYMENT until webhook confirmation.
   */
  async reserveBudget(campaignId: string, ownerEmail: string): Promise<ReserveBudgetResult> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status !== 'DRAFT' && campaign.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('Budget can only be reserved for draft/pending campaigns');
    }

    const fxFrom = campaign.currencyCode.toUpperCase();
    const fxTo = WALLET_CURRENCY;
    const fxRate = this.wallet.getExchangeRate(fxFrom, fxTo);
    const totalEtb = this.wallet.convertCurrency(campaign.totalBudget, fxFrom, fxTo);
    if (totalEtb < 1) {
      throw new BadRequestException('Converted budget must be at least 1 ETB santim');
    }

    const txRef = campaign.paymentTxRef ?? `camp-${Date.now()}-${randomUUID().slice(0, 8)}`;

    const funding = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "campaigns" WHERE id = ${campaignId} FOR UPDATE`;

      const employerWallet = await tx.employerWallet.findUnique({
        where: { userId: campaign.ownerId },
      });
      const available = employerWallet?.balance ?? 0;
      const walletApplied = Math.min(available, totalEtb);
      const amountDue = totalEtb - walletApplied;

      if (walletApplied > 0) {
        const locked = await tx.employerWallet.updateMany({
          where: { userId: campaign.ownerId, balance: { gte: walletApplied } },
          data: {
            balance: { decrement: walletApplied },
            lockedBalance: { increment: walletApplied },
          },
        });
        if (locked.count === 0) {
          throw new BadRequestException('Insufficient wallet balance or concurrent reservation');
        }

        if (employerWallet) {
          await tx.employerWalletTransaction.create({
            data: {
              walletId: employerWallet.id,
              type: 'DEBIT_FEE',
              amount: walletApplied,
              note: `Campaign budget reserve ${campaignId}`,
            },
          });
        }
      }

      const nextStatus = amountDue === 0 ? 'ACTIVE' : 'PENDING_PAYMENT';
      const updated = await tx.campaign.update({
        where: { id: campaignId },
        data: {
          status: nextStatus,
          fxRate,
          fxFromCurrency: fxFrom,
          fxToCurrency: fxTo,
          reservedAmountEtb: walletApplied,
          paymentTxRef: amountDue > 0 ? txRef : null,
          startAt: campaign.startAt ?? (nextStatus === 'ACTIVE' ? new Date() : campaign.startAt),
        },
      });

      await tx.eventLog.create({
        data: {
          eventType: 'campaign.budget.reserved',
          entityId: campaignId,
          entityType: 'campaign',
          payload: {
            fxRate,
            fxFrom,
            fxTo,
            totalEtb,
            walletApplied,
            amountDue,
            status: nextStatus,
          } as Prisma.InputJsonValue,
          processedBy: CampaignPaymentService.name,
        },
      });

      return { campaign: updated, walletApplied, amountDue, fxRate };
    });

    if (funding.amountDue === 0) {
      return {
        campaign: funding.campaign,
        amountDueEtb: 0,
        reservedFromWalletEtb: funding.walletApplied,
        fxRate: funding.fxRate,
      };
    }

/**
 * Initializes Chapa checkout for the unpaid remainder of a campaign budget.
 * Uses CHAPA_CAMPAIGN_CALLBACK_URL when set, otherwise falls back to the
 * campaigns webhook path (or CHAPA_CALLBACK_URL for local defaults).
 */
    const callbackUrl =
      this.config.get<string>('CHAPA_CAMPAIGN_CALLBACK_URL') ||
      'http://localhost:4000/api/v1/campaigns/webhook/chapa';
    const returnUrl =
      this.config.get<string>('CHAPA_RETURN_URL') || 'http://localhost:3000/campaigns/payment-success';

    const owner = await this.prisma.user.findUnique({ where: { id: campaign.ownerId } });
    const checkout = await this.chapa.initializePayment({
      amount: funding.amountDue.toString(),
      currency: WALLET_CURRENCY,
      email: ownerEmail || owner?.email || 'owner@beleqet.com',
      firstName: owner?.firstName || 'Campaign',
      lastName: owner?.lastName || 'Owner',
      txRef,
      callbackUrl,
      returnUrl,
      title: 'Beleqet Campaign',
      description: `Boost campaign ${campaignId}`,
    });

    return {
      campaign: funding.campaign,
      checkoutUrl: checkout.data?.checkout_url,
      amountDueEtb: funding.amountDue,
      reservedFromWalletEtb: funding.walletApplied,
      fxRate: funding.fxRate,
    };
  }

  /**
   * Chapa webhook / redirect confirmation. Transitions PENDING_PAYMENT → ACTIVE
   * on success, or → REJECTED (releasing any wallet lock) on failure.
   */
  async handlePaymentWebhook(payload: ChapaWebhookPayload | Record<string, unknown>): Promise<{
    ok: boolean;
    campaignId?: string;
    status?: string;
  }> {
    const txRef = String(payload.tx_ref ?? payload.trx_ref ?? '');
    if (!txRef) {
      throw new BadRequestException('Missing tx_ref');
    }

    const eventKey = `campaign.chapa.${txRef}`;
    const already = await this.prisma.eventLog.findFirst({
      where: { eventType: 'campaign.chapa.webhook.processed', entityId: eventKey },
    });
    if (already) {
      return { ok: true };
    }

    const campaign = await this.prisma.campaign.findFirst({
      where: { paymentTxRef: txRef },
    });
    if (!campaign) {
      this.logger.warn(`No campaign for payment tx_ref=${txRef}`);
      return { ok: false };
    }

    const status = String(payload.status ?? '').toLowerCase();
    const success = status === 'success' || status === 'successful';

    if (success) {
      try {
        await this.chapa.verifyTransaction(txRef);
      } catch (err) {
        this.logger.warn(`Chapa verify failed for ${txRef}: ${(err as Error).message}`);
        return { ok: false, campaignId: campaign.id };
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "campaigns" WHERE id = ${campaign.id} FOR UPDATE`;

      if (success) {
        const remainingEtb = Math.max(
          0,
          this.wallet.convertCurrency(campaign.totalBudget, campaign.currencyCode, WALLET_CURRENCY) -
            campaign.reservedAmountEtb,
        );

        if (remainingEtb > 0) {
          const wallet = await tx.employerWallet.findUnique({
            where: { userId: campaign.ownerId },
          });
          if (wallet) {
            await tx.employerWallet.update({
              where: { id: wallet.id },
              data: { lockedBalance: { increment: remainingEtb } },
            });
            await tx.campaign.update({
              where: { id: campaign.id },
              data: { reservedAmountEtb: { increment: remainingEtb } },
            });
          }
        }

        await tx.campaign.update({
          where: { id: campaign.id },
          data: {
            status: 'ACTIVE',
            startAt: campaign.startAt ?? new Date(),
          },
        });
      } else {
        await this.releaseWalletLock(tx, campaign);
        await tx.campaign.update({
          where: { id: campaign.id },
          data: { status: 'REJECTED', reservedAmountEtb: 0 },
        });
      }

      await tx.eventLog.create({
        data: {
          eventType: 'campaign.chapa.webhook.processed',
          entityId: eventKey,
          entityType: 'campaign',
          payload: { txRef, success, status } as Prisma.InputJsonValue,
          processedBy: CampaignPaymentService.name,
        },
      });
    });

    return {
      ok: true,
      campaignId: campaign.id,
      status: success ? 'ACTIVE' : 'REJECTED',
    };
  }

  private async releaseWalletLock(tx: Prisma.TransactionClient, campaign: Campaign): Promise<void> {
    if (campaign.reservedAmountEtb <= 0) return;

    const unlocked = await tx.employerWallet.updateMany({
      where: {
        userId: campaign.ownerId,
        lockedBalance: { gte: campaign.reservedAmountEtb },
      },
      data: {
        lockedBalance: { decrement: campaign.reservedAmountEtb },
        balance: { increment: campaign.reservedAmountEtb },
      },
    });

    if (unlocked.count === 0) {
      this.logger.error(
        `Failed to release campaign wallet lock for ${campaign.id} amount=${campaign.reservedAmountEtb}`,
      );
    }
  }
}
