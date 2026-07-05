import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LinkedInAuthGuard extends AuthGuard('linkedin') {
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      console.error('LinkedIn auth failed — err:', err, 'info:', info);
      throw err || new UnauthorizedException(info?.message ?? 'LinkedIn auth failed');
    }
    return user;
  }
}
