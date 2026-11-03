import { ArgumentsHost, Catch, ExceptionFilter, Inject, Logger } from '@nestjs/common';
import { Response } from 'express';
import { AUTH_ENV_CONFIG, AuthEnvConfig } from '../config/auth.config';

/**
 * A Google or LinkedIn sign-in that fails (the person cancels, the provider errors, the
 * account is disabled) sends the browser back to the sign-in page instead of showing JSON.
 */
@Catch()
export class OAuthFailureFilter implements ExceptionFilter {
  private readonly logger = new Logger(OAuthFailureFilter.name);

  constructor(@Inject(AUTH_ENV_CONFIG) private readonly config: AuthEnvConfig) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    this.logger.warn(
      `OAuth sign-in failed: ${exception instanceof Error ? exception.message : String(exception)}`,
    );
    host
      .switchToHttp()
      .getResponse<Response>()
      .redirect(`${this.config.frontendUrl}/login?oauth=failed`);
  }
}
