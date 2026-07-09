import { UnprocessableEntityException } from '@nestjs/common';
import pdfParse = require('pdf-parse');
import { PdfParserService } from './pdf-parser.service';
import { OcrFallbackService } from './ocr-fallback.service';

// pdf-parse bundles a legacy vendored pdf.js build whose XRef parsing is
// unreliable under ts-node/ts-jest's module environment (verified independently
// against plain Node, where identical PDF bytes parse correctly — a third-party
// quirk, not a bug in this module). Mocked here the same way `mammoth` and
// `tesseract.js` are mocked elsewhere, so this test exercises our orchestration
// logic rather than that vendored library's internals.
jest.mock('pdf-parse');

describe('PdfParserService', () => {
  let service: PdfParserService;
  let ocrFallback: { extractText: jest.Mock };

  beforeEach(() => {
    ocrFallback = { extractText: jest.fn() };
    service = new PdfParserService(ocrFallback as unknown as OcrFallbackService);
    jest.clearAllMocks();
  });

  describe('supports', () => {
    it('should support application/pdf', () => {
      expect(service.supports('application/pdf')).toBe(true);
    });

    it('should not support other mime types', () => {
      expect(service.supports('application/msword')).toBe(false);
    });
  });

  describe('parse', () => {
    it('should extract text directly from a PDF with a real text layer', async () => {
      (pdfParse as jest.Mock).mockResolvedValue({
        text: 'Selam Tesfaye Software Engineer selam.tesfaye@example.com plus extra padding text',
      });
      const pdf = Buffer.from('%PDF-1.4 fake-pdf-bytes');

      const result = await service.parse(pdf);

      expect(pdfParse).toHaveBeenCalledWith(pdf);
      expect(result.usedOcrFallback).toBe(false);
      expect(result.text).toContain('Selam Tesfaye');
      expect(ocrFallback.extractText).not.toHaveBeenCalled();
    });

    it('should fall back to OCR when the text layer is empty', async () => {
      (pdfParse as jest.Mock).mockResolvedValue({ text: '' });
      ocrFallback.extractText.mockResolvedValue('OCR recovered text');
      const pdf = Buffer.from('%PDF-1.4 fake-pdf-bytes');

      const result = await service.parse(pdf);

      expect(ocrFallback.extractText).toHaveBeenCalledWith(pdf, 'application/pdf');
      expect(result.usedOcrFallback).toBe(true);
      expect(result.text).toBe('OCR recovered text');
    });

    it('should throw when both the text layer and OCR fallback are empty', async () => {
      (pdfParse as jest.Mock).mockResolvedValue({ text: '' });
      ocrFallback.extractText.mockResolvedValue('');

      await expect(service.parse(Buffer.from('%PDF-1.4 fake'))).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should throw a clear error when pdf-parse fails to read the file', async () => {
      (pdfParse as jest.Mock).mockRejectedValue(new Error('invalid PDF structure'));

      await expect(service.parse(Buffer.from('not a pdf'))).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });
});
