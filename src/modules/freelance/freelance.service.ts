import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  MinLength,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFreelanceJobDto {
  @ApiProperty({ example: 'Build a Modern E-commerce Website' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'I need an experienced freelance developer...' })
  @IsString()
  description: string;

  @ApiProperty({ example: 'f05b2516-f887-4f58-b44b-791f6c93f396' })
  @IsString()
  categoryId: string;

  @ApiProperty({ example: 15000 })
  @IsNumber()
  @Min(0)
  budgetMin: number;

  @ApiProperty({ example: 30000 })
  @IsNumber()
  @Min(0)
  budgetMax: number;

  @ApiProperty({ example: 'FIXED', required: false })
  @IsOptional()
  @IsString()
  pricingType?: string;

  @ApiProperty({ example: 30 })
  @IsNumber()
  @Min(1)
  deadlineDays: number;

  @ApiProperty({ example: ['Next.js', 'React'] })
  @IsArray()
  @IsString({ each: true })
  skills: string[];

  @ApiProperty({ example: 'Addis Ababa', required: false })
  @IsOptional()
  @IsString()
  locationPreference?: string;

  @ApiProperty({ example: 'Intermediate', required: false })
  @IsOptional()
  @IsString()
  experienceLevel?: string;

  @ApiProperty({ example: [], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}

export class CreateBidDto {
  @ApiProperty({ example: 20000 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ example: 25 })
  @IsNumber()
  @Min(1)
  timelineDays: number;

  @ApiProperty({ example: 'I have successfully completed similar projects...' })
  @IsString()
  coverLetter: string;
}

export class CreateMilestoneDto {
  @ApiProperty({ example: 'Initial Design' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Figma mockups for the homepage', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 10000 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ example: '2026-07-10T00:00:00.000Z' })
  @IsDateString()
  deadline: string;
}

export class SubmitDeliverableDto {
  @ApiProperty({ example: 'https://storage.beleqet.com/files/work.zip', required: false })
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiProperty({ example: 'Milestone work completed and attached.', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RaiseDisputeDto {
  @ApiProperty({ example: 'The delivered work does not match the agreed milestone scope.' })
  @IsString()
  @MinLength(20)
  reason: string;

  @ApiProperty({ example: ['https://storage.beleqet.com/files/evidence.png'], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceUrls?: string[];
}

@Injectable()
export class FreelanceService {
  constructor(private readonly prisma: PrismaService) {}

  async createJob(clientId: string, dto: CreateFreelanceJobDto) {
    return this.prisma.freelanceJob.create({
      data: { ...dto, clientId, status: 'OPEN' },
      include: {
        category: true,
        client: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  findCategories() {
    return this.prisma.freelanceCategory.findMany({
      select: { id: true, slug: true, label: true },
      orderBy: { label: 'asc' },
    });
  }

  async findJobs(query: { q?: string; category?: string; page?: number; limit?: number }) {
    const pageNum = Number(query.page) || 1;
    const limitNum = Number(query.limit) || 20;
    const { q, category } = query;

    const where: Record<string, unknown> = { status: { in: ['OPEN', 'FUNDED'] } };
    if (category) where['category'] = { slug: category };
    if (q)
      where['OR'] = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];

    const [items, total] = await Promise.all([
      this.prisma.freelanceJob.findMany({
        where: where as never,
        include: { category: true, _count: { select: { bids: true } } },
        orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      this.prisma.freelanceJob.count({ where: where as never }),
    ]);

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  async findJobById(id: string) {
    const job = await this.prisma.freelanceJob.findUnique({
      where: { id },
      include: {
        category: true,
        client: { select: { id: true, firstName: true, lastName: true } },
        // Public endpoint: only the count. Prices and cover letters come from findBids.
        _count: { select: { bids: true } },
      },
    });
    if (!job) throw new NotFoundException('Gig not found');
    return job;
  }

  /** The project owner sees every bid; anyone else sees only their own. */
  async findBids(gigId: string, userId: string) {
    const job = await this.prisma.freelanceJob.findUnique({
      where: { id: gigId },
      select: { clientId: true },
    });
    if (!job) throw new NotFoundException('Gig not found');
    return this.prisma.bid.findMany({
      where: job.clientId === userId ? { freelanceJobId: gigId } : { freelanceJobId: gigId, freelancerId: userId },
      include: { freelancer: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async submitBid(freelancerId: string, gigId: string, dto: CreateBidDto) {
    const gig = await this.prisma.freelanceJob.findFirst({
      where: { id: gigId, status: { in: ['OPEN', 'FUNDED'] } },
    });
    if (!gig) throw new NotFoundException('Gig not found or no longer accepting bids');

    const existing = await this.prisma.bid.findUnique({
      where: { freelanceJobId_freelancerId: { freelanceJobId: gigId, freelancerId } },
    });
    if (existing) throw new ConflictException('You have already submitted a bid');

    return this.prisma.bid.create({ data: { ...dto, freelanceJobId: gigId, freelancerId } });
  }

  async acceptBid(bidId: string, clientId: string) {
    const bid = await this.prisma.bid.findFirst({
      where: { id: bidId, freelanceJob: { clientId } },
      include: { freelanceJob: { select: { status: true } } },
    });
    if (!bid) throw new NotFoundException('Bid not found');
    if (bid.status !== 'PENDING' || !['OPEN', 'FUNDED'].includes(bid.freelanceJob.status)) {
      throw new ConflictException('This bid can no longer be accepted.');
    }

    const contract = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Accept chosen bid, reject others. The status guard makes a concurrent
      // second acceptance match zero rows instead of creating another contract.
      const { count } = await tx.bid.updateMany({
        where: { id: bidId, status: 'PENDING' },
        data: { status: 'ACCEPTED' },
      });
      if (count === 0) throw new ConflictException('This bid can no longer be accepted.');
      await tx.bid.updateMany({
        where: { freelanceJobId: bid.freelanceJobId, id: { not: bidId } },
        data: { status: 'REJECTED' },
      });

      // Create contract
      const c = await tx.contract.create({
        data: {
          freelanceJobId: bid.freelanceJobId,
          clientId,
          freelancerId: bid.freelancerId,
          agreedAmount: bid.amount,
        },
      });

      // Update gig status
      await tx.freelanceJob.update({
        where: { id: bid.freelanceJobId },
        data: { status: 'IN_PROGRESS' },
      });

      // Refund excess escrow if needed. Only a FUNDED escrow holds real money;
      // crediting the excess of an unpaid PENDING escrow would mint balance.
      const escrow = await tx.escrowTransaction.findFirst({
        where: { freelanceJobId: bid.freelanceJobId, status: 'FUNDED' },
      });

      if (escrow && escrow.grossAmount > bid.amount) {
        const excess = escrow.grossAmount - bid.amount;

        const wallet = await tx.employerWallet.upsert({
          where: { userId: clientId },
          update: { balance: { increment: excess } },
          create: { userId: clientId, balance: excess, lockedBalance: 0 },
        });

        await tx.employerWalletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'CREDIT_AVAILABLE',
            amount: excess,
            note: `Refund for excess escrow on gig ${bid.freelanceJobId}`,
            escrowId: escrow.id,
          },
        });

        const platformFeePct = 0.1;
        const platformFee = Math.round(bid.amount * platformFeePct);
        const netAmount = bid.amount - platformFee;

        await tx.escrowTransaction.update({
          where: { id: escrow.id },
          data: {
            grossAmount: bid.amount,
            platformFee,
            netAmount,
          },
        });
      }

      // Create a chat room for this contract
      await tx.chatRoom.create({
        data: {
          contractId: c.id,
          participants: { create: [{ userId: clientId }, { userId: bid.freelancerId }] },
        },
      });

      return c;
    });

    return contract;
  }

  async rejectBid(bidId: string, clientId: string) {
    const bid = await this.prisma.bid.findFirst({
      where: { id: bidId, freelanceJob: { clientId } },
    });
    if (!bid) throw new NotFoundException('Bid not found');

    return this.prisma.bid.update({
      where: { id: bidId },
      data: { status: 'REJECTED' },
    });
  }

  async getMyBids(freelancerId: string) {
    return this.prisma.bid.findMany({
      where: { freelancerId },
      include: { freelanceJob: { include: { category: true, contract: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyContracts(userId: string) {
    return this.prisma.contract.findMany({
      where: {
        OR: [{ clientId: userId }, { freelancerId: userId }],
      },
      include: {
        freelanceJob: true,
        client: { select: { id: true, firstName: true, lastName: true } },
        freelancer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getContract(id: string, userId: string) {
    // Only the two parties may read a contract; others get the same 404 as a
    // missing contract so contract IDs can't be probed.
    const c = await this.prisma.contract.findFirst({
      where: { id, OR: [{ clientId: userId }, { freelancerId: userId }] },
      include: {
        milestones: { include: { deliverables: true } },
        freelanceJob: {
          include: { escrowTx: { select: { status: true, grossAmount: true, fundedAt: true } } },
        },
        client: { select: { id: true, firstName: true, lastName: true } },
        freelancer: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!c) throw new NotFoundException('Contract not found');

    const revisions = await this.prisma.eventLog.findMany({
      where: { eventType: 'milestone.revision_requested', entityId: { in: c.milestones.map((m) => m.id) } },
      orderBy: { createdAt: 'desc' },
      select: { entityId: true, payload: true, createdAt: true },
    });
    const latest = new Map<string, { reason: string; at: Date }>();
    for (const r of revisions) {
      if (!latest.has(r.entityId)) {
        latest.set(r.entityId, { reason: String((r.payload as { reason?: string })?.reason ?? ''), at: r.createdAt });
      }
    }
    return {
      ...c,
      milestones: c.milestones.map((m) => ({
        ...m,
        revisionNote: latest.get(m.id)?.reason ?? null,
        revisionRequestedAt: latest.get(m.id)?.at ?? null,
      })),
    };
  }

  /**
   * Either party may open one dispute per active contract. The contract and any
   * funded escrow move to DISPUTED, which blocks milestone releases until an
   * admin resolves it.
   */
  async raiseDispute(userId: string, contractId: string, dto: RaiseDisputeDto) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, OR: [{ clientId: userId }, { freelancerId: userId }] },
      include: { dispute: true },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.dispute) throw new ConflictException('A dispute is already open for this contract.');
    if (contract.status !== 'ACTIVE') {
      throw new ConflictException('Only active contracts can be disputed.');
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const dispute = await tx.dispute.create({
        data: {
          contractId,
          raisedById: userId,
          reason: dto.reason,
          evidenceUrls: dto.evidenceUrls ?? [],
        },
      });
      await tx.contract.update({ where: { id: contractId }, data: { status: 'DISPUTED' } });
      await tx.escrowTransaction.updateMany({
        where: { freelanceJobId: contract.freelanceJobId, status: 'FUNDED' },
        data: { status: 'DISPUTED' },
      });
      return dispute;
    });
  }

  async createMilestone(freelancerId: string, contractId: string, dto: CreateMilestoneDto) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, freelancerId },
    });
    if (!contract) {
      throw new ForbiddenException(
        'Contract not found or you are not authorized to add milestones to it',
      );
    }

    return this.prisma.milestone.create({
      data: {
        ...dto,
        contractId,
        deadline: new Date(dto.deadline),
      },
    });
  }

  async submitDeliverable(freelancerId: string, milestoneId: string, dto: SubmitDeliverableDto) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { contract: true },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');
    if (milestone.contract.freelancerId !== freelancerId) {
      throw new ForbiddenException('Only the assigned freelancer can submit deliverables for this milestone');
    }

    return this.prisma.$transaction(async (tx) => {
      const deliverable = await tx.deliverable.create({
        data: {
          milestoneId,
          fileUrl: dto.fileUrl,
          notes: dto.notes,
        },
      });

      await tx.milestone.update({
        where: { id: milestoneId },
        data: {
          status: 'SUBMITTED',
          freelancerApprovedAt: new Date(),
        },
      });

      return deliverable;
    });
  }

  async requestRevision(clientId: string, milestoneId: string, reason?: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { contract: true },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');
    if (milestone.contract.clientId !== clientId) {
      throw new ForbiddenException('Only the client can request milestone revision');
    }
    if (milestone.status !== 'SUBMITTED') {
      throw new ConflictException('Only submitted work can be sent back for revision.');
    }
    const note = reason?.trim() ?? '';
    if (!note || note.length > 2000) {
      throw new BadRequestException('Say what should change, in up to 2,000 characters.');
    }

    // The note is kept in the event log, which the contract page reads back.
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.milestone.update({
        where: { id: milestoneId },
        data: { status: 'REVISION_REQUESTED' },
      });
      await tx.eventLog.create({
        data: {
          eventType: 'milestone.revision_requested',
          entityId: milestoneId,
          entityType: 'Milestone',
          payload: { contractId: milestone.contractId, reason: note },
          actorUserId: clientId,
          processedBy: FreelanceService.name,
        },
      });
      return updated;
    });
  }
}
