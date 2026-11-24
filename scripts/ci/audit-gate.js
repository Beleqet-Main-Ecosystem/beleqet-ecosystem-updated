#!/usr/bin/env node
/**
 * Fails CI when a project's dependencies have a known vulnerability that isn't on the allowlist.
 *
 *   node scripts/ci/audit-gate.js <project folder>
 *
 * - npm projects (package-lock.json): production dependencies, critical and high severity.
 * - Python bots (requirements.txt, needs pip-audit): every known vulnerability (pip-audit gives
 *   no severity).
 *
 * scripts/ci/audit-allowlist.json lists the advisories accepted for now, each with its reason
 * (usually: only a major upgrade fixes it). Anything new fails, so a vulnerable package can't
 * slip in. An allowlisted advisory that no longer shows up is reported, so the list stays short.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const project = (process.argv[2] || '').replace(/\\/g, '/').replace(/\/$/, '');
if (!project) {
  console.error('usage: node scripts/ci/audit-gate.js <project folder>');
  process.exit(2);
}
const root = path.resolve(__dirname, '..', '..');
const dir = path.join(root, project);
const allowlist = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'audit-allowlist.json'), 'utf8'),
).advisories.filter((entry) => entry.projects.includes(project));

/** Runs a command that may exit non-zero when it finds something, and returns its JSON output. */
function json(command, args) {
  try {
    return JSON.parse(execFileSync(command, args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024, shell: process.platform === 'win32' }));
  } catch (error) {
    if (!error.stdout) throw error;
    return JSON.parse(error.stdout);
  }
}

/** [{ id, package, severity, title }] for the project's known vulnerabilities. */
function findings() {
  if (fs.existsSync(path.join(dir, 'package-lock.json'))) {
    // The lockfile is enough: nothing needs to be installed.
    const report = json('npm', ['audit', '--omit=dev', '--package-lock-only', '--json']);
    const seen = new Map();
    for (const vulnerability of Object.values(report.vulnerabilities || {})) {
      for (const advisory of vulnerability.via) {
        // Strings point at another vulnerable package; the advisories themselves are objects.
        if (typeof advisory !== 'object' || !['critical', 'high'].includes(advisory.severity)) continue;
        const id = (advisory.url || '').split('/').pop() || String(advisory.source);
        seen.set(`${id} ${advisory.name}`, { id, package: advisory.name, severity: advisory.severity, title: advisory.title });
      }
    }
    return [...seen.values()];
  }
  if (fs.existsSync(path.join(dir, 'requirements.txt'))) {
    const report = json('pip-audit', ['-r', 'requirements.txt', '--format', 'json', '--progress-spinner', 'off']);
    const seen = new Map();
    for (const dependency of report.dependencies) {
      for (const vuln of dependency.vulns || []) {
        seen.set(`${vuln.id} ${dependency.name}`, {
          id: vuln.id,
          package: dependency.name,
          severity: 'known',
          title: `${dependency.version}; fixed in ${(vuln.fix_versions || []).join(', ') || 'no release yet'}`,
        });
      }
    }
    return [...seen.values()];
  }
  console.error(`${project}: no package-lock.json or requirements.txt`);
  process.exit(2);
}

const found = findings();
const allowed = (finding) =>
  allowlist.some((entry) => entry.id === finding.id && entry.package === finding.package);
const blocking = found.filter((finding) => !allowed(finding));
const stale = allowlist.filter(
  (entry) => !found.some((finding) => finding.id === entry.id && finding.package === entry.package),
);

console.log(`${project}: ${found.length} known (${found.length - blocking.length} allowlisted)`);
for (const entry of stale) {
  console.log(`::notice::${project}: ${entry.id} (${entry.package}) is fixed; remove it from scripts/ci/audit-allowlist.json`);
}
if (blocking.length > 0) {
  console.error(`::error::${project}: ${blocking.length} vulnerability(ies) to fix:`);
  for (const finding of blocking) {
    console.error(`  ${finding.severity} ${finding.package}: ${finding.title} (${finding.id})`);
  }
  console.error('Update the package, or, if only a major upgrade fixes it, add it to scripts/ci/audit-allowlist.json with the reason.');
  process.exit(1);
}
