import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useTranscription } from '../../hooks/useTranscription';

function HookProbe() {
  const { transcribeUploadedFile } = useTranscription();
  return React.createElement(
    'div',
    null,
    typeof transcribeUploadedFile === 'function' ? 'ready' : 'missing',
  );
}

describe('useTranscription upload support', () => {
  it('exposes an upload transcription helper', () => {
    const html = renderToStaticMarkup(React.createElement(HookProbe));
    expect(html).toContain('ready');
  });
});
