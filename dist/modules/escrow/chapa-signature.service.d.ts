import { ConfigService } from '@nestjs/config';
export declare class ChapaSignatureService {
    private readonly config;
    constructor(config: ConfigService);
    verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean;
    hmac(value: string, secret: string): string;
    private header;
    private safeEquals;
    private normalizeSignature;
}
