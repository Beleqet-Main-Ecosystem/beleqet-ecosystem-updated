/**
 * @file plans.service.ts
 * @description CRUD for the subscription Plan catalog (Free/Pro/Enterprise).
 * Plans are soft-deleted (isActive=false) so existing Subscriptions retain a
 * valid foreign key and historical Transaction/Plan data is never destroyed.
 */
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists plans. Defaults to active-only (the public pricing-page view);
   * pass `includeInactive` for the admin dashboard.
   */
  findAll(includeInactive = false) {
    return this.prisma.plan.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { priceAmount: 'asc' },
    });
  }

  async findOne(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async create(dto: CreatePlanDto) {
    try {
      return await this.prisma.plan.create({
        data: {
          name: dto.name,
          description: dto.description,
          priceAmount: dto.priceAmount,
          currency: dto.currency ?? 'ETB',
          interval: dto.interval,
          features: dto.features as Prisma.InputJsonValue,
          isActive: dto.isActive ?? true,
          paypalPlanId: dto.paypalPlanId,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`A plan named "${dto.name}" already exists`);
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdatePlanDto) {
    await this.findOne(id);
    return this.prisma.plan.update({
      where: { id },
      data: {
        ...dto,
        features: dto.features ? (dto.features as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  /** Soft-delete only — an admin retiring a plan must not orphan active Subscriptions. */
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.plan.update({ where: { id }, data: { isActive: false } });
  }
}
