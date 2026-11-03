import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JobType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Enough for several searches without letting one account fan out unlimited emails. */
const MAX_ALERTS = 10;

export type AlertInput = {
  keywords?: string[];
  location?: string | null;
  jobType?: JobType | null;
  minSalary?: number | null;
  isActive?: boolean;
};

@Injectable()
export class JobAlertsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.jobAlert.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  async create(userId: string, input: AlertInput) {
    const data = this.clean(input);
    if (!data.keywords?.length && !data.location && !data.jobType && !data.minSalary) {
      throw new BadRequestException(
        'Give the alert at least one keyword, place, job type or salary',
      );
    }
    if ((await this.prisma.jobAlert.count({ where: { userId } })) >= MAX_ALERTS) {
      throw new BadRequestException(`You can have up to ${MAX_ALERTS} job alerts`);
    }
    return this.prisma.jobAlert.create({
      data: { ...data, keywords: data.keywords ?? [], userId },
    });
  }

  async update(userId: string, id: string, input: AlertInput) {
    await this.mine(userId, id);
    return this.prisma.jobAlert.update({ where: { id }, data: this.clean(input) });
  }

  async remove(userId: string, id: string) {
    await this.mine(userId, id);
    await this.prisma.jobAlert.delete({ where: { id } });
    return { deleted: true };
  }

  private async mine(userId: string, id: string) {
    const alert = await this.prisma.jobAlert.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!alert) throw new NotFoundException('Job alert not found');
  }

  private clean(input: AlertInput) {
    return {
      keywords: input.keywords
        ?.map((word) => word.trim())
        .filter(Boolean)
        .slice(0, 10),
      location: input.location === undefined ? undefined : input.location?.trim() || null,
      jobType: input.jobType,
      minSalary: input.minSalary,
      isActive: input.isActive,
    };
  }
}
