import { ITokenCipher } from '../interfaces/token-cipher.interface';
export declare class TokenEncryptionService implements ITokenCipher {
    private readonly key;
    constructor(key: Buffer);
    encrypt(plaintext: string): string;
    decrypt(ciphertext: string): string;
}
