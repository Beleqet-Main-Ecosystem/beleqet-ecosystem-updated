import { createWorker } from 'tesseract.js';
import { OcrFallbackService } from './ocr-fallback.service';

jest.mock('tesseract.js', () => ({
  createWorker: jest.fn(),
}));

describe('OcrFallbackService', () => {
  let service: OcrFallbackService;
  let worker: { recognize: jest.Mock; terminate: jest.Mock };

  beforeEach(() => {
    service = new OcrFallbackService();
    worker = { recognize: jest.fn(), terminate: jest.fn().mockResolvedValue(undefined) };
    (createWorker as jest.Mock).mockResolvedValue(worker);
  });

  it('should run OCR directly on image buffers', async () => {
    worker.recognize.mockResolvedValue({ data: { text: '  Recognized text  ' } });

    const result = await service.extractText(Buffer.from('image-bytes'), 'image/png');

    expect(worker.recognize).toHaveBeenCalledWith(Buffer.from('image-bytes'));
    expect(worker.terminate).toHaveBeenCalled();
    expect(result).toBe('Recognized text');
  });

  it('should return empty text for non-image input with no rasterizer configured', async () => {
    const result = await service.extractText(Buffer.from('pdf-bytes'), 'application/pdf');

    expect(result).toBe('');
    expect(worker.recognize).not.toHaveBeenCalled();
  });
});
