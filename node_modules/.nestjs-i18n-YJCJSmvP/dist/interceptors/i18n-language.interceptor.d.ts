import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Observable } from 'rxjs';
import { I18nOptionResolver, I18nOptions } from '../interfaces';
import { I18nService } from '../services/i18n.service';
import { I18nMessageFormat } from '../utils';
export declare class I18nLanguageInterceptor implements NestInterceptor {
    private readonly i18nOptions;
    private readonly i18nResolvers;
    private readonly i18nService;
    private readonly messageFormat;
    private readonly moduleRef;
    constructor(i18nOptions: I18nOptions, i18nResolvers: I18nOptionResolver[], i18nService: I18nService, messageFormat: I18nMessageFormat, moduleRef: ModuleRef);
    intercept(context: ExecutionContext, next: CallHandler<any>): Promise<Observable<any>>;
}
