#!/usr/bin/env node
/**
 * check-secrets.js — Scans source files for hardcoded credentials.
 * Run via: npm run secrets:scan
 *
 * Exits 0 if clean, 1 if findings are detected.
 */

const fs = require('fs');
const path = require('path');

// ─── Patterns that indicate hardcoded secrets ──────────────────────────────
const PATTERNS = [
  { name: 'Hardcoded password assignment', re: /(?:password|passwd|pwd)\s*=\s*["'`][^"'`\s]{6,}["'`]/i },
  { name: 'Hardcoded API key/secret',      re: /(?:api[_-]?key|api[_-]?secret|secret[_-]?key)\s*=\s*["'`][^"'`\s]{8,}["'`]/i },
  { name: 'Hardcoded token',               re: /(?:token|bearer)\s*=\s*["'`][^"'`\s]{8,}["'`]/i },
  { name: 'Private key material',          re: /-----BEGIN (RSA|EC|OPENSSH|DSA) PRIVATE KEY-----/ },
  { name: 'AWS access key',                re: /AKIA[0-9A-Z]{16}/ },
  { name: 'Telegram bot token',            re: /\d{8,10}:AA[0-9A-Za-z_-]{33}/ },
];

// ─── Directories / extensions to scan ──────────────────────────────────────
const SCAN_DIRS = ['src', 'scripts'];
const INCLUDE_EXTS = new Set(['.ts', '.js', '.json', '.env', '.sh']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage']);

// ─── Files explicitly allowed to reference secret patterns ─────────────────
const ALLOWLIST = new Set([
  'scripts/check-secrets.js',    // this file itself
  '.env',                        // actual secrets go here (never commit)
  '.env.example',                // placeholder examples
]);

// ─── Walk directory tree ────────────────────────────────────────────────────
function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (INCLUDE_EXTS.has(path.extname(entry.name))) {
      yield full;
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..');
let totalFindings = 0;

for (const scanDir of SCAN_DIRS) {
  const absDir = path.join(ROOT, scanDir);
  if (!fs.existsSync(absDir)) continue;

  for (const filePath of walk(absDir)) {
    const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
    if (ALLOWLIST.has(rel)) continue;

    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const { name, re } of PATTERNS) {
        if (re.test(line)) {
          const lineNo = i + 1;
          const snippet = line.trim().substring(0, 120);
          console.error(`\n[FINDING] ${name}`);
          console.error(`  File : ${rel}:${lineNo}`);
          console.error(`  Line : ${snippet}`);
          totalFindings++;
        }
      }
    });
  }
}

if (totalFindings === 0) {
  console.log('✅ No hardcoded secrets detected.');
  process.exit(0);
} else {
  console.error(`\n❌ ${totalFindings} potential secret(s) found. Fix before committing.`);
  process.exit(1);
}
