import { ConfigService } from '@nestjs/config';
import { KycProvider, KycVerificationResult } from './kyc-provider.interface';
export declare class OpenAiKycProvider implements KycProvider {
    private readonly config;
    private readonly logger;
    private readonly openai;
    constructor(config: ConfigService);
    verify(documentBuffer: Buffer, faceScanBuffer: Buffer, documentMimeType?: string, faceScanMimeType?: string): Promise<KycVerificationResult>;
    private detectMimeType;
    private getFallbackResult;
}
