import { TokenizerService } from './tokenizer.service';

describe('TokenizerService', () => {
  let tokenizer: TokenizerService;

  beforeEach(() => {
    tokenizer = new TokenizerService();
  });

  it('lowercases and removes punctuation', () => {
    const tokens = tokenizer.tokenize('Hello, World! NestJS-Developer.');
    expect(tokens).toContain('hello');
    expect(tokens).toContain('nestjs');
    expect(tokens).toContain('developer');
  });

  it('removes stop words', () => {
    const tokens = tokenizer.tokenize('The quick brown fox is running');
    expect(tokens).not.toContain('the');
    expect(tokens).not.toContain('is');
    expect(tokens).toContain('quick');
  });

  it('removes very short tokens', () => {
    const tokens = tokenizer.tokenize('I am a go to do it');
    expect(tokens.every((t) => t.length >= 3)).toBe(true);
  });

  it('normalizes unicode characters', () => {
    const tokens = tokenizer.tokenize('Café résumé naïve');
    expect(tokens.length).toBeGreaterThan(0);
  });

  it('caches tokenization results', () => {
    const text = 'Software engineer with PostgreSQL experience';
    const first = tokenizer.tokenizeCached(text);
    const second = tokenizer.tokenizeCached(text);
    expect(first).toBe(second);
  });
});
