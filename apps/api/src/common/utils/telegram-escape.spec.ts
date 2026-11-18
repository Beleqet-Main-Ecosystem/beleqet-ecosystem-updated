import { escapeTelegramMarkdown } from './telegram-escape';

describe('escapeTelegramMarkdown', () => {
  it('should escape underscores', () => {
    expect(escapeTelegramMarkdown('hello_world')).toBe('hello\\_world');
  });

  it('should escape asterisks', () => {
    expect(escapeTelegramMarkdown('Senior *Lead* Dev')).toBe('Senior \\*Lead\\* Dev');
  });

  it('should escape backticks', () => {
    expect(escapeTelegramMarkdown('use `npm install`')).toBe('use \\`npm install\\`');
  });

  it('should escape open and close brackets', () => {
    expect(escapeTelegramMarkdown('click [here](url)')).toBe('click \\[here\\](url)');
  });

  it('should return empty string as-is', () => {
    expect(escapeTelegramMarkdown('')).toBe('');
  });

  it('should not alter a string with no special chars', () => {
    expect(escapeTelegramMarkdown('Backend Developer')).toBe('Backend Developer');
  });

  it('should handle a string with all special chars', () => {
    expect(escapeTelegramMarkdown('*_`[test')).toBe('\\*\\_\\`\\[test');
  });

  it('should handle Ethiopic text without issue', () => {
    expect(escapeTelegramMarkdown('ሰላም እንዴት ነህ')).toBe('ሰላም እንዴት ነህ');
  });
});
