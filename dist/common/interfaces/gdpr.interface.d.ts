export interface GdprCompliant {
    hasConsentedToProcessing: boolean;
}
export declare class GdprUtil {
    static maskPII(text: string): string;
}
