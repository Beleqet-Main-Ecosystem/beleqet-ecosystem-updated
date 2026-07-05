import { ConfigService } from '@nestjs/config';
export declare class PaypalAuthService {
    private readonly config;
    private readonly logger;
    private cachedToken;
    private tokenExpiresAt;
    private readonly REFRESH_BUFFER_MS;
    constructor(config: ConfigService);
    getAccessToken(): Promise<string>;
    private refreshToken;
    getBaseUrl(): string;
    invalidateToken(): void;
    getTokenExpiresAt(): Date | null;
}
