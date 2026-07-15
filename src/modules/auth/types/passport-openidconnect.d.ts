/**
 * `passport-openidconnect` ships no official TypeScript types. This is a
 * deliberately minimal ambient declaration covering only the surface this
 * module actually uses (constructor options + the 7-arity verify
 * callback), so we can configure LinkedIn's OIDC endpoints with full type
 * safety and zero `any`.
 *
 * @remarks
 * If a future upgrade of `passport-openidconnect` changes the verify
 * callback arity it invokes by default, this declaration must be updated
 * to match — see the package's CHANGELOG for the exact arity your
 * installed version calls.
 */
declare module 'passport-openidconnect' {
  import { Strategy as PassportStrategyBase } from 'passport-strategy';

  /** Raw OIDC UserInfo claims, as returned by an OIDC-compliant provider. */
  export interface OidcProfileClaims {
    readonly sub?: string;
    readonly email?: string;
    readonly email_verified?: boolean;
    readonly given_name?: string;
    readonly family_name?: string;
    readonly name?: string;
    readonly picture?: string;
    readonly locale?: string;
  }

  export interface Profile {
    readonly id: string;
    readonly displayName?: string;
    readonly name?: {
      readonly givenName?: string;
      readonly familyName?: string;
    };
    readonly emails?: ReadonlyArray<{ readonly value: string }>;
    readonly photos?: ReadonlyArray<{ readonly value: string }>;
    /** Raw claims from the UserInfo endpoint / ID token. */
    readonly _json?: OidcProfileClaims;
  }

  export interface StrategyOptions {
    readonly issuer: string;
    readonly authorizationURL: string;
    readonly tokenURL: string;
    readonly userInfoURL: string;
    readonly clientID: string;
    readonly clientSecret: string;
    readonly callbackURL: string;
    readonly scope: string | ReadonlyArray<string>;
  }

  /**
   * Verify callback matching the library's 7-arity invocation form:
   * `(issuer, profile, context, idToken, accessToken, refreshToken, done)`.
   */
  export type VerifyCallback = (
    issuer: string,
    profile: Profile,
    context: unknown,
    idToken: string,
    accessToken: string,
    refreshToken: string | undefined,
    done: (error: Error | null, user?: unknown) => void,
  ) => void;

  export class Strategy extends PassportStrategyBase {
    constructor(options: StrategyOptions, verify: VerifyCallback);
  }
}

declare module 'passport-strategy' {
  export class Strategy {
    public name?: string;
  }
}
