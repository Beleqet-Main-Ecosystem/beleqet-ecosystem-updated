export interface RefreshTokenSnapshot {
    readonly id: string;
    readonly userId: string;
    readonly expiresAt: Date;
}
export interface IRefreshTokenRepository {
    create(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
    findByHash(tokenHash: string): Promise<RefreshTokenSnapshot | null>;
    deleteById(id: string): Promise<void>;
    deleteAllForUser(userId: string): Promise<void>;
}
export declare const REFRESH_TOKEN_REPOSITORY: unique symbol;
