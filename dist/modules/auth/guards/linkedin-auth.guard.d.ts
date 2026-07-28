import { PreparedOAuthIdentity } from '../interfaces/prepared-oauth-identity.interface';
interface AuthFailureInfo {
    readonly message?: string;
}
declare const LinkedInAuthGuard_base: import("@nestjs/passport").Type<import("@nestjs/passport").IAuthGuard>;
export declare class LinkedInAuthGuard extends LinkedInAuthGuard_base {
    handleRequest<TUser = PreparedOAuthIdentity>(err: Error | null, user: TUser | false, info: AuthFailureInfo | undefined): TUser;
}
export {};
