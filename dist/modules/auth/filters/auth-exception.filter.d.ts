import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { AuthDomainError } from '../errors/auth.errors';
export declare class AuthExceptionFilter implements ExceptionFilter {
    catch(exception: AuthDomainError, host: ArgumentsHost): void;
    private resolveStatus;
}
