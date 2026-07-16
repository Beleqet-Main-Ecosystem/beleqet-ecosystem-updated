import { describe, expect, it } from 'vitest';
import axios from 'axios';
import { messageFromResumeBrainError } from '../api';

vi.mock('axios');

describe('Resume Brain API helpers', () => {
  it('returns message from Axios error response object', () => {
    const error = {
      response: {
        data: {
          message: 'Invalid resume format',
        },
      },
      isAxiosError: true,
    } as any;

    expect(messageFromResumeBrainError(error, 'Fallback')).toBe('Invalid resume format');
  });

  it('joins array messages into a single string', () => {
    const error = {
      response: {
        data: {
          message: ['Invalid file type', 'Upload failed'],
        },
      },
      isAxiosError: true,
    } as any;

    expect(messageFromResumeBrainError(error, 'Fallback')).toBe('Invalid file type, Upload failed');
  });

  it('returns fallback for unknown errors', () => {
    const error = new Error('Network error');
    expect(messageFromResumeBrainError(error, 'Fallback')).toBe('Fallback');
  });
});
