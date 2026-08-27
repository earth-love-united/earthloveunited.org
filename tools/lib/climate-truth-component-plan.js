'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { PATHS: CCI_RELEASE_PATHS } = require('./country-climate-intelligence-release-gate');
const { PROFILE_CCI } = require('./public-climate-release-profile');

const CCI_AUTHORITY_PATHS = Object.freeze([
  CCI_RELEASE_PATHS.approval,
  CCI_RELEASE_PATHS.releaseDiff,
  CCI_RELEASE_PATHS.runtimeManifest,
  CCI_RELEASE_PATHS.rollbackProof,
  CCI_RELEASE_PATHS.signatures,
]);
const CCI_COMPONENTS = Object.freeze([
  Object.freeze({
    id: 'CCI-V1',
    script: 'tools/check-country-climate-intelligence-ci.js',
    profiles: [PROFILE_CCI],
    phases: ['candidate'],
    required: true,
  }),
  Object.freeze({
    id: 'CCI-RELEASE',
    script: 'tools/check-country-climate-intelligence-release-gate.js',
    args: ['--require-release'],
    profiles: [PROFILE_CCI],
    phases: ['release'],
    required: true,
  }),
]);

function cciReleasePhase(root, entryPresent = null) {
  const present = entryPresent || function (relative) {
    return fs.existsSync(path.join(root, relative));
  };
  const found = CCI_AUTHORITY_PATHS.filter(present);
  if (found.length === 0) return 'candidate';
  if (found.length === CCI_AUTHORITY_PATHS.length) return 'release';
  throw new Error('Country Climate Intelligence release authority package is partial: ' + found.join(', '));
}

function componentPlan(components, profile, phase) {
  return components.filter((component) =>
    (!component.profiles || component.profiles.includes(profile)) &&
    (!component.phases || component.phases.includes(phase)));
}

module.exports = {
  CCI_AUTHORITY_PATHS,
  CCI_COMPONENTS,
  cciReleasePhase,
  componentPlan,
};
