import { ExecutionContext } from '@nestjs/common';
declare const GoogleLinkAuthGuard_base: import("@nestjs/passport").Type<import("@nestjs/passport").IAuthGuard>;
export declare class GoogleLinkAuthGuard extends GoogleLinkAuthGuard_base {
    getAuthenticateOptions(context: ExecutionContext): {
        state: string;
    };
}
export {};
