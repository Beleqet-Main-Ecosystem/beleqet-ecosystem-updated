import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { WsException } from '@nestjs/websockets';

/**
 * WebSocket-compatible ThrottlerGuard.
 *
 * Prevents standard NestJS `@nestjs/throttler` crashes when handling non-HTTP
 * WebSocket contexts by safely mocking the response object and extracting IP address
 * from the socket handshake.
 */
@Injectable()
export class WsThrottlerGuard extends ThrottlerGuard {
  /**
   * Extracts the client IP address from socket handshake headers or remote address.
   */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return (
      req?.handshake?.headers?.['x-forwarded-for'] ||
      req?.conn?.remoteAddress ||
      req?.request?.connection?.remoteAddress ||
      'unknown-ip'
    );
  }

  /**
   * Provides request/response object mapping for WebSocket contexts.
   * Injects a no-op `header` function on the dummy response so `@nestjs/throttler`
   * does not throw `res.header is not a function`.
   */
  protected getRequestResponse(context: ExecutionContext) {
    if (context.getType() === 'ws') {
      const wsClient = context.switchToWs().getClient();
      return { req: wsClient, res: { header: () => {} } };
    }
    return super.getRequestResponse(context);
  }

  /**
   * Throws a `WsException` instead of HTTP `ThrottlerException` when limits are exceeded.
   */
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail?: any,
  ): Promise<void> {
    if (context.getType() === 'ws') {
      throw new WsException('Rate limit exceeded');
    }
    await super.throwThrottlingException(context, throttlerLimitDetail);
  }
}

