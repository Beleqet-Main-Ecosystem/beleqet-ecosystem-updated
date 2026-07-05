// auth.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  RefreshDto,
  VerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/register.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Audit } from '../audit-trail/audit.decorator';
import { AuditAction } from '../audit-trail/audit-action.enum';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @Audit(AuditAction.AUTH_REGISTER, 'User')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive JWT tokens' })
  @Audit(AuditAction.AUTH_LOGIN, 'User')
  async login(@Body() dto: LoginDto, @Request() req: any) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    const userAgent = req.headers['user-agent'];
    return this.authService.login(user, userAgent);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Audit(AuditAction.AUTH_LOGOUT, 'User')
  logout(@Request() req: Express.Request & { user: { userId: string } }) {
    return this.authService.logout(req.user.userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get authenticated user profile' })
  me(@Request() req: Express.Request & { user: { userId: string; email: string; role: string } }) {
    return req.user;
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify user email via token' })
  @Audit(AuditAction.AUTH_EMAIL_VERIFIED, 'User')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password via token' })
  @Audit(AuditAction.AUTH_PASSWORD_RESET_COMPLETED, 'User')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }
}
