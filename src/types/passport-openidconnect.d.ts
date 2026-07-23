declare module 'passport-openidconnect' {
  import { Strategy as PassportStrategy } from 'passport';

  export interface StrategyOptions {
    issuer: string;
    authorizationURL: string;
    tokenURL: string;
    userInfoURL: string;
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
  }

  export interface Profile {
    id: string;
    displayName?: string;
    name?: {
      givenName?: string;
      familyName?: string;
    };
    emails?: Array<{ value: string }>;
    photos?: Array<{ value: string }>;
    _json?: Record<string, any>;
  }

  export class Strategy extends PassportStrategy {
    constructor(options: StrategyOptions, verify: Function);
  }
}
