import { UnprocessableEntityException } from '@nestjs/common';
import * as mammoth from 'mammoth';
import { DocxParserService } from './docx-parser.service';

jest.mock('mammoth', () => ({
  extractRawText: jest.fn(),
}));

describe('DocxParserService', () => {
  let service: DocxParserService;

  beforeEach(() => {
    service = new DocxParserService();
    jest.clearAllMocks();
  });

  describe('supports', () => {
    it('should support .docx mime type', () => {
      expect(
        service.supports('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      ).toBe(true);
    });

    it('should support legacy .doc mime type', () => {
      expect(service.supports('application/msword')).toBe(true);
    });

    it('should not support unrelated mime types', () => {
      expect(service.supports('application/pdf')).toBe(false);
    });
  });

  describe('parse', () => {
    it('should return extracted text on success', async () => {
      (mammoth.extractRawText as jest.Mock).mockResolvedValue({
        value: 'Selam Tesfaye\nSoftware Engineer',
      });

      const result = await service.parse(Buffer.from('fake-docx-bytes'));

      expect(result).toEqual({ text: 'Selam Tesfaye\nSoftware Engineer', usedOcrFallback: false });
    });

    it('should throw when the document contains no extractable text', async () => {
      (mammoth.extractRawText as jest.Mock).mockResolvedValue({ value: '   ' });

      await expect(service.parse(Buffer.from('fake-docx-bytes'))).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should throw a clear error when mammoth fails to read the file', async () => {
      (mammoth.extractRawText as jest.Mock).mockRejectedValue(new Error('not a valid zip file'));

      await expect(service.parse(Buffer.from('corrupt'))).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });
});
