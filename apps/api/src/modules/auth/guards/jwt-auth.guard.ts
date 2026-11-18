import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Protects a route with the short-lived JWT access token. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
