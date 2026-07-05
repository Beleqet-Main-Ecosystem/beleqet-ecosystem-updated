import { HttpException, HttpStatus, ValidationError } from '@nestjs/common';
export type I18nValidationError = ValidationError;
export declare class I18nValidationException extends HttpException {
    errors: I18nValidationError[];
    readonly errorsAlreadyTranslated: boolean;
    constructor(errors: I18nValidationError[], status?: HttpStatus, errorsAlreadyTranslated?: boolean);
}
