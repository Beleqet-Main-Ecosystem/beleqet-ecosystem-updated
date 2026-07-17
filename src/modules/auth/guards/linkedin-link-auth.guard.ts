import { BadRequestException, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

/**
 * LinkedIn counterpart to {@link GoogleLinkAuthGuard} — see its doc for
 * the full explanation of the state-passthrough mechanism.
 */
@Injectable()
export class LinkedInLinkAuthGuard extends AuthGuard('linkedin') {
  public getAuthenticateOptions(
    context: ExecutionContext,
  ): { state: string } {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.query.token;

    if (typeof token !== 'string' || token.length === 0) {
      throw new BadRequestException('Missing required "token" query parameter for link confirmation.');
    }

    return { state: `link:${token}` };
  }
}
