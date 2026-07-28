export declare class BackupCodeService {
    private readonly logger;
    generate(): {
        plainCodes: string[];
        hashedCodes: string[];
    };
    verify(code: string, hashedCode: string): boolean;
    private randomCode;
}
