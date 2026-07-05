import { ExecutionContext } from '@nestjs/common';
import { I18nResolver } from '../interfaces';
export declare class GraphQLWebsocketResolver implements I18nResolver {
    resolve(context: ExecutionContext): Promise<string | string[] | undefined>;
}
