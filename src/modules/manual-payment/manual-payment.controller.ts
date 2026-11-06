import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentStatus } from '@prisma/client';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../../common/guards/verified-email.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MulterFile } from '../uploads/interfaces/multer-file.interface';
import { UPLOAD_FILE_INTERCEPTOR_OPTIONS } from '../uploads/uploads.controller';
import { CreateManualPaymentDto, SubmitManualPaymentDto } from './dto/submit-manual-payment.dto';
import { ManualPaymentRecord, ManualPaymentService } from './manual-payment.service';

@ApiTags('manual-payment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('manual-payment')
export class ManualPaymentController {
  constructor(private readonly manualPaymentService: ManualPaymentService) {}

  @Post()
  @UseGuards(VerifiedEmailGuard)
  @ApiOperation({ summary: 'Create a new pending manual payment record' })
  async create(
    @Req() req: Request & { user: { userId: string } },
    @Body()
    body: CreateManualPaymentDto,
  ): Promise<ManualPaymentRecord> {
    return this.manualPaymentService.createManualPayment(req.user.userId, body);
  }

  @Post('submit-receipt')
  @ApiOperation({
    summary: 'Upload payment receipt + reference number for a pending manual payment',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('receipt', UPLOAD_FILE_INTERCEPTOR_OPTIONS))
  async submitReceipt(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: SubmitManualPaymentDto,
    @UploadedFile() file: MulterFile,
  ): Promise<ManualPaymentRecord> {
    return this.manualPaymentService.submitReceipt(dto, file, req.user.userId);
  }

  @Get('admin')
  @ApiOperation({ summary: '[Admin] List all manual payments (paginated)' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ): Promise<ManualPaymentRecord[]> {
    const known = Object.values(PaymentStatus) as string[];
    if (status && !known.includes(status))
      throw new BadRequestException(`status must be one of ${known.join(', ')}`);
    return this.manualPaymentService.findAll(
      page,
      Math.min(limit, 100),
      status as PaymentStatus | undefined,
    );
  }

  @Patch('admin/:id/approve')
  @ApiOperation({ summary: '[Admin] Approve a manual payment' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async approve(
    @Param('id') id: string,
    @CurrentUser() admin: CurrentUserPayload,
  ): Promise<ManualPaymentRecord> {
    return this.manualPaymentService.approvePayment(id, admin.userId);
  }

  @Patch('admin/:id/reject')
  @ApiOperation({ summary: '[Admin] Reject a manual payment' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async reject(
    @Param('id') id: string,
    @CurrentUser() admin: CurrentUserPayload,
    @Body() body: { reason?: string },
  ): Promise<ManualPaymentRecord> {
    return this.manualPaymentService.rejectPayment(id, admin.userId, body?.reason);
  }

  @Get('admin/:id/receipt')
  @ApiOperation({ summary: '[Admin] Get viewable/presigned URL for receipt' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async getReceiptUrl(
    @Param('id') id: string,
    @CurrentUser() admin: CurrentUserPayload,
  ): Promise<{ url: string }> {
    return this.manualPaymentService.getReceiptViewUrl(id, admin.userId, true);
  }

  /** The caller's own bank-transfer payments, newest first: their billing history. */
  @Get('mine')
  @ApiOperation({ summary: 'My manual payments' })
  async mine(@Req() req: Request & { user: { userId: string } }): Promise<ManualPaymentRecord[]> {
    return this.manualPaymentService.findMine(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of your manual payments by id (admins: any)' })
  async findOne(
    @Param('id') id: string,
    @Req() req: Request & { user: { userId: string; role?: string } },
  ): Promise<ManualPaymentRecord> {
    return this.manualPaymentService.findOne(id, req.user.userId, req.user.role === 'ADMIN');
  }
}
