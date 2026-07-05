import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

const execFileAsync = promisify(execFile);

/**
 * Service for FFmpeg-based video pre-processing before Whisper transcription.
 *
 * Responsibilities:
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

  /**
   * Extract audio from a video buffer and return a 16 kHz mono WAV buffer.
   * This format is optimal for OpenAI Whisper (lower cost, faster processing).
   *
   * @param videoBuffer  Raw video bytes (WebM, MP4, or MOV).
   * @param mimeType     Source MIME type — used to choose the input format hint.
   * @returns            WAV audio buffer ready for the Whisper API.
   * @throws             Error if FFmpeg is not installed or extraction fails.
   */
  async extractAudio(videoBuffer: Buffer, mimeType = 'video/webm'): Promise<Buffer> {
    const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('mov') ? 'mov' : 'webm';
    const inputPath  = join(tmpdir(), `beleqet-${randomUUID()}.${ext}`);
    const outputPath = join(tmpdir(), `beleqet-${randomUUID()}.wav`);

    try {
      await writeFile(inputPath, videoBuffer);

      // Extract audio: 16 kHz mono WAV — Whisper's preferred input
      await execFileAsync('ffmpeg', [
        '-i', inputPath,
        '-vn',                  // drop video stream
        '-acodec', 'pcm_s16le', // 16-bit PCM
        '-ar', '16000',         // 16 kHz sample rate
        '-ac', '1',             // mono channel
        '-y',                   // overwrite output
        outputPath,
      ]);

      const audioBuffer = await readFile(outputPath);
      this.logger.log(`Audio extracted: ${audioBuffer.length} bytes from ${videoBuffer.length} bytes video`);
      return audioBuffer;
    } finally {
      await Promise.allSettled([unlink(inputPath), unlink(outputPath)]);
    }
  }

  /**
   * Get the duration of a video in seconds using ffprobe.
   * Used to validate that the response does not exceed the question's `durationSec`.
   *
   * @param videoBuffer  Raw video bytes.
   * @returns            Duration in seconds (float).
   */
  async getDurationSeconds(videoBuffer: Buffer): Promise<number> {
    const inputPath = join(tmpdir(), `beleqet-probe-${randomUUID()}.webm`);
    try {
      await writeFile(inputPath, videoBuffer);
      const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        inputPath,
      ]);
      return parseFloat(stdout.trim()) || 0;
    } finally {
      await unlink(inputPath).catch(() => {});
    }
  }

  /**
   * Strip all metadata (EXIF, GPS, encoder tags) from a video for GDPR compliance.
   * Returns a cleaned video buffer with no PII in the container metadata.
   *
   * @param videoBuffer  Original video bytes.
   * @returns            Sanitised video buffer.
   */
  async stripMetadata(videoBuffer: Buffer): Promise<Buffer> {
    const inputPath  = join(tmpdir(), `beleqet-in-${randomUUID()}.webm`);
    const outputPath = join(tmpdir(), `beleqet-out-${randomUUID()}.webm`);
    try {
      await writeFile(inputPath, videoBuffer);
      await execFileAsync('ffmpeg', [
        '-i', inputPath,
        '-map_metadata', '-1',  // strip all metadata
        '-c', 'copy',           // no re-encode — fast
        '-y',
        outputPath,
      ]);
      return await readFile(outputPath);
    } finally {
      await Promise.allSettled([unlink(inputPath), unlink(outputPath)]);
    }
  }
}
