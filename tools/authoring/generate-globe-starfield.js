#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WIDTH = 4096;
const HEIGHT = 2048;
const LOGICAL_STAR_COUNT = 4096;
const EXPECTED_CIRCLE_COUNT = 4103;
const EXPECTED_SIZE_COUNTS = Object.freeze({ faint: 3387, medium: 580, bright: 129 });
const SEED = 0x454c5531;
const OUTPUT_PATH = path.resolve(__dirname, '../../assets/globe/runtime/night-sky.svg');
const ROOT_LINE = '<svg xmlns="http://www.w3.org/2000/svg" width="4096" height="2048" viewBox="0 0 4096 2048">';
const BACKGROUND_LINE = '<rect x="0" y="0" width="4096" height="2048" fill="#02040a"/>';
const CLOSE_LINE = '</svg>';
const PALETTE = Object.freeze(['#a9bed8', '#d9e8f7', '#fff4d6']);
const OPACITIES = Object.freeze(['.28', '.40', '.58', '.80']);

function createXorShift32(seed = SEED) {
  let state = seed >>> 0;
  return () => {
    state ^= (state << 13) >>> 0;
    state ^= state >>> 17;
    state ^= (state << 5) >>> 0;
    return state >>> 0;
  };
}

function sizeForBucket(bucket) {
  if (bucket < 82) return { radius: '1', className: 'faint' };
  if (bucket < 97) return { radius: '1.5', className: 'medium' };
  return { radius: '2.5', className: 'bright' };
}

function generateStarRecords() {
  const next = createXorShift32();
  const records = [];
  const sizeCounts = { faint: 0, medium: 0, bright: 0 };
  let seamTwinCount = 0;

  for (let index = 0; index < LOGICAL_STAR_COUNT; index += 1) {
    const x = next() % WIDTH;
    const y = 4 + (next() % 2040);
    const size = sizeForBucket(next() % 100);
    const fill = PALETTE[next() % PALETTE.length];
    const opacity = OPACITIES[next() % OPACITIES.length];
    const radius = Number(size.radius);
    const base = { x, y, radius: size.radius, fill, opacity, logicalIndex: index, seamTwin: false };
    records.push(base);
    sizeCounts[size.className] += 1;

    if (x - radius <= 0) {
      records.push({ ...base, x: x + WIDTH, seamTwin: true });
      seamTwinCount += 1;
    } else if (x + radius >= WIDTH) {
      records.push({ ...base, x: x - WIDTH, seamTwin: true });
      seamTwinCount += 1;
    }
  }

  assert.deepEqual(sizeCounts, EXPECTED_SIZE_COUNTS, 'star-size distribution drift');
  assert.equal(seamTwinCount, 7, 'horizontal seam-twin count drift');
  assert.equal(records.length, EXPECTED_CIRCLE_COUNT, 'rendered circle count drift');
  return { records, sizeCounts, seamTwinCount };
}

function circleLine(record) {
  return `<circle cx="${record.x}" cy="${record.y}" r="${record.radius}" fill="${record.fill}" opacity="${record.opacity}"/>`;
}

function generateSvg() {
  const { records } = generateStarRecords();
  return [ROOT_LINE, BACKGROUND_LINE, ...records.map(circleLine), CLOSE_LINE].join('\n') + '\n';
}

function inspectCanonicalSvg(bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(String(bytes), 'utf8');
  const source = buffer.toString('utf8');
  const failures = [];
  const fail = reason => failures.push(reason);

  if (!Buffer.from(source, 'utf8').equals(buffer)) fail('invalid_utf8');
  if (!source.endsWith('\n') || source.endsWith('\n\n') || source.includes('\r')) fail('noncanonical_line_endings');
  if (/[\x00-\x09\x0b-\x1f\x7f]/.test(source)) fail('control_character');
  if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[|<\?xml|<\?|<!--/i.test(source)) fail('active_or_noncanonical_declaration');
  if (/<\/?(?:script|style|foreignObject|image|use|a|animate|animateMotion|animateTransform|set|filter|mask|pattern|linearGradient|radialGradient|fe[a-z]*)\b/i.test(source)) fail('forbidden_element');
  if (/\b(?:href|xlink:href|style|class|id|transform|on[a-z]+)\s*=|url\s*\(|data:|https?:|\/\//i.test(source.replace('xmlns="http://www.w3.org/2000/svg"', ''))) fail('forbidden_reference_or_attribute');

  const lines = source.endsWith('\n') ? source.slice(0, -1).split('\n') : source.split('\n');
  if (lines[0] !== ROOT_LINE) fail('root_dimensions_or_attributes');
  if (lines[1] !== BACKGROUND_LINE) fail('opaque_background');
  if (lines.at(-1) !== CLOSE_LINE) fail('root_close');

  const expected = generateStarRecords();
  const circleLines = lines.slice(2, -1);
  if (circleLines.length !== EXPECTED_CIRCLE_COUNT) fail('circle_count');
  const circlePattern = /^<circle cx="(-?\d+)" cy="(\d+)" r="(1|1\.5|2\.5)" fill="(#a9bed8|#d9e8f7|#fff4d6)" opacity="(\.28|\.40|\.58|\.80)"\/>$/;
  circleLines.forEach((line, index) => {
    if (!circlePattern.test(line)) fail(`circle_syntax:${index}`);
    if (line !== circleLine(expected.records[index] || {})) fail(`circle_sequence:${index}`);
  });

  const expectedSource = generateSvg();
  if (source !== expectedSource) fail('generated_bytes_drift');
  return {
    ok: failures.length === 0,
    failures: [...new Set(failures)],
    width: WIDTH,
    height: HEIGHT,
    logical_star_count: LOGICAL_STAR_COUNT,
    circle_count: circleLines.length,
    seam_twin_count: expected.seamTwinCount,
    size_counts: expected.sizeCounts,
    opaque_background: '#02040a',
    external_reference_count: 0,
  };
}

function main() {
  const modes = process.argv.slice(2);
  if (modes.length !== 1 || !['--check', '--write'].includes(modes[0])) {
    throw new Error('Usage: node tools/authoring/generate-globe-starfield.js --check|--write');
  }
  const generated = Buffer.from(generateSvg(), 'utf8');
  if (modes[0] === '--write') {
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, generated);
    process.stdout.write(`Wrote ${path.relative(process.cwd(), OUTPUT_PATH)} (${generated.length} bytes; ${EXPECTED_CIRCLE_COUNT} circles)\n`);
    return;
  }
  const committed = fs.readFileSync(OUTPUT_PATH);
  assert.deepEqual(committed, generated, 'night-sky.svg is not the exact deterministic generator output');
  const inspection = inspectCanonicalSvg(committed);
  assert.equal(inspection.ok, true, `night-sky.svg safety validation failed: ${inspection.failures.join(', ')}`);
  process.stdout.write(`Globe starfield generator: PASS (${LOGICAL_STAR_COUNT} logical stars; ${inspection.seam_twin_count} seam twins; ${committed.length} bytes)\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Globe starfield generator: FAIL (${error.message})\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  BACKGROUND_LINE,
  EXPECTED_CIRCLE_COUNT,
  EXPECTED_SIZE_COUNTS,
  HEIGHT,
  LOGICAL_STAR_COUNT,
  OUTPUT_PATH,
  SEED,
  WIDTH,
  generateStarRecords,
  generateSvg,
  inspectCanonicalSvg,
};
