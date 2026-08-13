import React from 'react';
import { renderHook } from '@testing-library/react';
import { useTranscription } from '../../hooks/useTranscription';

describe('useTranscription upload support', () => {
  it('exposes an upload transcription helper', () => {
    const { result } = renderHook(() => useTranscription());
    expect(typeof result.current.transcribeUploadedFile).toBe('function');
  });
});
