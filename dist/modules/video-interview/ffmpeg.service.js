"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var FfmpegService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FfmpegService = exports.DEFAULT_VIDEO_DOWNLOAD_TIMEOUT_MS = exports.DEFAULT_VIDEO_MAX_BYTES = void 0;
exports.assertAllowedVideoUrl = assertAllowedVideoUrl;
exports.collectAllowedVideoHosts = collectAllowedVideoHosts;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const util_1 = require("util");
const promises_1 = require("stream/promises");
const stream_1 = require("stream");
const promises_2 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const crypto_1 = require("crypto");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
exports.DEFAULT_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
exports.DEFAULT_VIDEO_DOWNLOAD_TIMEOUT_MS = 120_000;
let FfmpegService = FfmpegService_1 = class FfmpegService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(FfmpegService_1.name);
    }
    async downloadToTempFile(url) {
        const maxBytes = this.getMaxBytes();
        const timeoutMs = this.getDownloadTimeoutMs();
        const abort = AbortSignal.timeout(timeoutMs);
        const response = await fetch(url, { redirect: 'error', signal: abort });
        if (!response.ok) {
            throw new Error(`Failed to fetch video: ${response.statusText}`);
        }
        if (!response.body) {
            throw new Error('Failed to fetch video: empty response body');
        }
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
            const declared = Number(contentLength);
            if (Number.isFinite(declared) && declared > maxBytes) {
                throw new Error(`Video exceeds maximum allowed size of ${maxBytes} bytes (Content-Length: ${declared})`);
            }
        }
        const ext = this.guessExtFromUrl(url);
        const outputPath = (0, path_1.join)((0, os_1.tmpdir)(), `beleqet-dl-${(0, crypto_1.randomUUID)()}.${ext}`);
        const nodeStream = stream_1.Readable.fromWeb(response.body);
        const sizeGuard = this.createSizeLimitTransform(maxBytes);
        const onAbort = () => {
            nodeStream.destroy(new Error(`Video download timed out after ${timeoutMs}ms`));
        };
        abort.addEventListener('abort', onAbort, { once: true });
        try {
            await (0, promises_1.pipeline)(nodeStream, sizeGuard, (0, fs_1.createWriteStream)(outputPath));
        }
        catch (err) {
            await (0, promises_2.unlink)(outputPath).catch(() => { });
            if (abort.aborted) {
                throw new Error(`Video download timed out after ${timeoutMs}ms`);
            }
            throw err;
        }
        finally {
            abort.removeEventListener('abort', onAbort);
        }
        this.logger.log(`Streamed video to disk: ${outputPath} (${sizeGuard.bytesRead} bytes)`);
        return outputPath;
    }
    async extractAudioFromFile(inputPath) {
        const outputPath = (0, path_1.join)((0, os_1.tmpdir)(), `beleqet-${(0, crypto_1.randomUUID)()}.wav`);
        try {
            await execFileAsync('ffmpeg', [
                '-i',
                inputPath,
                '-vn',
                '-acodec',
                'pcm_s16le',
                '-ar',
                '16000',
                '-ac',
                '1',
                '-y',
                outputPath,
            ]);
            const audioBuffer = await (0, promises_2.readFile)(outputPath);
            this.logger.log(`Audio extracted: ${audioBuffer.length} bytes from ${inputPath}`);
            return audioBuffer;
        }
        finally {
            await (0, promises_2.unlink)(outputPath).catch(() => { });
        }
    }
    async stripMetadataFromFile(inputPath) {
        const outputPath = (0, path_1.join)((0, os_1.tmpdir)(), `beleqet-clean-${(0, crypto_1.randomUUID)()}.webm`);
        await execFileAsync('ffmpeg', [
            '-i',
            inputPath,
            '-map_metadata',
            '-1',
            '-c',
            'copy',
            '-y',
            outputPath,
        ]);
        return outputPath;
    }
    async getDurationSecondsFromFile(inputPath) {
        const { stdout } = await execFileAsync('ffprobe', [
            '-v',
            'error',
            '-show_entries',
            'format=duration',
            '-of',
            'default=noprint_wrappers=1:nokey=1',
            inputPath,
        ]);
        return parseFloat(stdout.trim()) || 0;
    }
    async extractAudio(videoBuffer, mimeType = 'video/webm') {
        const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('mov') ? 'mov' : 'webm';
        const inputPath = (0, path_1.join)((0, os_1.tmpdir)(), `beleqet-${(0, crypto_1.randomUUID)()}.${ext}`);
        try {
            await (0, promises_2.writeFile)(inputPath, videoBuffer);
            return await this.extractAudioFromFile(inputPath);
        }
        finally {
            await (0, promises_2.unlink)(inputPath).catch(() => { });
        }
    }
    async getDurationSeconds(videoBuffer) {
        const inputPath = (0, path_1.join)((0, os_1.tmpdir)(), `beleqet-probe-${(0, crypto_1.randomUUID)()}.webm`);
        try {
            await (0, promises_2.writeFile)(inputPath, videoBuffer);
            return await this.getDurationSecondsFromFile(inputPath);
        }
        finally {
            await (0, promises_2.unlink)(inputPath).catch(() => { });
        }
    }
    async stripMetadata(videoBuffer) {
        const inputPath = (0, path_1.join)((0, os_1.tmpdir)(), `beleqet-in-${(0, crypto_1.randomUUID)()}.webm`);
        let outputPath = '';
        try {
            await (0, promises_2.writeFile)(inputPath, videoBuffer);
            outputPath = await this.stripMetadataFromFile(inputPath);
            return await (0, promises_2.readFile)(outputPath);
        }
        finally {
            await Promise.allSettled([
                (0, promises_2.unlink)(inputPath).catch(() => { }),
                outputPath ? (0, promises_2.unlink)(outputPath).catch(() => { }) : Promise.resolve(),
            ]);
        }
    }
    getMaxBytes() {
        const raw = this.config.get('VIDEO_INTERVIEW_MAX_BYTES');
        const parsed = raw ? Number(raw) : exports.DEFAULT_VIDEO_MAX_BYTES;
        return Number.isFinite(parsed) && parsed > 0 ? parsed : exports.DEFAULT_VIDEO_MAX_BYTES;
    }
    getDownloadTimeoutMs() {
        const raw = this.config.get('VIDEO_INTERVIEW_DOWNLOAD_TIMEOUT_MS');
        const parsed = raw ? Number(raw) : exports.DEFAULT_VIDEO_DOWNLOAD_TIMEOUT_MS;
        return Number.isFinite(parsed) && parsed > 0 ? parsed : exports.DEFAULT_VIDEO_DOWNLOAD_TIMEOUT_MS;
    }
    createSizeLimitTransform(maxBytes) {
        let bytesRead = 0;
        const transform = new stream_1.Transform({
            transform(chunk, _encoding, callback) {
                bytesRead += chunk.length;
                transform.bytesRead = bytesRead;
                if (bytesRead > maxBytes) {
                    callback(new Error(`Video exceeds maximum allowed size of ${maxBytes} bytes`));
                    return;
                }
                callback(null, chunk);
            },
        });
        transform.bytesRead = 0;
        return transform;
    }
    guessExtFromUrl(url) {
        try {
            const pathname = new URL(url).pathname.toLowerCase();
            if (pathname.endsWith('.mp4'))
                return 'mp4';
            if (pathname.endsWith('.mov'))
                return 'mov';
            if (pathname.endsWith('.webm'))
                return 'webm';
        }
        catch {
        }
        return 'webm';
    }
};
exports.FfmpegService = FfmpegService;
exports.FfmpegService = FfmpegService = FfmpegService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], FfmpegService);
function assertAllowedVideoUrl(videoUrl, config, errorMessage = 'Video URL host is not allowed.') {
    let parsed;
    try {
        parsed = new URL(videoUrl);
    }
    catch {
        throw new common_1.BadRequestException(errorMessage);
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new common_1.BadRequestException(errorMessage);
    }
    if (parsed.username || parsed.password) {
        throw new common_1.BadRequestException(errorMessage);
    }
    const host = parsed.hostname.toLowerCase();
    if (isBlockedLiteralHost(host) || isPrivateOrLinkLocalIp(host)) {
        const allowed = collectAllowedVideoHosts(config);
        if (!hostMatchesAllowlist(host, allowed)) {
            throw new common_1.BadRequestException(errorMessage);
        }
        return;
    }
    const allowed = collectAllowedVideoHosts(config);
    if (allowed.length === 0 || !hostMatchesAllowlist(host, allowed)) {
        throw new common_1.BadRequestException(errorMessage);
    }
}
function collectAllowedVideoHosts(config) {
    const hosts = new Set();
    const addFromUrl = (value) => {
        if (!value)
            return;
        try {
            const u = new URL(value.includes('://') ? value : `https://${value}`);
            if (u.hostname)
                hosts.add(u.hostname.toLowerCase());
        }
        catch {
        }
    };
    addFromUrl(config.get('R2_PUBLIC_BASE_URL'));
    addFromUrl(config.get('CDN_BASE_URL'));
    addFromUrl(config.get('AWS_ENDPOINT'));
    addFromUrl(config.get('API_BASE_URL'));
    const bucket = config.get('R2_BUCKET_NAME') ?? config.get('AWS_S3_BUCKET', 'beleqet-uploads');
    const region = config.get('AWS_REGION', 'us-east-1');
    hosts.add(`${bucket}.s3.${region}.amazonaws.com`);
    hosts.add(`${bucket}.s3.amazonaws.com`);
    hosts.add('s3.amazonaws.com');
    const extra = config.get('VIDEO_URL_ALLOWED_HOSTS', '');
    for (const part of extra.split(',')) {
        const h = part.trim().toLowerCase();
        if (h)
            hosts.add(h);
    }
    return [...hosts];
}
function hostMatchesAllowlist(host, allowed) {
    return allowed.some((entry) => host === entry || host.endsWith(`.${entry}`));
}
function isBlockedLiteralHost(host) {
    return (host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '0.0.0.0' ||
        host === '::1' ||
        host === 'metadata.google.internal' ||
        host === '169.254.169.254');
}
function isPrivateOrLinkLocalIp(host) {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (!m)
        return false;
    const octets = m.slice(1).map(Number);
    if (octets.some((o) => o > 255))
        return true;
    const [a, b] = octets;
    if (a === 10)
        return true;
    if (a === 127)
        return true;
    if (a === 0)
        return true;
    if (a === 169 && b === 254)
        return true;
    if (a === 172 && b >= 16 && b <= 31)
        return true;
    if (a === 192 && b === 168)
        return true;
    return false;
}
//# sourceMappingURL=ffmpeg.service.js.map