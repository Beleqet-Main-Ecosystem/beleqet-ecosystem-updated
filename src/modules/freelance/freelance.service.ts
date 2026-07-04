import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

import { IsString, IsNumber, IsOptional, IsArray, Min, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFreelanceJobDto {
  @ApiProperty({ example: 'Build a Modern E-commerce Website' })
  @IsString() title: string;
  
  @ApiProperty({ example: 'I need an experienced freelance developer...' })
  @IsString() description: string;
  
  @ApiProperty({ example: 'f05b2516-f887-4f58-b44b-791f6c93f396' })
  @IsString() categoryId: string;

  @ApiProperty({ example: 15000 })
  @IsNumber() @Min(0) budgetMin: number;
  
  @ApiProperty({ example: 30000 })
  @IsNumber() @Min(0) budgetMax: number;
  
  @ApiProperty({ example: 'FIXED', required: false })
  @IsOptional() @IsString() pricingType?: string;

  @ApiProperty({ example: 30 })
  @IsNumber() @Min(1) deadlineDays: number;
  
  @ApiProperty({ example: ['Next.js', 'React'] })
  @IsArray() @IsString({ each: true }) skills: string[];
  
  @ApiProperty({ example: 'Addis Ababa', required: false })
  @IsOptional() @IsString() locationPreference?: string;
  
  @ApiProperty({ example: 'Intermediate', required: false })
  @IsOptional() @IsString() experienceLevel?: string;
  
  @ApiProperty({ example: [], required: false })
  @IsOptional() @IsArray() @IsString({ each: true }) attachments?: string[];
}

export class CreateBidDto {
  @ApiProperty({ example: 20000 })
  @IsNumber() @Min(1) amount: number;
  
  @ApiProperty({ example: 25 })
  @IsNumber() @Min(1) timelineDays: number;
  
  @ApiProperty({ example: 'I have successfully completed similar projects...' })
  @IsString() coverLetter: string;
}

export class CreateMilestoneDto {
  @ApiProperty({ example: 'Initial Design' })
  @IsString() title: string;

  @ApiProperty({ example: 'Figma mockups for the homepage', required: false })
  @IsOptional() @IsString() description?: string;

  @ApiProperty({ example: 10000 })
  @IsNumber() @Min(1) amount: number;

  @ApiProperty({ example: '2026-07-10T00:00:00.000Z' })
  @IsDateString() deadline: string;
}

@Injectable()
export class FreelanceService {
  constructor(private readonly prisma: PrismaService) {}

  async createJob(clientId: string, dto: CreateFreelanceJobDto) {
    return this.prisma.freelanceJob.create({
      data: { ...dto, clientId, status: 'OPEN' },
      include: { category: true, client: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async findJobs(query: { q?: string; category?: string; page?: number; limit?: number }) {
    const pageNum = Number(query.page) || 1;
    const limitNum = Number(query.limit) || 20;
    const { q, category } = query;

    const where: Record<string, unknown> = { status: { in: ['OPEN', 'FUNDED'] } };
    if (category) where['category'] = { slug: category };
    if (q) where['OR'] = [
      { title:       { contains: q, mode: 'insensitive' } },
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

    return { items, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
  }

  async findJobById(id: string) {
    const job = await this.prisma.freelanceJob.findUnique({
      where: { id },
      include: {
        category: true,
        client: { select: { id: true, firstName: true, lastName: true } },
        bids: {
          include: { freelancer: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!job) throw new NotFoundException('Gig not found');
    return job;
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
    });
    if (!bid) throw new NotFoundException('Bid not found');

    const contract = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Accept chosen bid, reject others
      await tx.bid.update({ where: { id: bidId }, data: { status: 'ACCEPTED' } });
      await tx.bid.updateMany({
        where: { freelanceJobId: bid.freelanceJobId, id: { not: bidId } },
        data: { status: 'REJECTED' },
      });

      // Create contract
      const c = await tx.contract.create({
        data: { freelanceJobId: bid.freelanceJobId, clientId, freelancerId: bid.freelancerId, agreedAmount: bid.amount },
      });

      // Update gig status
      await tx.freelanceJob.update({
        where: { id: bid.freelanceJobId },
        data: { status: 'IN_PROGRESS' },
      });

      // Refund excess escrow if needed
      const escrow = await tx.escrowTransaction.findFirst({
        where: { freelanceJobId: bid.freelanceJobId, status: { in: ['FUNDED', 'PENDING'] } }
      });

      if (escrow && escrow.grossAmount > bid.amount) {
        const excess = escrow.grossAmount - bid.amount;
        
        const wallet = await tx.employerWallet.upsert({
          where: { userId: clientId },
          update: { balance: { increment: excess } },
          create: { userId: clientId, balance: excess, lockedBalance: 0 }
        });

        await tx.employerWalletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'CREDIT_AVAILABLE',
            amount: excess,
            note: `Refund for excess escrow on gig ${bid.freelanceJobId}`,
            escrowId: escrow.id,
          }
        });

        const platformFeePct = 0.10;
        const platformFee = Math.round(bid.amount * platformFeePct);
        const netAmount = bid.amount - platformFee;
        
        await tx.escrowTransaction.update({
          where: { id: escrow.id },
          data: {
            grossAmount: bid.amount,
            platformFee,
            netAmount
          }
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
        OR: [
          { clientId: userId },
          { freelancerId: userId }
        ]
      },
      include: {
        freelanceJob: true,
        client: { select: { id: true, firstName: true, lastName: true } },
        freelancer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getContract(id: string) {
    const c = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        milestones: { include: { deliverables: true } },
        freelanceJob: true,
        client:     { select: { id: true, firstName: true, lastName: true } },
        freelancer: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!c) throw new NotFoundException('Contract not found');
    return c;
  }

  async createMilestone(freelancerId: string, contractId: string, dto: CreateMilestoneDto) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, freelancerId },
    });
    if (!contract) {
      throw new ForbiddenException('Contract not found or you are not authorized to add milestones to it');
    }

    return this.prisma.milestone.create({
      data: {
        ...dto,
        contractId,
        deadline: new Date(dto.deadline),
      },
    });
  }

}
