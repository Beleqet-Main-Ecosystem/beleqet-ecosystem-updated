import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';

@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateContactMessageDto) {
    const record = await this.prisma.contactMessage.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.toLowerCase().trim(),
        subject: dto.subject.trim(),
        message: dto.message.trim(),
      },
      select: { id: true, createdAt: true },
    });
    return { success: true, reference: record.id, receivedAt: record.createdAt };
  }
}
