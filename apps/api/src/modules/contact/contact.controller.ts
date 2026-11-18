import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly service: ContactService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a support or partnership message' })
  create(@Body() dto: CreateContactMessageDto) {
    return this.service.create(dto);
  }
}
