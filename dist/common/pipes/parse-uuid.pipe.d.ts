import { PipeTransform } from '@nestjs/common';
export declare class ParseUUIDPipe implements PipeTransform<string> {
    transform(value: string): string;
}
