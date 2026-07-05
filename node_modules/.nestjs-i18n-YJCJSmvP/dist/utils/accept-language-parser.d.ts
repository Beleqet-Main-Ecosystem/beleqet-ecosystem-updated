export interface ParsedLanguage {
    code: string;
    script: string | null;
    region: string | null;
    quality: number;
}
export declare function parse(al: string): ParsedLanguage[];
export declare function pick(supportedLanguages: string[], acceptLanguage: string | ParsedLanguage[], options?: {
    loose?: boolean;
}): string | null;
