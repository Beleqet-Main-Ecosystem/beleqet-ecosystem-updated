import { ArgumentsHost, ExceptionFilter, ValidationError } from '@nestjs/common';
import { I18nValidationError, I18nValidationException, I18nValidationExceptionFilterDetailedErrorsOption, I18nValidationExceptionFilterErrorFormatterOption } from '../interfaces';
type I18nValidationExceptionFilterOptions = I18nValidationExceptionFilterDetailedErrorsOption | I18nValidationExceptionFilterErrorFormatterOption;
export declare class I18nValidationExceptionFilter implements ExceptionFilter {
    private readonly options;
    constructor(options?: I18nValidationExceptionFilterOptions);
    catch(exception: I18nValidationException, host: ArgumentsHost): unknown;
    private createGraphQLError;
    private isWithErrorFormatter;
    protected normalizeValidationErrors(validationErrors: ValidationError[]): string[] | I18nValidationError[] | object;
    protected flattenValidationErrors(validationErrors: ValidationError[]): string[];
    protected buildResponseBody(host: ArgumentsHost, exc: I18nValidationException, error: string[] | I18nValidationError[] | object): Record<string, unknown>;
}
export {};
