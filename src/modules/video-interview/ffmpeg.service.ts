import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { createWriteStream } from 'fs';
import { promisify } from 'util';
import { pipeline } from 'stream/promises';
import { Readable, Transform } from 'stream';
import { writeFile, unlink, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

const execFileAsync = promisify(execFile);

/** Default max download size for interview videos (100 MiB). */
export const DEFAULT_VIDEO_MAX_BYTES = 100 * 1024 * 1024;

/** Default overall download deadline (2 minutes) — blocks tarpit / slow-loris streams. */
export const DEFAULT_VIDEO_DOWNLOAD_TIMEOUT_MS = 120_000;

/**
 * Service for FFmpeg-based video pre-processing before Whisper transcription.
 *
 * Responsibilities:
 * - Stream remote videos to disk with hard size limits (DoS protection).
 * - Extract audio track from WebM/MP4 video as 16 kHz mono WAV (Whisper optimal format).
 * - Validate video duration against the question's `durationSec` limit.
 * - Strip video metadata (EXIF, GPS) for GDPR compliance before upload.
 *
 * All processing happens in `/tmp` and temp files are deleted immediately after use.
 * FFmpeg must be available on PATH (included in the Docker image).
 */
@Injectable()
export class FfmpegService {
  private readonly logger = new Logger(FfmpegService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Stream a remote video URL directly to a temp file without buffering the body in RAM.
   * Enforces a hard byte cap, overall download deadline (tarpit protection),
   * and refuses to follow redirects (SSRF/DoS hardening).
   *
   * @param url  Public or signed URL of the uploaded interview video.
   * @returns    Path to the written temp file (caller must delete).
   */
  async downloadToTempFile(url: string): Promise<string> {
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
        throw new Error(
          `Video exceeds maximum allowed size of ${maxBytes} bytes (Content-Length: ${declared})`,
        );
      }
    }

    const ext = this.guessExtFromUrl(url);
    const outputPath = join(tmpdir(), `beleqet-dl-${randomUUID()}.${ext}`);
    const nodeStream = Readable.fromWeb(
      response.body as import('stream/web').ReadableStream,
    );
    const sizeGuard = this.createSizeLimitTransform(maxBytes);

    const onAbort = () => {
      nodeStream.destroy(new Error(`Video download timed out after ${timeoutMs}ms`));
    };
    abort.addEventListener('abort', onAbort, { once: true });

    try {
      await pipeline(nodeStream, sizeGuard, createWriteStream(outputPath));
    } catch (err) {
      await unlink(outputPath).catch(() => {});
      if (abort.aborted) {
        throw new Error(`Video download timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      abort.removeEventListener('abort', onAbort);
    }

    this.logger.log(`Streamed video to disk: ${outputPath} (${sizeGuard.bytesRead} bytes)`);
    return outputPath;
  }

  /**
   * Extract audio from a video file on disk and return a 16 kHz mono WAV buffer.
   * Only the (much smaller) WAV is loaded into memory — not the source video.
   *
   * @param inputPath  Path to the source video on disk.
   * @returns          WAV audio buffer ready for the Whisper API.
   */
  async extractAudioFromFile(inputPath: string): Promise<Buffer> {
    const outputPath = join(tmpdir(), `beleqet-${randomUUID()}.wav`);

    try {
      await execFileAsync('ffmpeg', [
        '-i', inputPath,
        '-vn',
        '-acodec', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        '-y',
        outputPath,
      ]);

      const audioBuffer = await readFile(outputPath);
      this.logger.log(`Audio extracted: ${audioBuffer.length} bytes from ${inputPath}`);
      return audioBuffer;
    } finally {
      await unlink(outputPath).catch(() => {});
    }
  }

  /**
   * Strip all metadata from a video file on disk (EXIF, GPS, encoder tags).
   * Writes a cleaned copy next to the input; caller must delete both.
   *
   * @param inputPath  Original video path.
   * @returns          Path to the sanitised video file.
   */
  async stripMetadataFromFile(inputPath: string): Promise<string> {
    const outputPath = join(tmpdir(), `beleqet-clean-${randomUUID()}.webm`);
    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-map_metadata', '-1',
      '-c', 'copy',
      '-y',
      outputPath,
    ]);
    return outputPath;
  }

  /**
   * Get the duration of a video file in seconds using ffprobe.
   *
   * @param inputPath  Path to video on disk.
   * @returns          Duration in seconds (float).
   */
  async getDurationSecondsFromFile(inputPath: string): Promise<number> {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      inputPath,
    ]);
    return parseFloat(stdout.trim()) || 0;
  }

  /**
   * @deprecated Prefer file-path APIs to avoid buffering large videos in RAM.
   * Kept for unit-test compatibility with small fixtures.
   */
  async extractAudio(videoBuffer: Buffer, mimeType = 'video/webm'): Promise<Buffer> {
    const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('mov') ? 'mov' : 'webm';
    const inputPath = join(tmpdir(), `beleqet-${randomUUID()}.${ext}`);
    try {
      await writeFile(inputPath, videoBuffer);
      return await this.extractAudioFromFile(inputPath);
    } finally {
      await unlink(inputPath).catch(() => {});
    }
  }

  /**
   * @deprecated Prefer {@link getDurationSecondsFromFile}.
   */
  async getDurationSeconds(videoBuffer: Buffer): Promise<number> {
    const inputPath = join(tmpdir(), `beleqet-probe-${randomUUID()}.webm`);
    try {
      await writeFile(inputPath, videoBuffer);
      return await this.getDurationSecondsFromFile(inputPath);
    } finally {
      await unlink(inputPath).catch(() => {});
    }
  }

  /**
   * @deprecated Prefer {@link stripMetadataFromFile}.
   */
  async stripMetadata(videoBuffer: Buffer): Promise<Buffer> {
    const inputPath = join(tmpdir(), `beleqet-in-${randomUUID()}.webm`);
    let outputPath = '';
    try {
      await writeFile(inputPath, videoBuffer);
      outputPath = await this.stripMetadataFromFile(inputPath);
      return await readFile(outputPath);
    } finally {
      await Promise.allSettled([
        unlink(inputPath).catch(() => {}),
        outputPath ? unlink(outputPath).catch(() => {}) : Promise.resolve(),
      ]);
    }
  }

  private getMaxBytes(): number {
    const raw = this.config.get<string>('VIDEO_INTERVIEW_MAX_BYTES');
    const parsed = raw ? Number(raw) : DEFAULT_VIDEO_MAX_BYTES;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_VIDEO_MAX_BYTES;
  }

  private getDownloadTimeoutMs(): number {
    const raw = this.config.get<string>('VIDEO_INTERVIEW_DOWNLOAD_TIMEOUT_MS');
    const parsed = raw ? Number(raw) : DEFAULT_VIDEO_DOWNLOAD_TIMEOUT_MS;
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_VIDEO_DOWNLOAD_TIMEOUT_MS;
  }

  private createSizeLimitTransform(maxBytes: number): Transform & { bytesRead: number } {
    let bytesRead = 0;
    const transform = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytesRead += chunk.length;
        (transform as Transform & { bytesRead: number }).bytesRead = bytesRead;
        if (bytesRead > maxBytes) {
          callback(
            new Error(`Video exceeds maximum allowed size of ${maxBytes} bytes`),
          );
          return;
        }
        callback(null, chunk);
      },
    }) as Transform & { bytesRead: number };
    transform.bytesRead = 0;
    return transform;
  }

  private guessExtFromUrl(url: string): string {
    try {
      const pathname = new URL(url).pathname.toLowerCase();
      if (pathname.endsWith('.mp4')) return 'mp4';
      if (pathname.endsWith('.mov')) return 'mov';
      if (pathname.endsWith('.webm')) return 'webm';
    } catch {
      // fall through
    }
    return 'webm';
  }
}

/**
 * Assert that `videoUrl` points only at configured storage / API hosts.
 * Prevents SSRF against internal metadata endpoints and localhost services.
 *
 * @throws BadRequestException when the URL is not on the allowlist.
 */
export function assertAllowedVideoUrl(
  videoUrl: string,
  config: ConfigService,
  errorMessage = 'Video URL host is not allowed.',
): void {
  let parsed: URL;
  try {
    parsed = new URL(videoUrl);
  } catch {
    throw new BadRequestException(errorMessage);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new BadRequestException(errorMessage);
  }

  // Never allow userinfo@host tricks
  if (parsed.username || parsed.password) {
    throw new BadRequestException(errorMessage);
  }

  const host = parsed.hostname.toLowerCase();
  if (isBlockedLiteralHost(host) || isPrivateOrLinkLocalIp(host)) {
    // Still allow if the host is explicitly configured (e.g. local API in dev)
    const allowed = collectAllowedVideoHosts(config);
    if (!hostMatchesAllowlist(host, allowed)) {
      throw new BadRequestException(errorMessage);
    }
    return;
  }

  const allowed = collectAllowedVideoHosts(config);
  if (allowed.length === 0 || !hostMatchesAllowlist(host, allowed)) {
    throw new BadRequestException(errorMessage);
  }
}

/** Build hostname allowlist from storage / CDN / API configuration. */
export function collectAllowedVideoHosts(config: ConfigService): string[] {
  const hosts = new Set<string>();

  const addFromUrl = (value?: string) => {
    if (!value) return;
    try {
      const u = new URL(value.includes('://') ? value : `https://${value}`);
      if (u.hostname) hosts.add(u.hostname.toLowerCase());
    } catch {
      // ignore invalid config entries
    }
  };

  addFromUrl(config.get<string>('R2_PUBLIC_BASE_URL'));
  addFromUrl(config.get<string>('CDN_BASE_URL'));
  addFromUrl(config.get<string>('AWS_ENDPOINT'));
  addFromUrl(config.get<string>('API_BASE_URL'));

  const bucket = config.get<string>('R2_BUCKET_NAME')
    ?? config.get<string>('AWS_S3_BUCKET', 'beleqet-uploads');
  const region = config.get<string>('AWS_REGION', 'us-east-1');
  hosts.add(`${bucket}.s3.${region}.amazonaws.com`);
  hosts.add(`${bucket}.s3.amazonaws.com`);
  hosts.add('s3.amazonaws.com');

  const extra = config.get<string>('VIDEO_URL_ALLOWED_HOSTS', '');
  for (const part of extra.split(',')) {
    const h = part.trim().toLowerCase();
    if (h) hosts.add(h);
  }

  return [...hosts];
}

function hostMatchesAllowlist(host: string, allowed: string[]): boolean {
  return allowed.some(
    (entry) => host === entry || host.endsWith(`.${entry}`),
  );
}

function isBlockedLiteralHost(host: string): boolean {
  return (
    host === 'localhost'
    || host === '127.0.0.1'
    || host === '0.0.0.0'
    || host === '::1'
    || host === 'metadata.google.internal'
    || host === '169.254.169.254'
  );
}

function isPrivateOrLinkLocalIp(host: string): boolean {
  // IPv4 dotted quad only — hostname DNS rebinding is mitigated by allowlist.
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const octets = m.slice(1).map(Number);
  if (octets.some((o) => o > 255)) return true;
  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}
