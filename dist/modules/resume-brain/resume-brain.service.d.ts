import { DocumentParserService } from './document-parser.service';
import { AIExtractorService } from './ai-extractor.service';
import { AiBudgetService } from './ai-budget.service';
import { ResumeValidatorService } from './resume-validator.service';
import { ProfileMapperService, UserProfileUpdate } from './profile-mapper.service';
import { ExtractedResume } from './dto/extracted-resume.dto';
export interface UploadedResumeFile {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
}
export interface UploadMetadata {
    filename: string;
    mimetype: string;
    size: number;
}
export interface ParsedResume extends UploadMetadata {
    text: string;
}
export interface ExtractedResumeResult extends UploadMetadata {
    provider: string;
    profile: ExtractedResume;
    userProfile: UserProfileUpdate;
}
export declare class ResumeBrainService {
    private readonly documentParser;
    private readonly aiExtractor;
    private readonly aiBudget;
    private readonly resumeValidator;
    private readonly profileMapper;
    private readonly logger;
    constructor(documentParser: DocumentParserService, aiExtractor: AIExtractorService, aiBudget: AiBudgetService, resumeValidator: ResumeValidatorService, profileMapper: ProfileMapperService);
    health(): {
        status: string;
        module: string;
    };
    describeUpload(file?: UploadedResumeFile): UploadMetadata;
    parseResume(file?: UploadedResumeFile): Promise<ParsedResume>;
    extractProfile(file?: UploadedResumeFile, userId?: string): Promise<ExtractedResumeResult>;
    private assertSupportedType;
    private assertMagicNumber;
}
