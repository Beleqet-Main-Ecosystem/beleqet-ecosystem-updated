import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ResumeBrainService, UploadedResumeFile } from './resume-brain.service';
export declare class ResumeBrainController {
    private readonly resumeBrainService;
    constructor(resumeBrainService: ResumeBrainService);
    health(): {
        status: string;
        module: string;
    };
    upload(file: UploadedResumeFile): import("./resume-brain.service").UploadMetadata;
    parse(file: UploadedResumeFile): Promise<import("./resume-brain.service").ParsedResume>;
    extract(file: UploadedResumeFile, user: CurrentUserPayload): Promise<import("./resume-brain.service").ExtractedResumeResult>;
}
