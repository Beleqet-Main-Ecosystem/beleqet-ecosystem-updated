export interface ITokenCipher {
    encrypt(plaintext: string): string;
    decrypt(ciphertext: string): string;
}
export declare const TOKEN_CIPHER: unique symbol;
