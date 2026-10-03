import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * GraphQL-aware version of ThrottlerGuard.
 *
 * When a request is processed by a GraphQL resolver, context.switchToHttp()
 * returns undefined. This guard extracts the request and response objects from
 * the Apollo GqlExecutionContext if available.
 */
@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  protected getRequestResponse(context: ExecutionContext): {
    req: Record<string, any>;
    res: Record<string, any>;
  } {
    if (context.getType<string>() === 'graphql') {
      const gqlCtx = GqlExecutionContext.create(context);
      const ctx = gqlCtx.getContext<{ req?: Record<string, any>; res?: Record<string, any> }>();
      if (ctx?.req) {
        return { req: ctx.req, res: ctx.res ?? {} };
      }
    }
    return super.getRequestResponse(context);
  }
}
