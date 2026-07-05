import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ApplicationsService } from './applications.service';
import { UsersService } from '../users/users.service';
import { CreateApplicationDto, UpdateApplicationStatusDto } from './dto/create-application.dto';
export declare class ApplicationsController {
    private readonly svc;
    private readonly usersSvc;
    constructor(svc: ApplicationsService, usersSvc: UsersService);
    submit(user: CurrentUserPayload, dto: CreateApplicationDto): Promise<any>;
    myApplications(user: CurrentUserPayload): Promise<any>;
    byJob(jobId: string, user: CurrentUserPayload): Promise<any>;
    findOne(id: string): Promise<any>;
    updateStatus(id: string, dto: UpdateApplicationStatusDto, user: CurrentUserPayload): Promise<any>;
    withdraw(id: string, user: CurrentUserPayload): Promise<any>;
    addFeedback(userId: string, feedback: any): Promise<any>;
    verifySkill(userId: string, status: boolean): Promise<any>;
}
