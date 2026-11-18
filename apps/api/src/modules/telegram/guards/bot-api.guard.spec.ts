import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotApiGuard } from './bot-api.guard';

const context = (headers: Record<string, string>) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ headers }) }) }) as unknown as ExecutionContext;

const guard = (secret?: string) =>
  new BotApiGuard({ get: () => secret } as unknown as ConfigService);

describe('BotApiGuard', () => {
  it('lets the Jobs bot through with the shared secret', () => {
    expect(
      guard('s3cret-token').canActivate(context({ 'x-beleqet-api-token': 's3cret-token' })),
    ).toBe(true);
  });

  it('refuses a missing or wrong secret', () => {
    expect(() => guard('s3cret-token').canActivate(context({}))).toThrow(UnauthorizedException);
    expect(() =>
      guard('s3cret-token').canActivate(context({ 'x-beleqet-api-token': 'guess' })),
    ).toThrow(UnauthorizedException);
  });

  it('refuses everyone when no secret is configured', () => {
    expect(() => guard(undefined).canActivate(context({ 'x-beleqet-api-token': '' }))).toThrow(
      UnauthorizedException,
    );
  });
});
