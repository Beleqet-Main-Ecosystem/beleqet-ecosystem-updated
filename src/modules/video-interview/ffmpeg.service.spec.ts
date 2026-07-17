import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import {
  FfmpegService,
  assertAllowedVideoUrl,
  collectAllowedVideoHosts,
  DEFAULT_VIDEO_MAX_BYTES,
} from './ffmpeg.service';

function configWith(map: Record<string, string>): ConfigService {
  return {
    get: (key: string, fallback?: string) => map[key] ?? fallback,
  } as unknown as ConfigService;
}

describe('assertAllowedVideoUrl (SSRF)', () => {
  const config = configWith({
    R2_PUBLIC_BASE_URL: 'https://cdn.beleqet.com/uploads',
    AWS_S3_BUCKET: 'beleqet-uploads',
    AWS_REGION: 'us-east-1',
  });

  it('allows configured CDN hosts', () => {
    expect(() =>
      assertAllowedVideoUrl('https://cdn.beleqet.com/interviews/a.webm', config),
    ).not.toThrow();
  });

  it('rejects AWS metadata endpoint', () => {
    expect(() =>
      assertAllowedVideoUrl('http://169.254.169.254/latest/meta-data/', config),
    ).toThrow(BadRequestException);
  });

  it('rejects localhost', () => {
    expect(() =>
      assertAllowedVideoUrl('http://localhost:3000/secret', config),
    ).toThrow(BadRequestException);
  });

  it('rejects private IPs', () => {
    expect(() =>
      assertAllowedVideoUrl('http://192.168.1.10/video.webm', config),
    ).toThrow(BadRequestException);
  });

  it('rejects URLs with embedded credentials', () => {
    expect(() =>
      assertAllowedVideoUrl('https://user:pass@cdn.beleqet.com/a.webm', config),
    ).toThrow(BadRequestException);
  });

  it('collectAllowedVideoHosts includes S3 bucket host', () => {
    const hosts = collectAllowedVideoHosts(config);
    expect(hosts).toContain('cdn.beleqet.com');
    expect(hosts).toContain('beleqet-uploads.s3.us-east-1.amazonaws.com');
  });
});

describe('FfmpegService.downloadToTempFile (DoS)', () => {
  const config = configWith({
    VIDEO_INTERVIEW_MAX_BYTES: String(1024), // 1 KiB for test
  });
  let service: FfmpegService;

  beforeEach(() => {
    service = new FfmpegService(config);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects oversized Content-Length before streaming', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      statusText: 'OK',
      headers: { get: (h: string) => (h === 'content-length' ? '999999' : null) },
      body: Readable.toWeb(Readable.from([Buffer.from('x')])),
    } as unknown as Response);

    await expect(
      service.downloadToTempFile('https://cdn.example/huge.webm'),
    ).rejects.toThrow(/maximum allowed size/);
  });

  it('aborts when streamed bytes exceed the configured limit', async () => {
    const chunks = [Buffer.alloc(800), Buffer.alloc(800)]; // 1600 > 1024
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      statusText: 'OK',
      headers: { get: () => null },
      body: Readable.toWeb(Readable.from(chunks)),
    } as unknown as Response);

    await expect(
      service.downloadToTempFile('https://cdn.example/stream.webm'),
    ).rejects.toThrow(/maximum allowed size/);
  });

  it('defaults max bytes when env is unset', () => {
    const svc = new FfmpegService(configWith({}));
    expect(DEFAULT_VIDEO_MAX_BYTES).toBe(100 * 1024 * 1024);
    expect(svc).toBeDefined();
  });
});
