import {
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
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MulterFile } from '../uploads/interfaces/multer-file.interface';
import { UPLOAD_FILE_INTERCEPTOR_OPTIONS } from '../uploads/uploads.controller';
import { SubmitManualPaymentDto } from './dto/submit-manual-payment.dto';
import { ManualPaymentRecord, ManualPaymentService } from './manual-payment.service';

@ApiTags('manual-payment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('manual-payment')
export class ManualPaymentController {
  constructor(private readonly manualPaymentService: ManualPaymentService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new pending manual payment record' })
  async create(
    @Req() req: Request & { user: { userId: string } },
    @Body()
    body: { amount: number; currency: string; description?: string },
  ): Promise<ManualPaymentRecord> {
    return this.manualPaymentService.createManualPayment(
      req.user.userId,
      body.amount,
      body.currency,
      body.description,
    );
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
  ): Promise<ManualPaymentRecord[]> {
    return this.manualPaymentService.findAll(page, limit);
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

  @Get(':id')
  @ApiOperation({ summary: 'Get a single manual payment by id' })
  async findOne(@Param('id') id: string): Promise<ManualPaymentRecord> {
    return this.manualPaymentService.findOne(id);
  }
}
