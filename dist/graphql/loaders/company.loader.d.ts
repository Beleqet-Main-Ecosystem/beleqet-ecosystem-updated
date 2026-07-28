import * as DataLoader from 'dataloader';
import { PrismaService } from '../../prisma/prisma.service';
export declare class CompanyLoader {
    private readonly prisma;
    constructor(prisma: PrismaService);
    readonly batchLoad: DataLoader<string, any, string>;
}
