import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { CurrentUserPayload } from './current-user.decorator';

/**
 * Extracts the authenticated user from the GraphQL execution context.
 *
 * The REST equivalent is @CurrentUser() (current-user.decorator.ts), which
 * reads from the HTTP request. This decorator does the same but for GraphQL
 * resolvers, where the request lives inside the Apollo context object rather
 * than directly on the NestJS execution context.
 *
 * JwtStrategy populates req.user with { userId, email, role } — this
 * decorator surfaces that payload as the parameter value, preventing the
 * common mistake of reading `user.id` (undefined) instead of `user.userId`.
 *
 * @example
 *   async createJob(@Args('input') input: CreateJobInput, @GqlCurrentUser() user: CurrentUserPayload)
 */
export const GqlCurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUserPayload => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req.user as CurrentUserPayload;
  },
);
