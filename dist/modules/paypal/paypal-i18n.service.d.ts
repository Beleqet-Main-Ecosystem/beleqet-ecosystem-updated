export declare class PaypalI18nService {
    private readonly logger;
    private readonly strings;
    translate(key: string, locale?: string, params?: Record<string, string | number>): string;
    t(key: string, locale?: string, params?: Record<string, string | number>): string;
    private interpolate;
    getAvailableKeys(): string[];
}
