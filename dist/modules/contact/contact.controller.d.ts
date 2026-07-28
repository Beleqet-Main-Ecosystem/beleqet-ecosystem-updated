import { ContactService } from './contact.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
export declare class ContactController {
    private readonly service;
    constructor(service: ContactService);
    create(dto: CreateContactMessageDto): Promise<{
        success: boolean;
        reference: string;
        receivedAt: Date;
    }>;
}
