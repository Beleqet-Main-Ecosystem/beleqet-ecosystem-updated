#!/usr/bin/env node
/**
 * Every t('key') the app uses must exist in English and Amharic, in the website's locales or the
 * app's own (apps/mobile/locales). Keys built at runtime (t(`a.${b}`)) are checked by prefix only.
 * Exits 1 and lists what is missing.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const web = path.resolve(root, '../../beleqet-jobs-nextjs/locales');
const dicts = {
  en: [require(path.join(root, 'locales/en.json')), require(path.join(web, 'en.json'))],
  am: [require(path.join(root, 'locales/am.json')), require(path.join(web, 'am.json'))],
};

function has(dict, key) {
  let node = dict;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in node)) return false;
    node = node[part];
  }
  return true;
}

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return files(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const used = new Map();
for (const dir of ['app', 'components', 'lib', 'features', 'api']) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) continue;
  for (const file of files(full)) {
    const source = fs.readFileSync(file, 'utf8');
    // t('a.b'), translate(locale, 'a.b'), t(cond ? 'a' : 'b'), plus string keys passed as fallbacks.
    for (const match of source.matchAll(/\b(?:t|translate\([^,]+,)\s*\(?\s*'([a-zA-Z][\w-]*(?:\.[\w-]+)+)'/g)) used.set(match[1], file);
    for (const match of source.matchAll(/\?\s*'([a-zA-Z][\w-]*(?:\.[\w-]+)+)'\s*:\s*'([a-zA-Z][\w-]*(?:\.[\w-]+)+)'/g)) {
      used.set(match[1], file);
      used.set(match[2], file);
    }
    for (const match of source.matchAll(/errorText\([^)]*?,\s*t,\s*'([\w.-]+)'\)/g)) used.set(match[1], file);
  }
}

const missing = [];
for (const [key, file] of used) {
  for (const lang of ['en', 'am']) {
    if (!dicts[lang].some((dict) => has(dict, key))) missing.push(`${lang}  ${key}  (${path.relative(root, file)})`);
  }
}
if (missing.length) {
  console.error(`Missing translations (${missing.length}):\n${missing.sort().join('\n')}`);
  process.exit(1);
}
console.log(`All ${used.size} translation keys exist in English and Amharic.`);
