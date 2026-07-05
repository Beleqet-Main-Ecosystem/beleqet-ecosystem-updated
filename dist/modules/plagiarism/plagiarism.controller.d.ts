import { CheckPlagiarismDto } from './dto/check-plagiarism.dto';
import { PlagiarismService } from './plagiarism.service';
export declare class PlagiarismController {
    private readonly plagiarismService;
    constructor(plagiarismService: PlagiarismService);
    check(dto: CheckPlagiarismDto): Promise<import("./types/plagiarism.types").PlagiarismCheckResult>;
    getHistory(limit?: string): Promise<import("./types/plagiarism.types").PlagiarismCheckResult[]>;
    getCheckById(checkId: string): Promise<import("./types/plagiarism.types").PlagiarismCheckResult>;
}
