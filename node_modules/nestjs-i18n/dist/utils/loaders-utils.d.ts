import { Observable } from 'rxjs';
import { I18nLoader } from '../loaders/i18n.loader';
import { I18nTranslation } from '../interfaces/i18n-translation.interface';
export declare function processTranslations(loaders: I18nLoader[]): Promise<I18nTranslation | Observable<I18nTranslation>>;
export declare function processLanguages(loaders: I18nLoader[]): Promise<string[] | Observable<string[]>>;
