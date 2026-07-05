import { I18nLoader } from './i18n.loader';
import { OnModuleDestroy } from '@nestjs/common';
import { I18nTranslation } from '../interfaces';
import { Observable } from 'rxjs';
export interface I18nAbstractLoaderOptions {
    path: string;
    includeSubfolders?: boolean;
    filePattern?: string;
    watch: boolean;
}
export declare abstract class I18nAbstractLoader extends I18nLoader implements OnModuleDestroy {
    private options;
    private readonly logger;
    private watcher?;
    private events;
    private languagesCache;
    constructor(options: I18nAbstractLoaderOptions);
    onModuleDestroy(): Promise<void>;
    languages(): Promise<string[] | Observable<string[]>>;
    load(): Promise<I18nTranslation | Observable<I18nTranslation>>;
    protected parseTranslations(eventInfo?: {
        event: string;
        filePath: string;
    }): Promise<I18nTranslation>;
    protected assignPrefixedTranslation(translations: I18nTranslation, prefix: string[], property: string, value: any): void;
    protected parseLanguages(): Promise<string[]>;
    private getCachedLanguages;
    protected sanitizeOptions(options: I18nAbstractLoaderOptions): I18nAbstractLoaderOptions;
    private parseFilePattern;
    abstract formatData(data: any): any;
    abstract getDefaultOptions(): Partial<I18nAbstractLoaderOptions>;
}
