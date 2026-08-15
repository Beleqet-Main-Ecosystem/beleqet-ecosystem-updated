import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MulterFile } from '../uploads/interfaces/multer-file.interface';
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
    @Req() req: Request & { user: { id: string } },
    @Body()
    body: { amount: number; currency: string; description?: string },
  ): Promise<ManualPaymentRecord> {
    return this.manualPaymentService.createManualPayment(
      req.user.id,
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
  @UseInterceptors(FileInterceptor('receipt'))
  async submitReceipt(
    @Req() req: Request & { user: { id: string } },
    @Body() dto: SubmitManualPaymentDto,
    @UploadedFile() file: MulterFile,
  ): Promise<ManualPaymentRecord> {
    return this.manualPaymentService.submitReceipt(dto, file, req.user.id);
  }

  @Get('admin')
  @ApiOperation({ summary: '[Admin] List all manual payments (paginated)' })
  async list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<ManualPaymentRecord[]> {
    return this.manualPaymentService.findAll(page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single manual payment by id' })
  async findOne(@Param('id') id: string): Promise<ManualPaymentRecord> {
    return this.manualPaymentService.findOne(id);
  }
}
