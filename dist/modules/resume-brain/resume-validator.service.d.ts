import { ExtractedResume } from './dto/extracted-resume.dto';
export declare class ResumeValidatorService {
    private readonly logger;
    validate(input: unknown): ExtractedResume;
    private isEmpty;
    private flatten;
}
