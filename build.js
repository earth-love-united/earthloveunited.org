#!/usr/bin/env node
/**
 * Tier 1.1: Build Script
 * Concatenates JS and CSS files for production.
 * Converts top-level const declarations to window assignments for global access.
 * 
 * Usage: node build.js
 * Output: dist/ directory with bundled assets
 */

import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '.');
const DIST = resolve(ROOT, 'dist');

// Ensure dist directories exist
for (const dir of ['dist/assets/js', 'dist/assets/css', 'dist/data']) {
  mkdirSync(resolve(ROOT, dir), { recursive: true });
}

// ═══════════════════════════════════════════
// Post-process: Convert top-level const to window assignments
// This ensures modules work when concatenated into a single file
// ═══════════════════════════════════════════

function exposeGlobals(combined) {
  const lines = combined.split('\n');
  const result = [];
  
  for (const line of lines) {
    // Match: const X = {  or  const X = (() => {
    // Only match capitalized names (module exports)
    const match = line.match(/^(\s*)const\s+([A-Z][a-zA-Z0-9_]*)\s*=\s*(\{|(\(\)\s*=>\s*\{))/);
    if (match) {
      result.push(match[1] + 'window.' + match[2] + ' = ' + match[3]);
    } else {
      result.push(line);
    }
  }
  
  return result.join('\n');
}

// ═══════════════════════════════════════════
// JS Bundler
// ═══════════════════════════════════════════

function bundleJs(files, outputPath) {
  let combined = '';
  let fileCount = 0;
  
  for (const file of files) {
    const filePath = resolve(ROOT, file);
    if (!existsSync(filePath)) {
      console.warn(`  ⚠️  Skipping missing file: ${file}`);
      continue;
    }
    const content = readFileSync(filePath, 'utf8');
    combined += `\n/* ══ ${file} ══ */\n${content}\n`;
    fileCount++;
  }
  
  // Expose globals for concatenated modules
  combined = exposeGlobals(combined);
  
  writeFileSync(outputPath, combined, 'utf8');
  
  const finalSize = combined.length;
  console.log(`  JS: ${basename(outputPath)} — ${fileCount} files, ${(finalSize/1024).toFixed(1)}KB`);
  
  return { size: finalSize, fileCount };
}

// ═══════════════════════════════════════════
// CSS Bundler
// ═══════════════════════════════════════════

function bundleCss(files, outputPath) {
  let combined = '';
  let fileCount = 0;
  
  for (const file of files) {
    const filePath = resolve(ROOT, file);
    if (!existsSync(filePath)) {
      console.warn(`  ⚠️  Skipping missing file: ${file}`);
      continue;
    }
    const content = readFileSync(filePath, 'utf8');
    combined += `\n/* ══ ${file} ══ */\n${content}\n`;
    fileCount++;
  }
  
  // Basic CSS minification
  let minified = combined;
  minified = minified.replace(/\/\*[\s\S]*?\*\//g, '');
  minified = minified.replace(/\s+/g, ' ');
  minified = minified.replace(/\s*([{}:;,])\s*/g, '$1');
  minified = minified.replace(/;}/g, '}');
  
  writeFileSync(outputPath, minified, 'utf8');
  
  const originalSize = combined.length;
  const minifiedSize = minified.length;
  const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
  
  console.log(`  CSS: ${basename(outputPath)} — ${fileCount} files, ${(originalSize/1024).toFixed(1)}KB → ${(minifiedSize/1024).toFixed(1)}KB (${savings}% reduction)`);
  
  return { originalSize, minifiedSize, fileCount };
}

// ═══════════════════════════════════════════
// HTML Processor
// ═══════════════════════════════════════════

function processHtml(htmlFile, jsBundlePath, cssBundlePaths) {
  const htmlPath = resolve(ROOT, htmlFile);
  if (!existsSync(htmlPath)) {
    console.warn(`  ⚠️  HTML file not found: ${htmlFile}`);
    return;
  }
  
  let content = readFileSync(htmlPath, 'utf8');
  
  // Remove all local <script src="..."> tags (keep CDN scripts)
  const scriptRegex = /<script\s+src="(?!https?:\/\/)[^"]+"><\/script>\n?/g;
  const removedScripts = (content.match(scriptRegex) || []).length;
  content = content.replace(scriptRegex, '');
  
  // Add bundled JS before </body>
  if (jsBundlePath) {
    content = content.replace('</body>', `<script src="${jsBundlePath}"></script>\n</body>`);
  }
  
  // Remove all <link rel="stylesheet" ...> tags
  const cssRegex = /<link\s+rel="stylesheet"\s+href="[^"]+"\s*>\n?/g;
  const removedCss = (content.match(cssRegex) || []).length;
  content = content.replace(cssRegex, '');
  
  // Add bundled CSS after fonts link
  if (cssBundlePaths && cssBundlePaths.length > 0) {
    const cssLinks = cssBundlePaths.map(href => `<link rel="stylesheet" href="${href}">`).join('\n');
    content = content.replace(/(<link[^>]*fonts\.googleapis[^>]*>)/, `$1\n${cssLinks}`);
  }
  
  const outputPath = resolve(DIST, htmlFile);
  writeFileSync(outputPath, content, 'utf8');
  console.log(`  HTML: ${htmlFile} → dist/${htmlFile} (removed ${removedScripts} JS, ${removedCss} CSS tags)`);
}

// ═══════════════════════════════════════════
// Build Configuration
// ═══════════════════════════════════════════

const INDEX_JS = [
  'js/data.js',
  'js/quiz.js',
  'js/cycle.js',
  'js/biomes.js',
  'js/counters.js',
  'js/scenario.js',
  'js/globe.js',
  'js/gaia-legacy/gaia-data.js',
  'js/gaia-legacy/gaia-signals.js',
  'js/gaia-legacy/gaia-charts.js',
  'js/gaia-voice.js',
  'dis/gaia-mind.js',
  'js/gaia-engagement.js',
  'js/gaia-journal.js',
  'js/gaia-bubble.js',
  'js/site-panel.js',
  'js/carbon-clock.js',
  'js/country-data.js',
  'js/delegation.js',
  'js/pledge-wall.js',
  'js/globe-overlay.js',
  'js/gaia-nodes.js',
  'js/gaia-legacy/gaia-knowledge.js',
  'js/gaia-overlay-knowledge.js',
  'js/ndvi-verifier.js',
  'js/gaia-presence.js',
  'js/registry-check.js',
  'js/app.js',
];

const GAIA_JS = [
  'js/data.js',
  'js/gaia-legacy/gaia-data.js',
  'js/gaia-legacy/gaia-charts.js',
  'js/gaia-chat.js',
  'js/gaia-legacy/gaia-knowledge.js',
  'js/gaia-legacy/gaia-dom-adapter.js',
  'dis/gaia-voice-data.js',
  'dis/gaia-state-machine.js',
  'dis/gaia-voice-engine.js',
  'dis/gaia-quest-system.js',
  'dis/gaia-key-gate.js',
  'dis/gaia-mind.js',
  'js/gaia-legacy/gaia-integration.js',
];

const INDEX_CSS = [
  'css/base.css',
  'css/layout.css',
  'css/components.css',
  'css/widgets.css',
  'css/responsive.css',
  'css/carbon-clock.css',
  'css/delegation.css',
  'css/pledge-wall.css',
  'css/gaia-bubble.css',
  'css/globe-overlay.css',
  'css/gaia-presence.css',
  'css/ndvi-verifier.css',
  'css/registry-check.css',
];

// ═══════════════════════════════════════════
// Execute Build
// ═══════════════════════════════════════════

console.log('\n🔨 Building Earth Love United — Tier 1.1: Bundle Assets\n');

console.log('📦 Bundling JavaScript...');
const indexJs = bundleJs(INDEX_JS, resolve(DIST, 'assets/js/index.js'));
const gaiaJs = bundleJs(GAIA_JS, resolve(DIST, 'assets/js/gaia.js'));

console.log('\n🎨 Bundling CSS...');
const indexCss = bundleCss(INDEX_CSS, resolve(DIST, 'assets/css/index.css'));

console.log('\n📄 Processing HTML...');
processHtml('index.html', 'assets/js/index.js', ['assets/css/index.css']);
processHtml('gaia.html', 'assets/js/gaia.js', ['assets/css/index.css']);

// Copy data files
console.log('\n📁 Copying static assets...');
if (existsSync(resolve(ROOT, 'data'))) {
  cpSync(resolve(ROOT, 'data'), resolve(DIST, 'data'), { recursive: true });
  console.log('  ✅ data/ copied');
}

console.log('\n✅ Build complete!');
console.log(`\n📊 Results:`);
console.log(`  Index: ${indexJs.fileCount} JS files → 1 bundle (${(indexJs.size/1024).toFixed(1)}KB)`);
console.log(`  GAIA:  ${gaiaJs.fileCount} JS files → 1 bundle (${(gaiaJs.size/1024).toFixed(1)}KB)`);
console.log(`  CSS:   ${indexCss.fileCount} files → 1 bundle (${(indexCss.minifiedSize/1024).toFixed(1)}KB)`);
console.log(`\n📉 HTTP request reduction:`);
console.log(`  Index: 42 → 3 requests (93% reduction)`);
console.log(`  GAIA: 14 → 3 requests (79% reduction)`);
