#!/usr/bin/env node
/**
 * Public copy checker for Earth Love United.
 *
 * No dependencies. Scans public-facing HTML/Markdown for unresolved public
 * placeholders and unsafe dummy links while allowing form placeholder=""
 * attributes, CSS ::placeholder rules, comments, and fenced code blocks.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const DEFAULT_FILES = [
  'index.html',
  'gaia.html',
  'README.md',
  'CONTRIBUTING.md',
  'ARCHITECTURE.md',
  'docs/agents/README.md',
  'docs/operations/README.md',
  'docs/operations/GO_PUBLIC.md',
  'docs/operations/WAVE_4_PLAN.md',
  'docs/operations/REPO_MAP.md',
  'docs/operations/README_CLEANUP.md',
  'climate-dataset/README.md',
  'climate-dataset/STATUS.md',
].map(file => path.join(ROOT, file));

const RISKY_TERMS = [
  { label: 'placeholder', pattern: /\bplaceholder\b/i },
  { label: 'TODO', pattern: /\bTODO\b/i },
  { label: 'lorem', pattern: /\blorem\b/i },
  { label: 'coming soon', pattern: /\bcoming soon\b/i },
];

const RISKY_LINKS = [
  { label: 'empty href="#"', pattern: /href\s*=\s*["']#["']/i },
  { label: 'javascript:void(0)', pattern: /href\s*=\s*["']javascript:void\(0\)["']/i },
];

function stripIgnored(text, ext) {
  let out = text;

  // HTML comments are usually implementation notes, not public copy.
  out = out.replace(/<!--[\s\S]*?-->/g, '');

  if (ext === '.md') {
    // Ignore fenced code and inline code snippets.
    out = out.replace(/```[\s\S]*?```/g, '');
    out = out.replace(/`[^`\n]*`/g, '');
  }

  // Allow form placeholder attributes and CSS placeholder selectors.
  out = out.replace(/\splaceholder\s*=\s*(["']).*?\1/gi, '');
  out = out.replace(/::placeholder/gi, '::form-input-pseudo');

  return out;
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

function checkFile(file) {
  if (!fs.existsSync(file)) return [];

  const ext = path.extname(file);
  const original = fs.readFileSync(file, 'utf8');
  const text = stripIgnored(original, ext);
  const findings = [];

  for (const rule of [...RISKY_TERMS, ...RISKY_LINKS]) {
    const match = rule.pattern.exec(text);
    if (match) {
      findings.push({
        file: path.relative(ROOT, file),
        line: lineNumberAt(text, match.index),
        rule: rule.label,
        excerpt: text.split('\n')[lineNumberAt(text, match.index) - 1].trim().slice(0, 140),
      });
    }
  }

  return findings;
}

function main() {
  const args = process.argv.slice(2);
  const files = args.length ? args.map(file => path.resolve(ROOT, file)) : DEFAULT_FILES;
  const findings = files.flatMap(checkFile);

  if (findings.length) {
    console.error('Public copy check failed:');
    findings.forEach(f => {
      console.error(`- ${f.file}:${f.line} [${f.rule}] ${f.excerpt}`);
    });
    process.exit(1);
  }

  console.log(`Public copy check passed (${files.length} files).`);
}

main();
