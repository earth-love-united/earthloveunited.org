#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_FILES = ['README.md', 'index.html'];
const CANONICAL = 'https://github.com/earth-love-united/earthloveunited.org';
const RETIRED = [
  'https://github.com/gke0op/earthloveunited.org',
  'git@github.com:gke0op/earthloveunited.org.git',
];

let canonicalReferences = 0;
for (const relative of PUBLIC_FILES) {
  const content = fs.readFileSync(path.join(ROOT, relative), 'utf8');
  for (const retired of RETIRED) {
    assert.equal(content.includes(retired), false, `${relative} exposes retired source repository ${retired}`);
  }
  canonicalReferences += content.split(CANONICAL).length - 1;
}

assert.ok(canonicalReferences >= 4, `expected at least four canonical public source references, found ${canonicalReferences}`);
process.stdout.write(`Canonical source links: PASS (${canonicalReferences} public references)\n`);
