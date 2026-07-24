import { Injectable, Scope } from '@nestjs/common';
import * as DataLoader from 'dataloader';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable({ scope: Scope.REQUEST })
export class CompanyLoader {
  constructor(private readonly prisma: PrismaService) {}

  public readonly batchLoad = new DataLoader<string, any>(async (ids: string[]) => {
    const companies = await this.prisma.company.findMany({
      where: { id: { in: ids } },
    });
    const map = new Map(companies.map(c => [c.id, c]));
    return ids.map(id => map.get(id) || null);
  });
}
