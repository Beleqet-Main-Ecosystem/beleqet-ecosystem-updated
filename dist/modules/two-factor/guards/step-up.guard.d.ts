import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
export declare class StepUpGuard implements CanActivate {
    private readonly reflector;
    private readonly jwt;
    private readonly prisma;
    private readonly logger;
    private readonly tempSecret;
    private readonly accessSecret;
    constructor(reflector: Reflector, jwt: JwtService, prisma: PrismaService, config: ConfigService);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private validateStepUpExpiry;
    private validateActionScope;
    private tryVerifyStepUp;
    private tryVerifyAccess;
    private generateStepUpChallenge;
}
