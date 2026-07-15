#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');

function fail(message) {
  throw new Error(message);
}

function unzipEntry(workbookPath, entry) {
  const result = spawnSync('unzip', ['-p', workbookPath, entry], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) fail(`Unable to run unzip: ${result.error.message}`);
  if (result.status !== 0) {
    fail(`Unable to read ${entry} from workbook: ${result.stderr.trim() || `unzip exited ${result.status}`}`);
  }
  return result.stdout;
}

function decodeXml(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, decimal) => String.fromCodePoint(parseInt(decimal, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match ? decodeXml(match[1]) : null;
}

function textNodes(xml) {
  const values = [];
  const pattern = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
  let match;
  while ((match = pattern.exec(xml))) values.push(decodeXml(match[1]));
  return values.join('');
}

function readSharedStrings(workbookPath) {
  let xml;
  try {
    xml = unzipEntry(workbookPath, 'xl/sharedStrings.xml');
  } catch (error) {
    if (/caution: filename not matched/.test(error.message)) return [];
    throw error;
  }
  const strings = [];
  const pattern = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g;
  let match;
  while ((match = pattern.exec(xml))) strings.push(textNodes(match[1]));
  return strings;
}

function sheetPath(workbookPath, sheetName) {
  const workbook = unzipEntry(workbookPath, 'xl/workbook.xml');
  const relationships = unzipEntry(workbookPath, 'xl/_rels/workbook.xml.rels');
  let relationshipId = null;
  const sheetPattern = /<sheet\b[^>]*>/g;
  let sheet;
  while ((sheet = sheetPattern.exec(workbook))) {
    if (attribute(sheet[0], 'name') === sheetName) {
      relationshipId = attribute(sheet[0], 'r:id');
      break;
    }
  }
  if (!relationshipId) fail(`Workbook does not contain sheet "${sheetName}"`);

  const relationshipPattern = /<Relationship\b[^>]*>/g;
  let relationship;
  while ((relationship = relationshipPattern.exec(relationships))) {
    if (attribute(relationship[0], 'Id') !== relationshipId) continue;
    const target = attribute(relationship[0], 'Target');
    if (!target || target.includes('..')) fail(`Unsafe or missing worksheet target for ${sheetName}`);
    return target.startsWith('/') ? target.slice(1) : `xl/${target}`;
  }
  fail(`Workbook relationship ${relationshipId} is missing`);
}

function parseCell(cellTag, cellBody, sharedStrings) {
  const type = attribute(cellTag, 't');
  if (type === 'inlineStr') return textNodes(cellBody);
  const valueMatch = cellBody.match(/<v>([\s\S]*?)<\/v>/);
  if (!valueMatch) return null;
  const raw = decodeXml(valueMatch[1]);
  if (type === 's') {
    const index = Number(raw);
    if (!Number.isInteger(index) || sharedStrings[index] === undefined) {
      fail(`Invalid shared string index ${raw}`);
    }
    return sharedStrings[index];
  }
  if (type === 'str') return raw;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : raw;
}

function readSheet(workbookPath, sheetName) {
  const sharedStrings = readSharedStrings(workbookPath);
  const xml = unzipEntry(workbookPath, sheetPath(workbookPath, sheetName));
  const rows = [];
  const rowPattern = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
  let rowMatch;
  while ((rowMatch = rowPattern.exec(xml))) {
    const row = { _row: Number(attribute(`<row ${rowMatch[1]}>`, 'r')) };
    const cellPattern = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch;
    while ((cellMatch = cellPattern.exec(rowMatch[2]))) {
      const tag = `<c ${cellMatch[1]}>`;
      const reference = attribute(tag, 'r');
      if (!reference) fail(`Cell without reference in row ${row._row}`);
      const column = reference.replace(/[0-9]/g, '');
      row[column] = parseCell(tag, cellMatch[2] || '', sharedStrings);
    }
    rows.push(row);
  }
  return rows;
}

module.exports = { readSheet };
