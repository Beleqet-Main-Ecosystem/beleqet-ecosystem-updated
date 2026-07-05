import { CliOptions, ParsedCliOptions } from '../interfaces/cli.interface';
export declare function renderLogoWithVersion(logo: string, version: string): string;
export declare function getDefaultPattern(format: NonNullable<CliOptions['format']>): string;
export declare function getOptionValue(args: string[], index: number, optionName: string): string;
export declare function parseArgs(args: string[]): ParsedCliOptions;
export declare function renderHelp(): string;
export declare function printHelp(): void;
export declare function main(): Promise<void>;
