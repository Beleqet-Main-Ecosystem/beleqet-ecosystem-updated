import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsString, validateSync } from 'class-validator';

enum Environment {
    Development = 'development',
    Production = 'production',
    Test = 'test',
}

export class EnvironmentVariables {
    @IsEnum(Environment)
    NODE_ENV: Environment;

    @IsNumber()
    PORT: number;

    @IsString()
    DATABASE_URL: string;

    @IsString()
    JWT_ACCESS_SECRET: string; // Adjusted to match docker-compose

    @IsString()
    REDIS_HOST: string;

    @IsNumber()
    REDIS_PORT: number;
}

export function validate(config: Record<string, any>) {
    const validatedConfig = plainToInstance(EnvironmentVariables, config, {
        enableImplicitConversion: true,
    });
    const errors = validateSync(validatedConfig, { skipMissingProperties: false });

    if (errors.length > 0) {
        throw new Error(`Global Config Validation Failed: ${errors.toString()}`);
    }
    return validatedConfig;
}