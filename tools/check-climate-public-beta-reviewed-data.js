#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  prepareProposal,
  sealProposal,
  validateSealedRuntime,
  runSelfTest,
} = require('./lib/climate-public-beta-reviewed-data');

const DEFAULT_ROOT = path.resolve(__dirname, '..');
const VALUE_OPTIONS = new Set([
  '--root',
  '--source',
  '--release-id',
  '--data-builder-identity',
  '--rights-preparer-identity',
  '--proposal-dir',
  '--prior-corrections',
  '--output',
  '--verification-time',
]);
const MODES = new Set(['--self-test', '--prepare', '--seal', '--check']);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseArguments(argv) {
  const values = {};
  const modes = [];
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (MODES.has(item)) {
      assert(!modes.includes(item), `duplicate mode: ${item}`);
      modes.push(item);
      continue;
    }
    assert(VALUE_OPTIONS.has(item), `unknown argument: ${item}`);
    assert(!Object.hasOwn(values, item), `duplicate option: ${item}`);
    const value = argv[index + 1];
    assert(typeof value === 'string' && value.length > 0 && !value.startsWith('--'), `${item} requires a value`);
    values[item] = value;
    index += 1;
  }
  assert(modes.length === 1, 'choose exactly one mode: --self-test, --prepare, --seal, or --check');
  return { mode: modes[0], values };
}

function selectedRoot(values) {
  if (values['--root']) assert(path.isAbsolute(values['--root']), '--root must be an absolute path');
  const root = path.resolve(values['--root'] || DEFAULT_ROOT);
  const stat = fs.lstatSync(root);
  assert(stat.isDirectory() && !stat.isSymbolicLink(), '--root must be a regular non-symlink directory');
  return root;
}

function requireOnly(values, required, optional) {
  const allowed = new Set(required.concat(optional));
  required.forEach(name => assert(Object.hasOwn(values, name), `${name} is required`));
  Object.keys(values).forEach(name => assert(allowed.has(name), `${name} is not valid for this mode`));
}

async function main() {
  const { mode, values } = parseArguments(process.argv.slice(2));
  if (mode === '--self-test') {
    requireOnly(values, [], ['--root']);
    const report = await runSelfTest(selectedRoot(values));
    process.stdout.write(`Climate Public Beta reviewed-data finalizer: PASS (${report.positive_checks} positive checks; ${report.fail_closed_mutations} fail-closed mutations; ${report.runtime_files} exact runtime files; first/later correction histories; ${report.data_review_pins}/${report.later_release_data_review_pins} initial/later data-review pins; ${report.rights_review_pins} rights-review pins; ephemeral Ed25519 only)\n`);
    return;
  }

  const root = selectedRoot(values);
  const releaseId = values['--release-id'];
  if (mode === '--prepare') {
    requireOnly(values,
      ['--source', '--release-id', '--data-builder-identity', '--rights-preparer-identity'],
      ['--root', '--proposal-dir', '--prior-corrections']);
    assert(path.isAbsolute(values['--source']), '--source must be an absolute path');
    if (values['--proposal-dir']) assert(path.isAbsolute(values['--proposal-dir']), '--proposal-dir must be an absolute path');
    if (values['--prior-corrections']) assert(path.isAbsolute(values['--prior-corrections']),
      '--prior-corrections must be an absolute path');
    const result = await prepareProposal({
      root,
      rawSourcePath: path.resolve(values['--source']),
      releaseId,
      dataBuilderIdentity: values['--data-builder-identity'],
      rightsPreparerIdentity: values['--rights-preparer-identity'],
      proposalDir: values['--proposal-dir'] ? path.resolve(values['--proposal-dir']) : null,
      priorCorrectionsPath: values['--prior-corrections']
        ? path.resolve(values['--prior-corrections'])
        : null,
    });
    process.stdout.write(JSON.stringify({
      status: 'private_review_proposal_prepared',
      beta_release_id: releaseId,
      proposal_dir: result.proposal_dir,
      proposal_descriptor_sha256: result.descriptor_sha256,
      data_review_pins: result.review_pins.data_review,
      rights_review_pins: result.review_pins.rights_review,
      prior_correction_input: result.descriptor.prior_correction_input,
      publication_authority: false,
      assessed_production_authority: false,
      next_human_actions: [
        'Have the genuine rights reviewer sign the exact rights_review reviewed_artifacts listed by this proposal plus its descriptor pin.',
        'Have an independent data reviewer sign the exact data_review reviewed_artifacts listed by this proposal plus its descriptor pin.',
        'Keep private signing keys offline; provide only public trust-registry keys and detached signature bundles.',
      ],
    }, null, 2) + '\n');
    return;
  }

  if (mode === '--seal') {
    requireOnly(values, ['--release-id', '--proposal-dir', '--output'], ['--root', '--verification-time']);
    assert(path.isAbsolute(values['--proposal-dir']), '--proposal-dir must be an absolute path');
    assert(path.isAbsolute(values['--output']), '--output must be an absolute path');
    const result = sealProposal({
      root,
      releaseId,
      proposalDir: path.resolve(values['--proposal-dir']),
      outputDir: path.resolve(values['--output']),
      verificationTime: values['--verification-time'],
    });
    process.stdout.write(JSON.stringify({
      status: result.status,
      beta_release_id: releaseId,
      output_dir: result.output_dir,
      artifacts: result.pins.filter(pin => pin.path.startsWith(`data/climate/public-beta/runtime/releases/${releaseId}/`)),
      data_review_pins: result.reviews.data_pins,
      rights_review_pins: result.reviews.rights_pins,
      assessed_production_authority: false,
    }, null, 2) + '\n');
    return;
  }

  requireOnly(values, ['--release-id'], ['--root', '--verification-time']);
  const report = validateSealedRuntime({
    root,
    releaseId,
    verificationTime: values['--verification-time'],
  });
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

main().catch(error => {
  process.stderr.write(`Climate Public Beta reviewed-data finalizer: FAIL — ${error.message}\n`);
  process.exitCode = 1;
});
