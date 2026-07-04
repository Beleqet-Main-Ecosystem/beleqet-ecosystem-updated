import { KycProvider, KycVerificationResult } from './kyc-provider.interface';
export declare class MockKycProvider implements KycProvider {
    private readonly logger;
    verify(documentBuffer: Buffer, faceScanBuffer: Buffer): Promise<KycVerificationResult>;
}
