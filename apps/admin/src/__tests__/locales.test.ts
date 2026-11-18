import fs from 'fs';
import path from 'path';
import en from '@/locales/en.json';
import am from '@/locales/am.json';
import { translate } from '@/lib/i18n';

const flat = (input: object, prefix = ''): string[] =>
  Object.entries(input).flatMap(([key, value]) =>
    value && typeof value === 'object' ? flat(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sources(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('locales', () => {
  it('English and Amharic have the same keys', () => {
    expect(flat(am).sort()).toEqual(flat(en).sort());
  });

  it('keeps every {placeholder} in the Amharic text', () => {
    const enMap = Object.fromEntries(flat(en).map((key) => [key, translate('en', key)]));
    for (const key of Object.keys(enMap)) {
      const slots = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
      expect([key, slots(translate('am', key))]).toEqual([key, slots(enMap[key])]);
    }
  });

  it('has an English entry for every fixed key the code uses', () => {
    const known = new Set(flat(en));
    const missing = sources(path.join(__dirname, '..'))
      .flatMap((file) => [...fs.readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)].map((m) => m[1]))
      .filter((key) => !known.has(key));
    expect(missing).toEqual([]);
  });
});

describe('translate', () => {
  it('fills placeholders and falls back to English, then the key', () => {
    expect(translate('en', 'users.joined', { date: '1 Nov' })).toBe('Joined 1 Nov');
    expect(translate('am', 'no.such.key')).toBe('no.such.key');
  });
});
