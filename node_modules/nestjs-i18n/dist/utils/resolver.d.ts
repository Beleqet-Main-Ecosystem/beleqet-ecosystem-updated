import { ExecutionContext } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { I18nResolver } from '../interfaces';
import { I18nOptionResolver } from '../interfaces/i18n-options.interface';
export declare function resolveLanguage(resolvers: I18nOptionResolver[], context: ExecutionContext, moduleRef: ModuleRef): Promise<string | string[] | null>;
export declare function getLanguageFromResolverResult(language: string | string[] | null): string | undefined;
export declare function getResolver(r: I18nOptionResolver, moduleRef: ModuleRef): Promise<I18nResolver>;
