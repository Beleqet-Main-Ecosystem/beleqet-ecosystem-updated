import { type MessageFunction } from '@messageformat/core';
import { I18nOptions } from '../interfaces/i18n-options.interface';
export declare class I18nMessageFormat {
    private readonly i18nOptions;
    private readonly messageFormats;
    constructor(i18nOptions: I18nOptions);
    get enabled(): boolean;
    compile(message: string, locale: string): MessageFunction<'string'>;
}
