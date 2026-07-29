import { ConfigService } from '@nestjs/config';
import { ChapaInitializeRequest, ChapaInitializeResponse, ChapaTransferRequest, ChapaTransferResponse, ChapaVerifyResponse } from './chapa.types';
export declare class ChapaClient {
    private readonly config;
    private readonly baseUrl;
    constructor(config: ConfigService);
    initializePayment(request: ChapaInitializeRequest): Promise<ChapaInitializeResponse>;
    verifyTransaction(txRef: string): Promise<ChapaVerifyResponse>;
    createTransfer(request: ChapaTransferRequest): Promise<ChapaTransferResponse>;
    verifyTransfer(reference: string): Promise<ChapaTransferResponse>;
    private get;
    private post;
    private headers;
    private parse;
}
