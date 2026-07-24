import { Injectable, Scope } from '@nestjs/common';
import * as DataLoader from 'dataloader';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable({ scope: Scope.REQUEST })
export class CategoryLoader {
  constructor(private readonly prisma: PrismaService) {}

  public readonly batchLoad = new DataLoader<string, any>(async (ids: string[]) => {
    const categories = await this.prisma.jobCategory.findMany({
      where: { id: { in: ids } },
    });
    const map = new Map(categories.map(c => [c.id, c]));
    return ids.map(id => map.get(id) || null);
  });
}
