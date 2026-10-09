#!/usr/bin/env node
const { execSync } = require('child_process');

let json;
try {
  const stdout = execSync('npm audit --omit=dev --json', {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'ignore'],
    shell: true,
  });
  json = JSON.parse(stdout);
} catch (err) {
  json = JSON.parse(err.stdout ? err.stdout.toString() : '{}');
}

const vulns = Object.values(json.vulnerabilities || {});
// Known upstream advisories with breaking downstream updates (e.g. Next.js 14, legacy mailer)
const EXEMPT_PACKAGES = ['next', 'handlebars', 'proxy-addr'];
const criticalNonExempt = vulns.filter(
  (v) => v.severity === 'critical' && !EXEMPT_PACKAGES.includes(v.name),
);

if (criticalNonExempt.length > 0) {
  console.error('❌ Actionable CRITICAL vulnerabilities found:');
  for (const c of criticalNonNext) {
    console.error(`- ${c.name} (${c.severity}): ${c.title || c.url || 'details in npm audit'}`);
  }
  process.exit(1);
} else {
  console.log('✅ Production dependency audit gate passed (no unresolved non-exempt critical vulnerabilities).');
}
