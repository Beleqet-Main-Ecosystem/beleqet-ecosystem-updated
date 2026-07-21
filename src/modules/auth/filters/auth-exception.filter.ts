import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import {
  AuthDomainError,
  InvalidLinkConfirmationTokenError,
  ProviderIdentityAlreadyLinkedError,
  UnverifiedEmailLinkAttemptError,
} from '../errors/auth.errors';

/**
 * Translates {@link AuthDomainError} subtypes into HTTP responses,
 * keeping status-code decisions out of services/controllers so the
 * mapping lives in exactly one place.
 */
@Catch(AuthDomainError)
export class AuthExceptionFilter implements ExceptionFilter {
  public catch(exception: AuthDomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = this.resolveStatus(exception);

    response.status(status).json({
      statusCode: status,
      error: exception.name,
      message: exception.message,
    });
  }

  private resolveStatus(exception: AuthDomainError): number {
    if (exception instanceof UnverifiedEmailLinkAttemptError) {
      return HttpStatus.FORBIDDEN;
    }
    if (exception instanceof InvalidLinkConfirmationTokenError) {
      return HttpStatus.BAD_REQUEST;
    }
    if (exception instanceof ProviderIdentityAlreadyLinkedError) {
      return HttpStatus.CONFLICT;
    }
    return HttpStatus.BAD_REQUEST;
  }
}
