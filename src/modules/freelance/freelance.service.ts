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
  IsIn,
  IsInt,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Search, filters and sort for the public project list. */
export class FreelanceQueryDto {
  /** Sent by the mobile app and landing site; the public list only ever shows open projects. */
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsIn(['FIXED', 'HOURLY']) pricingType?: 'FIXED' | 'HOURLY';
  @IsOptional() @IsString() experienceLevel?: string;
  /** Projects whose budget reaches at least this much */
  @IsOptional() @IsInt() @Min(0) budgetMin?: number;
  /** Projects whose budget starts at or below this */
  @IsOptional() @IsInt() @Min(0) budgetMax?: number;
  @IsOptional() @IsIn(['newest', 'budget_high', 'budget_low']) sort?:
    'newest' | 'budget_high' | 'budget_low';
  @IsOptional() @IsInt() @Min(1) page?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
}

/** Event types shown in a contract's activity feed. */
const CONTRACT_EVENTS = [
  'milestone.proposed',
  'milestone.accepted',
  'milestone.submitted',
  'milestone.revision_requested',
  'milestone.approved',
  'milestone.dual_confirmed',
  'escrow.funded',
  'dispute.raised',
  'dispute.resolved',
];

/** One line in a contract's activity feed (EventLog is the record both sides read from). */
function activity(
  eventType: string,
  entityType: string,
  entityId: string,
  payload: Record<string, unknown>,
) {
  return {
    data: {
      eventType,
      entityType,
      entityId,
      payload: payload as Prisma.InputJsonValue,
      processedBy: 'FreelanceService',
    },
  };
}

/** "Abebe K." on public lists: enough to recognise a client without publishing a full name. */
function shortName(user: { firstName: string; lastName: string } | null): string | null {
  if (!user) return null;
  const initial = user.lastName?.trim().charAt(0);
  return initial ? `${user.firstName} ${initial}.` : user.firstName;
}

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

  async findJobs(query: FreelanceQueryDto) {
    const pageNum = Number(query.page) || 1;
    const limitNum = Number(query.limit) || 20;
    const { q, category, pricingType, experienceLevel, budgetMin, budgetMax } = query;

    const and: Prisma.FreelanceJobWhereInput[] = [{ status: { in: ['OPEN', 'FUNDED'] } }];
    if (category) and.push({ category: { slug: category } });
    if (pricingType) and.push({ pricingType });
    if (experienceLevel)
      and.push({ experienceLevel: { equals: experienceLevel, mode: 'insensitive' } });
    if (budgetMin !== undefined) and.push({ budgetMax: { gte: budgetMin } });
    if (budgetMax !== undefined) and.push({ budgetMin: { lte: budgetMax } });
    if (q) {
      const term = q.trim();
      // Skills are stored as written ("Logo design"), so try the common spellings of the term.
      const spellings = [
        ...new Set([
          term,
          term.toLowerCase(),
          term.charAt(0).toUpperCase() + term.slice(1).toLowerCase(),
        ]),
      ];
      and.push({
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { skills: { hasSome: spellings } },
        ],
      });
    }
    const where: Prisma.FreelanceJobWhereInput = { AND: and };
    const orderBy: Prisma.FreelanceJobOrderByWithRelationInput[] =
      query.sort === 'budget_high'
        ? [{ budgetMax: 'desc' }, { createdAt: 'desc' }]
        : query.sort === 'budget_low'
          ? [{ budgetMin: 'asc' }, { createdAt: 'desc' }]
          : [{ featured: 'desc' }, { createdAt: 'desc' }];

    const [rows, total] = await Promise.all([
      this.prisma.freelanceJob.findMany({
        where,
        include: {
          category: true,
          client: { select: { firstName: true, lastName: true } },
          _count: { select: { bids: true } },
        },
        orderBy,
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      this.prisma.freelanceJob.count({ where }),
    ]);
    const items = rows.map(({ client, ...job }) => ({ ...job, clientName: shortName(client) }));

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
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            createdAt: true,
            _count: { select: { contractsAsClient: { where: { status: 'COMPLETED' } } } },
          },
        },
        // Public endpoint: only the count. Prices and cover letters come from findBids.
        _count: { select: { bids: true } },
      },
    });
    if (!job) throw new NotFoundException('Gig not found');
    const { _count: clientCounts, createdAt: memberSince, ...client } = job.client;
    return {
      ...job,
      client: { ...client, memberSince, completedContracts: clientCounts.contractsAsClient },
    };
  }

  /** The project owner sees every bid; anyone else sees only their own. */
  async findBids(gigId: string, userId: string) {
    const job = await this.prisma.freelanceJob.findUnique({
      where: { id: gigId },
      select: { clientId: true },
    });
    if (!job) throw new NotFoundException('Gig not found');
    const bids = await this.prisma.bid.findMany({
      where:
        job.clientId === userId
          ? { freelanceJobId: gigId }
          : { freelanceJobId: gigId, freelancerId: userId },
      include: {
        freelancer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            createdAt: true,
            portfolioUrl: true,
            _count: { select: { contractsAsFreelancer: { where: { status: 'COMPLETED' } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    // What the client weighs bids by: track record, time on Beleqet, and past work.
    return bids.map(({ freelancer: { _count, createdAt, ...freelancer }, ...bid }) => ({
      ...bid,
      freelancer: {
        ...freelancer,
        memberSince: createdAt,
        completedContracts: _count.contractsAsFreelancer,
      },
    }));
  }

  async submitBid(freelancerId: string, gigId: string, dto: CreateBidDto) {
    const gig = await this.prisma.freelanceJob.findFirst({
      where: { id: gigId, status: { in: ['OPEN', 'FUNDED'] } },
    });
    if (!gig) throw new NotFoundException('Gig not found or no longer accepting bids');
    if (gig.clientId === freelancerId)
      throw new ForbiddenException('You cannot bid on your own project');

    const bidder = await this.prisma.user.findUnique({
      where: { id: freelancerId },
      select: { role: true },
    });
    if (!bidder || bidder.role === 'EMPLOYER' || bidder.role === 'ADMIN') {
      throw new ForbiddenException('Only freelancer and job seeker accounts can bid');
    }

    const existing = await this.prisma.bid.findUnique({
      where: { freelanceJobId_freelancerId: { freelanceJobId: gigId, freelancerId } },
    });
    if (existing) throw new ConflictException('You have already submitted a bid');

    try {
      return await this.prisma.bid.create({
        data: { ...dto, freelanceJobId: gigId, freelancerId },
      });
    } catch (error) {
      // Two submits at once: the unique index stops the second one.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('You have already submitted a bid');
      }
      throw error;
    }
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
          include: {
            escrowTx: { select: { id: true, status: true, grossAmount: true, fundedAt: true } },
          },
        },
        client: { select: { id: true, firstName: true, lastName: true } },
        freelancer: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!c) throw new NotFoundException('Contract not found');

    const revisions = await this.prisma.eventLog.findMany({
      where: {
        eventType: 'milestone.revision_requested',
        entityId: { in: c.milestones.map((m) => m.id) },
      },
      orderBy: { createdAt: 'desc' },
      select: { entityId: true, payload: true, createdAt: true },
    });
    const latest = new Map<string, { reason: string; at: Date }>();
    for (const r of revisions) {
      if (!latest.has(r.entityId)) {
        latest.set(r.entityId, {
          reason: String((r.payload as { reason?: string })?.reason ?? ''),
          at: r.createdAt,
        });
      }
    }
    return {
      ...c,
      milestones: c.milestones.map((m) => ({
        ...m,
        revisionNote: latest.get(m.id)?.reason ?? null,
        revisionRequestedAt: latest.get(m.id)?.at ?? null,
      })),
      activity: await this.contractActivity(c),
    };
  }

  /**
   * What happened on a contract, newest first: milestones proposed, accepted, submitted, sent
   * back and approved; escrow funded; a dispute opened and resolved. Read from EventLog.
   */
  private async contractActivity(c: {
    id: string;
    milestones: { id: string; title: string }[];
    freelanceJob: { escrowTx: { id: string } | null } | null;
  }) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { contractId: c.id },
      select: { id: true },
    });
    const titles = new Map(c.milestones.map((m) => [m.id, m.title]));
    const ids = [...titles.keys(), c.freelanceJob?.escrowTx?.id, dispute?.id].filter(
      (id): id is string => Boolean(id),
    );
    const events = await this.prisma.eventLog.findMany({
      where: { entityId: { in: ids }, eventType: { in: CONTRACT_EVENTS } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { eventType: true, entityId: true, payload: true, createdAt: true },
    });
    return events.map((event) => {
      const payload = (event.payload ?? {}) as { reason?: string; outcome?: string };
      return {
        type: event.eventType,
        at: event.createdAt,
        milestone: titles.get(event.entityId) ?? null,
        note: payload.reason ?? payload.outcome ?? null,
      };
    });
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
    if (contract.dispute)
      throw new ConflictException('A dispute is already open for this contract.');
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
      await tx.eventLog.create(
        activity('dispute.raised', 'Dispute', dispute.id, { contractId, raisedById: userId }),
      );
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

    if (contract.status !== 'ACTIVE')
      throw new ConflictException('Milestones can only be added to an active contract.');

    // All milestones together can't ask for more than the client agreed to pay.
    const planned = await this.prisma.milestone.aggregate({
      where: { contractId },
      _sum: { amount: true },
    });
    const left = contract.agreedAmount - (planned._sum.amount ?? 0);
    if (dto.amount > left) {
      throw new BadRequestException(
        `Milestones would add up to more than the contract amount; ${left} is left to plan.`,
      );
    }

    // The client accepts a milestone before work on it counts.
    const milestone = await this.prisma.milestone.create({
      data: {
        ...dto,
        contractId,
        deadline: new Date(dto.deadline),
        status: 'PROPOSED',
      },
    });
    await this.prisma.eventLog.create(
      activity('milestone.proposed', 'Milestone', milestone.id, {
        contractId,
        title: milestone.title,
      }),
    );
    return milestone;
  }

  /** The client agrees to a milestone the freelancer proposed. */
  async acceptMilestone(clientId: string, milestoneId: string) {
    const { count } = await this.prisma.milestone.updateMany({
      where: { id: milestoneId, status: 'PROPOSED', contract: { clientId } },
      data: { status: 'PENDING' },
    });
    if (count === 0) throw new NotFoundException('No proposed milestone to accept');
    await this.prisma.eventLog.create(activity('milestone.accepted', 'Milestone', milestoneId, {}));
    return { status: 'PENDING' };
  }

  /** The client turns a proposed milestone down; it is removed so the freelancer can propose another. */
  async declineMilestone(clientId: string, milestoneId: string) {
    const { count } = await this.prisma.milestone.deleteMany({
      where: { id: milestoneId, status: 'PROPOSED', contract: { clientId } },
    });
    if (count === 0) throw new NotFoundException('No proposed milestone to decline');
    return { declined: true };
  }

  async submitDeliverable(freelancerId: string, milestoneId: string, dto: SubmitDeliverableDto) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { contract: true },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');
    if (milestone.contract.freelancerId !== freelancerId) {
      throw new ForbiddenException(
        'Only the assigned freelancer can submit deliverables for this milestone',
      );
    }
    if (milestone.status === 'PROPOSED') {
      throw new ConflictException('The client has not accepted this milestone yet.');
    }
    if (milestone.status === 'APPROVED')
      throw new ConflictException('This milestone is already approved.');

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
      await tx.eventLog.create(
        activity('milestone.submitted', 'Milestone', milestoneId, {
          contractId: milestone.contractId,
        }),
      );

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

  /** Projects the person saved to come back to, newest save first. */
  async savedProjects(userId: string) {
    const rows = await this.prisma.savedFreelanceJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        freelanceJob: {
          include: {
            category: true,
            client: { select: { firstName: true, lastName: true } },
            _count: { select: { bids: true } },
          },
        },
      },
    });
    return rows.map(({ freelanceJob: { client, ...job }, createdAt }) => ({
      ...job,
      clientName: shortName(client),
      savedAt: createdAt,
    }));
  }

  async saveProject(userId: string, freelanceJobId: string) {
    const job = await this.prisma.freelanceJob.findUnique({
      where: { id: freelanceJobId },
      select: { id: true },
    });
    if (!job) throw new NotFoundException('Project not found');
    await this.prisma.savedFreelanceJob.upsert({
      where: { userId_freelanceJobId: { userId, freelanceJobId } },
      update: {},
      create: { userId, freelanceJobId },
    });
    return { saved: true };
  }

  async unsaveProject(userId: string, freelanceJobId: string) {
    await this.prisma.savedFreelanceJob.deleteMany({ where: { userId, freelanceJobId } });
    return { saved: false };
  }
}
