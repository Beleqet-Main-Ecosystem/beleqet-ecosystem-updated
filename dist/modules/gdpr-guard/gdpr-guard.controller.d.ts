import { GdprGuardService } from './gdpr-guard.service';
import { DataErasureRequestDto } from './dto/data-erasure-request.dto';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
export declare class GdprGuardController {
    private readonly gdprGuardService;
    constructor(gdprGuardService: GdprGuardService);
    requestErasure(dto: DataErasureRequestDto, admin: CurrentUserPayload): Promise<{
        success: boolean;
        scrubbedAt: string;
        referenceId: string;
    }>;
}
