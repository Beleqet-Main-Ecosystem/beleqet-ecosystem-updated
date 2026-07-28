import { ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
export declare class GqlThrottlerGuard extends ThrottlerGuard {
    protected getRequestResponse(context: ExecutionContext): {
        req: any;
        res: any;
    };
}
