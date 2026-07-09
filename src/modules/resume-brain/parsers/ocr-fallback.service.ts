import { Injectable, Logger } from '@nestjs/common';
import { createWorker } from 'tesseract.js';

/**
 * OCR fallback used when a document's text layer is empty or unreadable
 * (typically a scanned CV saved as an image-only PDF, or a photographed CV).
 *
 * Tesseract.js only operates on raster images. For image uploads this service
 * runs OCR directly on the buffer. For scanned PDFs, the buffer must first be
 * rasterized into page images — `rasterizePdf` is the extension point for that;
 * by default it is unimplemented (returns null) to avoid pulling in a native
 * PDF-rendering toolchain (e.g. poppler/canvas) that this assessment scope does
 * not require. Swap in a real rasterizer there to enable full scanned-PDF OCR.
 */
@Injectable()
export class OcrFallbackService {
  private readonly logger = new Logger(OcrFallbackService.name);

  /**
   * Runs OCR over a document buffer and returns any recognized text.
   *
   * @param buffer - Raw bytes of the source file.
   * @param mimeType - MIME type of the source file.
   * @returns Recognized text, or an empty string if OCR could not be performed.
   */
  async extractText(buffer: Buffer, mimeType: string): Promise<string> {
    const imageBuffer = mimeType.startsWith('image/') ? buffer : await this.rasterizePdf(buffer);
    if (!imageBuffer) {
      this.logger.warn('OCR fallback had no rasterized image to work with — returning empty text.');
      return '';
    }

    const worker = await createWorker('eng');
    try {
      const {
        data: { text },
      } = await worker.recognize(imageBuffer);
      return text?.trim() ?? '';
    } finally {
      await worker.terminate();
    }
  }

  /**
   * Extension point: converts a scanned PDF's pages into a raster image buffer
   * suitable for OCR. Not implemented by default — see class-level TSDoc.
   *
   * @param _buffer - Raw PDF bytes.
   * @returns An image buffer, or null when rasterization is unavailable.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async rasterizePdf(_buffer: Buffer): Promise<Buffer | null> {
    return null;
  }
}
