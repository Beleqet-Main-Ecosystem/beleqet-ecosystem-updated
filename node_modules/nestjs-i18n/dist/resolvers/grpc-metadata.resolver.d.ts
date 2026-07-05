import { ExecutionContext } from '@nestjs/common';
import { I18nResolver } from '../interfaces';
export declare class GrpcMetadataResolver implements I18nResolver {
    private keys;
    constructor(keys?: string[]);
    resolve(context: ExecutionContext): Promise<string | string[] | undefined>;
}
