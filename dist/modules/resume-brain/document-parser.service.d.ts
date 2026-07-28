import { UploadedResumeFile } from './resume-brain.service';
export declare class DocumentParserService {
    private readonly logger;
    extractText(file: UploadedResumeFile): Promise<string>;
    private detectKind;
    private parsePdf;
    private parseDocx;
    private normalize;
}
