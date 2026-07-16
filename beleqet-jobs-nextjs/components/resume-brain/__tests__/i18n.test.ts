import { describe, expect, it } from 'vitest';
import { translate } from '../i18n';

describe('Resume Brain i18n', () => {
  it('returns the English page title for en locale', () => {
    expect(translate('en', 'pageTitle')).toBe('Upload your CV. We’ll do the typing.');
  });

  it('returns the Amharic page title for am locale', () => {
    expect(translate('am', 'pageTitle')).toBe('ሲቪዎን ይላኩ። እኛ እንጽፋዋለን።');
  });

  it('interpolates placeholder values correctly', () => {
    expect(translate('en', 'uploadSubtitle', { maxSizeMb: 20 })).toBe(
      'PDF, DOC, or DOCX — max 20MB',
    );
  });

  it('falls back to the key when translation is missing', () => {
    expect(translate('en', 'missing-key')).toBe('missing-key');
  });
});
