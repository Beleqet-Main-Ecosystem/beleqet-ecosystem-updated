import { PrismaService } from '../../prisma/prisma.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
export declare class ContactService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateContactMessageDto): Promise<{
        success: boolean;
        reference: string;
        receivedAt: Date;
    }>;
}
