import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { FreelanceService, CreateFreelanceJobDto, CreateBidDto, CreateMilestoneDto } from './freelance.service';
import { EscrowService } from '../escrow/escrow.service';
export declare class FreelanceController {
    private readonly svc;
    private readonly escrowSvc;
    constructor(svc: FreelanceService, escrowSvc: EscrowService);
    findJobs(q: {
        q?: string;
        category?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        items: any;
        total: any;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    findJob(id: string): Promise<any>;
    createJob(u: CurrentUserPayload, dto: CreateFreelanceJobDto): Promise<any>;
    submitBid(id: string, u: CurrentUserPayload, dto: CreateBidDto): Promise<any>;
    acceptBid(id: string, u: CurrentUserPayload): Promise<any>;
    rejectBid(id: string, u: CurrentUserPayload): Promise<any>;
    myBids(u: CurrentUserPayload): Promise<any>;
    myContracts(u: CurrentUserPayload): Promise<any>;
    contract(id: string): Promise<any>;
    createMilestone(id: string, u: CurrentUserPayload, dto: CreateMilestoneDto): Promise<any>;
    approveMilestone(id: string, u: CurrentUserPayload): Promise<{
        success: boolean;
    }>;
}
