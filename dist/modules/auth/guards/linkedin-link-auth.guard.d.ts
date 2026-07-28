import { ExecutionContext } from '@nestjs/common';
declare const LinkedInLinkAuthGuard_base: import("@nestjs/passport").Type<import("@nestjs/passport").IAuthGuard>;
export declare class LinkedInLinkAuthGuard extends LinkedInLinkAuthGuard_base {
    getAuthenticateOptions(context: ExecutionContext): {
        state: string;
    };
}
export {};
