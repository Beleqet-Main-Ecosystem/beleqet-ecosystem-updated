import { safeJsonParse, extractJsonObject } from '../utils/json-parser.util';

describe('json-parser.util', () => {
  describe('extractJsonObject', () => {
    it('should extract a JSON object from markdown code fences', () => {
      const markdown = '```json\n{ "decision": "STRONG_MATCH" }\n```';

      const result = extractJsonObject(markdown);

      expect(result).toBe('{ "decision": "STRONG_MATCH" }');
    });

    it('should extract a JSON object from natural language wrapping', () => {
      const text = 'Based on my analysis: { "decision": "POTENTIAL_MATCH" }.';

      const result = extractJsonObject(text);

      expect(result).toBe('{ "decision": "POTENTIAL_MATCH" }');
    });

    it('should return null when no JSON object is present', () => {
      const result = extractJsonObject('Just some plain text without braces.');

      expect(result).toBeNull();
    });

    it('should handle nested JSON objects', () => {
      const nested = 'Here is the result: { "outer": { "inner": "value" }, "arr": [1, 2] }';

      const result = extractJsonObject(nested);

      expect(result).toContain('"outer"');
      expect(result).toContain('"inner"');
    });
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON strings', () => {
      const result = safeJsonParse<{ name: string }>('{ "name": "test" }');

      expect(result).toEqual({ name: 'test' });
    });

    it('should return null for invalid JSON without throwing', () => {
      const result = safeJsonParse('{ invalid json }');

      expect(result).toBeNull();
    });

    it('should return null for empty string without throwing', () => {
      const result = safeJsonParse('');

      expect(result).toBeNull();
    });
  });
});
