import { ConfigService } from '@nestjs/config';
export declare const DEFAULT_VIDEO_MAX_BYTES: number;
export declare const DEFAULT_VIDEO_DOWNLOAD_TIMEOUT_MS = 120000;
export declare class FfmpegService {
    private readonly config;
    private readonly logger;
    constructor(config: ConfigService);
    downloadToTempFile(url: string): Promise<string>;
    extractAudioFromFile(inputPath: string): Promise<Buffer>;
    stripMetadataFromFile(inputPath: string): Promise<string>;
    getDurationSecondsFromFile(inputPath: string): Promise<number>;
    extractAudio(videoBuffer: Buffer, mimeType?: string): Promise<Buffer>;
    getDurationSeconds(videoBuffer: Buffer): Promise<number>;
    stripMetadata(videoBuffer: Buffer): Promise<Buffer>;
    private getMaxBytes;
    private getDownloadTimeoutMs;
    private createSizeLimitTransform;
    private guessExtFromUrl;
}
export declare function assertAllowedVideoUrl(videoUrl: string, config: ConfigService, errorMessage?: string): void;
export declare function collectAllowedVideoHosts(config: ConfigService): string[];
