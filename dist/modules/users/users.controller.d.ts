import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateUserDto, CreateCompanyDto, SaveCvDraftDto } from './dto/update-user.dto';
export declare class UsersController {
    private readonly svc;
    constructor(svc: UsersService);
    profile(u: CurrentUserPayload): Promise<any>;
    update(u: CurrentUserPayload, dto: UpdateUserDto): Promise<any>;
    getCompany(u: CurrentUserPayload): Promise<any>;
    createCompany(u: CurrentUserPayload, dto: CreateCompanyDto): Promise<any>;
    notifications(u: CurrentUserPayload): Promise<any>;
    markRead(id: string, u: CurrentUserPayload): Promise<any>;
    markAllRead(u: CurrentUserPayload): Promise<any>;
    savedJobs(u: CurrentUserPayload): Promise<any>;
    saveJob(jobId: string, u: CurrentUserPayload): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        userId: string;
        jobId: string;
    }>;
    removeSavedJob(jobId: string, u: CurrentUserPayload): Promise<{
        count: any;
    }>;
    cvDraft(u: CurrentUserPayload): Promise<any>;
    saveCvDraft(dto: SaveCvDraftDto, u: CurrentUserPayload): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        userId: string;
        data: Record<string, unknown>;
    }>;
}
