export interface KycVerificationResult {
    matchScore: number;
    livenessPassed: boolean;
    isDocumentValid: boolean;
    extractedName?: string;
    extractedIdNumber?: string;
    rejectionReason?: string;
}
export interface KycProvider {
    verify(documentBuffer: Buffer, faceScanBuffer: Buffer): Promise<KycVerificationResult>;
}
