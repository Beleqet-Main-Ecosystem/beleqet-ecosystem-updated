import { DisputeManagerService } from './dispute-manager.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
export declare class DisputeManagerController {
    private readonly disputeManagerService;
    constructor(disputeManagerService: DisputeManagerService);
    create(user: CurrentUserPayload, createDisputeDto: CreateDisputeDto): Promise<{
        id: string;
        createdAt: Date;
        reason: string;
        updatedAt: Date;
        contractId: string;
        resolution: string | null;
        raisedById: string;
        evidenceUrls: string[];
        resolvedAt: Date | null;
    }>;
    findAll(): Promise<{
        id: string;
        createdAt: Date;
        reason: string;
        updatedAt: Date;
        contractId: string;
        resolution: string | null;
        raisedById: string;
        evidenceUrls: string[];
        resolvedAt: Date | null;
    }[]>;
    resolve(id: string, resolveDto: ResolveDisputeDto): Promise<{
        message: string;
        dispute: import(".prisma/client").Dispute;
    }>;
}
