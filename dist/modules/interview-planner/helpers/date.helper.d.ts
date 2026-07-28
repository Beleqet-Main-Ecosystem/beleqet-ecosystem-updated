import { I18nService } from 'nestjs-i18n';
export declare class DateHelper {
    private readonly i18n;
    constructor(i18n: I18nService);
    validateRange(startTime: Date, endTime: Date): Promise<void>;
}
