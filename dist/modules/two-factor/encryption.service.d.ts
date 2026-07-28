import { ConfigService } from '@nestjs/config';
export declare class EncryptionService {
    private readonly logger;
    private readonly key;
    constructor(config: ConfigService);
    encrypt(plaintext: string): {
        ciphertext: string;
        keyVersion: string;
    };
    decrypt(ciphertext: string): string;
}
