'use strict';

const crypto = require('crypto');
const { releaseDiffCalculationHash } = require('./climate-reviewed-release');

const POLICY_VERSION = '1.2.0';
const PROHIBITED_PHRASES = Object.freeze(['On track', 'No target', 'composite score']);
const PROHIBITED_FIELDS = new Set(['composite_score', 'overall_score', 'climate_score', 'on_track', 'cat_score', 'reality_gap_mt']);
const FACTUAL_USE_FLAGS = Object.freeze(['factual_display', 'time_series', 'magnitude_comparison', 'annual_emissions_ranking']);
const FORBIDDEN_CT10C_USE_FLAGS = Object.freeze([
  'target', 'commitment', 'delivery', 'performance', 'assessed_status', 'impact_bands',
  'composite', 'normative_scoring', 'scoring', 'runtime_profile'
]);

function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function isFiniteValue(value) {
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'string' && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function add(failures, code, subject, detail) {
  failures.push({ code, subject, detail });
}

function walk(value, callback, path = '$') {
  callback(value, path);
  if (Array.isArray(value)) value.forEach((item, index) => walk(item, callback, `${path}[${index}]`));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => walk(item, callback, `${path}.${key}`));
}

function auditRuntime(runtime, failures) {
  if (!runtime || runtime.review_status !== 'reviewed') {
    add(failures, 'runtime_not_reviewed', 'runtime', 'Reviewed runtime manifest is absent or not reviewed.');
    return;
  }
  const files = Array.isArray(runtime.files) ? runtime.files : [];
  const dataFiles = Array.isArray(runtime.data_files) ? runtime.data_files : [];
  if (!files.length) add(failures, 'runtime_files_missing', 'runtime.files', 'Reviewed runtime has no enumerated source files.');
  if (!dataFiles.length) add(failures, 'runtime_data_files_missing', 'runtime.data_files', 'Reviewed runtime has no enumerated profile/data artifact.');
  if ([...files.map((item) => item.path), ...dataFiles].some((item) => String(item).includes('pledge-nodes.json'))) {
    add(failures, 'legacy_runtime_load', 'runtime', 'Reviewed runtime loads legacy pledge-nodes.json.');
  }
  for (const file of files) {
    const content = String(file.content || '');
    if (content.includes('pledge-nodes.json')) add(failures, 'legacy_runtime_load', file.path, 'Legacy pledge payload referenced by reviewed runtime.');
    for (const phrase of PROHIBITED_PHRASES) {
      if (content.toLowerCase().includes(phrase.toLowerCase())) add(failures, 'prohibited_phrase', file.path, phrase);
    }
    for (const field of PROHIBITED_FIELDS) {
      if (new RegExp(`\\b${field}\\b`).test(content)) add(failures, 'prohibited_field', file.path, field);
    }
  }
  const claims = runtime.claims || {};
  walk(claims, (value, path) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    for (const key of Object.keys(value)) {
      if (PROHIBITED_FIELDS.has(key)) add(failures, 'prohibited_field', `runtime.claims${path.slice(1)}.${key}`, key);
    }
    const targetMissing = value.target_integrity === 'no_active_target_found' || value.target_status === 'no_active_target_found';
    const treatment = String(value.treatment || value.color || value.delivery || '').toLowerCase();
    if (targetMissing && /(green|positive|check|ahead|on_pace|on-pace)/.test(treatment)) {
      add(failures, 'ambiguous_no_target_positive', `runtime.claims${path.slice(1)}`, treatment);
    }
  });
  const rankings = Array.isArray(runtime.rankings) ? runtime.rankings : [];
  for (const ranking of rankings) {
    if (!isText(ranking.ranking_id) || !isText(ranking.metric) || !isText(ranking.unit) || !isText(ranking.period) ||
        !isText(ranking.plane) || !Array.isArray(ranking.source_fact_ids) || !ranking.source_fact_ids.length) {
      add(failures, 'unsourced_ranking', ranking.ranking_id || 'runtime.rankings', 'Ranking lacks metric, unit, period, plane, or source fact IDs.');
    }
  }
}

function auditManifest(manifest, failures) {
  if (!manifest || typeof manifest !== 'object') {
    add(failures, 'release_manifest_missing', 'release_manifest', 'Reviewed release manifest is absent.');
    return;
  }
  const decision = manifest.manifest || manifest;
  if (decision.decision !== 'allow' || decision.release_eligible !== true ||
      !Array.isArray(decision.reason_codes) || decision.reason_codes.length || !isSha(decision.calculation_hash)) {
    add(failures, 'release_manifest_denied', 'release_manifest', 'Release manifest is denied, inconsistent, or unhashed.');
  }
}

function auditReleaseDiff(diff, failures) {
  if (!diff || typeof diff !== 'object') {
    add(failures, 'release_diff_missing', 'release_diff', 'Reviewed release diff is absent.');
    return;
  }
  const initial = diff.initial_release === true;
  if (!isText(diff.data_release_id) || (!initial && !isText(diff.previous_release_id)) || !isText(diff.change_summary) ||
      !Array.isArray(diff.changed_entity_ids) || !Array.isArray(diff.source_revision_ids) || !isSha(diff.diff_hash) ||
      diff.diff_hash !== releaseDiffCalculationHash(diff)) {
    add(failures, 'release_diff_invalid', 'release_diff', 'Release diff lacks version lineage, entity/source changes, summary, or hash.');
  }
  const review = diff.review || {};
  if (review.status !== 'reviewed' || !isText(review.builder_id) || !isText(review.reviewer_id) ||
      review.builder_id === review.reviewer_id || !isText(review.reviewed_at)) {
    add(failures, 'release_diff_not_reviewed', 'release_diff.review', 'Release diff lacks independent review.');
  }
}

function normalizeRegistrySource(source) {
  if (!source || typeof source !== 'object') return null;
  return {
    source_id: source.id,
    version: source.version,
    checksum_sha256: source.artifact && source.artifact.sha256,
    licence_confirmed: Boolean(source.licence && source.licence.status === 'confirmed'),
    redistribution_permitted: Boolean(
      source.redistribution && source.redistribution.status === 'permitted' &&
      source.redistribution.normalized_values === true
    ),
    approval_recorded: Boolean(
      source.approval && source.approval.state === 'approved' && isText(source.approval.decision)
    )
  };
}

function auditBatchAttestations(attestations, facts, methodologyVersion, failures) {
  const factIds = new Set((facts || []).map((fact) => fact.fact_id));
  const map = new Map();
  for (const attestation of attestations || []) {
    const id = attestation && attestation.attestation_id;
    const subject = id || 'batch-attestation:missing';
    if (!isText(id) || map.has(id)) {
      add(failures, 'batch_attestation_invalid', subject, 'Batch attestation ID is absent or duplicated.');
      continue;
    }
    map.set(id, attestation);
    const review = attestation.review || {};
    if (attestation.decision !== 'pass' || review.status !== 'reviewed' ||
        !isText(review.builder_id) || !isText(review.reviewer_id) ||
        !isText(review.reviewed_at) || review.methodology_version !== methodologyVersion) {
      add(failures, 'batch_attestation_invalid', subject, 'Batch attestation is not a reviewed, version-matched pass.');
    }
    if (review.builder_id === review.reviewer_id) {
      add(failures, 'batch_attestation_self_review', subject, 'Batch builder and reviewer must be independent.');
    }
    const source = attestation.source || {};
    const artifact = attestation.artifact || {};
    if (!isText(attestation.batch_id) || !isText(source.source_id) || !isText(source.version) ||
        !isSha(source.checksum_sha256) || !isText(artifact.path) || !isSha(artifact.sha256) ||
        !isText(attestation._path) || !isSha(attestation._file_sha256)) {
      add(failures, 'batch_attestation_pin_mismatch', subject, 'Batch source, artifact, or attestation file is not exactly pinned.');
    }
    if (attestation.production_runtime_release !== false) {
      add(failures, 'fact_forbidden_use', subject, 'CT-10C cannot authorize production runtime release.');
    }
    if (!Array.isArray(attestation.fact_ids) || !attestation.fact_ids.length ||
        new Set(attestation.fact_ids).size !== attestation.fact_ids.length ||
        attestation.fact_ids.some((factId) => !factIds.has(factId))) {
      add(failures, 'batch_attestation_invalid', subject, 'Batch attestation must enumerate unique published fact IDs only.');
    }
  }
  return map;
}

function auditFactShape(fact, subject, failures) {
  if (!isText(fact.fact_id) || !isText(fact.entity_id) || !isText(fact.metric) ||
      !isFiniteValue(fact.value) || !isText(fact.unit) || !isText(fact.period) ||
      !isText(fact.plane) || !isText(fact.evidence_class) || !isText(fact.source_id) ||
      !isText(fact.source_version) || !isSha(fact.source_checksum_sha256) ||
      !isText(fact._artifact_path) || !isSha(fact._artifact_sha256)) {
    add(failures, 'fact_shape_invalid', subject, 'Published fact lacks its minimum factual value, period, plane, or source pin.');
  }
}

function auditAllowedUses(fact, subject, failures) {
  const uses = fact.allowed_uses;
  const expectedFlags = [...FACTUAL_USE_FLAGS, ...FORBIDDEN_CT10C_USE_FLAGS];
  const complete = uses && typeof uses === 'object' && !Array.isArray(uses) &&
    Object.keys(uses).length === expectedFlags.length &&
    Object.keys(uses).every((flag) => expectedFlags.includes(flag)) &&
    expectedFlags.every((flag) => typeof uses[flag] === 'boolean');
  if (!complete || FACTUAL_USE_FLAGS.some((flag) => uses[flag] !== true) ||
      FORBIDDEN_CT10C_USE_FLAGS.some((flag) => uses[flag] !== false)) {
    add(failures, 'fact_forbidden_use', subject, 'CT-10C facts may enable factual uses only; assessment, scoring, and runtime-profile uses must remain false.');
  }
}

function auditFacts(facts, sources, batchAttestations, methodologyVersion, failures) {
  if (!Array.isArray(facts) || !facts.length) {
    add(failures, 'release_facts_missing', 'facts', 'Reviewed release contains no published facts.');
  }
  const normalizedSources = (sources || []).map(normalizeRegistrySource).filter(Boolean);
  const sourceMap = new Map(normalizedSources.map((source) => [source.source_id, source]));
  const factIds = new Set((facts || []).map((fact) => fact.fact_id));
  const attestationMap = auditBatchAttestations(batchAttestations, facts, methodologyVersion, failures);
  for (const fact of facts || []) {
    const subject = fact.fact_id || 'fact:missing';
    auditFactShape(fact, subject, failures);
    auditAllowedUses(fact, subject, failures);
    const source = sourceMap.get(fact.source_id);
    if (!source) {
      add(failures, 'fact_source_missing', subject, 'Fact source is absent from the CT-01 registry.');
    } else {
      if (source.version !== fact.source_version) {
        add(failures, 'fact_source_version_mismatch', subject, 'Fact source version differs from the approved registry release.');
      }
      if (source.checksum_sha256 !== fact.source_checksum_sha256) {
        add(failures, 'fact_source_checksum_mismatch', subject, 'Fact source checksum differs from the approved registry artifact.');
      }
    }
    if (!source || !source.licence_confirmed || !source.redistribution_permitted || !source.approval_recorded) {
      add(failures, 'fact_licence_missing', subject, 'Fact lacks an approved pinned source decision.');
    }
    const review = fact.review || {};
    if (review.mode === 'batch_attestation') {
      if (review.status !== 'reviewed' || !isText(review.batch_attestation_id) ||
          !isSha(review.batch_artifact_sha256) || !isSha(review.batch_attestation_sha256) ||
          review.methodology_version !== methodologyVersion) {
        add(failures, 'fact_review_missing', subject, 'Fact lacks a pinned, version-matched batch review reference.');
        continue;
      }
      const attestation = attestationMap.get(review.batch_attestation_id);
      if (!attestation) {
        add(failures, 'batch_attestation_missing', subject, 'Referenced batch attestation is absent.');
      } else {
        const sourcePin = attestation.source || {};
        const artifactPin = attestation.artifact || {};
        if (attestation.fact_ids.indexOf(fact.fact_id) === -1 ||
            artifactPin.path !== fact._artifact_path || artifactPin.sha256 !== fact._artifact_sha256 ||
            artifactPin.sha256 !== review.batch_artifact_sha256 ||
            attestation._file_sha256 !== review.batch_attestation_sha256 ||
            sourcePin.source_id !== fact.source_id || sourcePin.version !== fact.source_version ||
            sourcePin.checksum_sha256 !== fact.source_checksum_sha256) {
          add(failures, 'batch_attestation_pin_mismatch', subject, 'Fact does not match its reviewed batch, artifact, attestation, or source pins.');
        }
      }
    } else if (review.status !== 'reviewed' || !isText(review.extractor_id) || !isText(review.reviewer_id) ||
        review.extractor_id === review.reviewer_id || !isText(review.reviewed_at) ||
        review.methodology_version !== methodologyVersion) {
      add(failures, 'fact_review_missing', subject, 'Fact lacks independent version-matched review.');
    }
    if (fact.evidence_class === 'derived' || fact.evidence_class === 'modeled') {
      const derivation = fact.derivation || {};
      if (!Array.isArray(derivation.input_fact_ids) || !derivation.input_fact_ids.length ||
          derivation.input_fact_ids.includes(fact.fact_id) || derivation.input_fact_ids.some((id) => !factIds.has(id)) ||
          !isText(derivation.transformation) || !isText(derivation.formula_version) ||
          derivation.methodology_version !== methodologyVersion || !isSha(derivation.calculation_hash)) {
        add(failures, 'fact_lineage_missing', subject, 'Transformed fact lacks inputs, formula, version, or calculation hash.');
      }
    }
  }
}

function auditEnums(canonicalReasons, embeddedEnums, failures) {
  for (const item of embeddedEnums || []) {
    if (!Array.isArray(item.values) || item.values.length !== canonicalReasons.length ||
        item.values.some((value, index) => value !== canonicalReasons[index])) {
      add(failures, 'canonical_enum_divergence', item.id || 'embedded_enum', 'Reason-code vocabulary or order diverges.');
    }
  }
}

function evaluateTruthPolicy(input) {
  const failures = [];
  auditRuntime(input.runtime, failures);
  auditManifest(input.release_manifest, failures);
  auditReleaseDiff(input.release_diff, failures);
  auditFacts(input.facts, input.sources, input.batch_attestations, input.methodology_version, failures);
  const publishedFactIds = new Set((input.facts || []).map((fact) => fact.fact_id));
  for (const ranking of (input.runtime && input.runtime.rankings) || []) {
    if (Array.isArray(ranking.source_fact_ids) && ranking.source_fact_ids.some((id) => !publishedFactIds.has(id))) {
      add(failures, 'unsourced_ranking', ranking.ranking_id || 'runtime.rankings', 'Ranking cites a fact absent from the reviewed release.');
    }
  }
  auditEnums(input.canonical_reason_codes || [], input.embedded_reason_enums || [], failures);
  if (input.generated_drift === true) add(failures, 'generated_drift', 'workspace', 'Generated climate artifacts differ from committed files.');
  failures.sort((a, b) => a.code.localeCompare(b.code) || a.subject.localeCompare(b.subject) || a.detail.localeCompare(b.detail));
  const output = {
    policy_version: POLICY_VERSION,
    status: failures.length ? 'fail' : 'pass',
    failures,
    calculation_hash: null
  };
  output.calculation_hash = digest(output);
  return output;
}

function resolveRunStatus({ hardFailure, missingCount, strict, allowIncomplete, reviewedCandidate }) {
  if (hardFailure) return { status: 'fail', exit_code: 1 };
  if (missingCount > 0) {
    if (strict || reviewedCandidate) return { status: 'fail', exit_code: 1 };
    if (allowIncomplete || !reviewedCandidate) return { status: 'incomplete', exit_code: 0 };
  }
  return { status: 'pass', exit_code: 0 };
}

module.exports = {
  POLICY_VERSION,
  FACTUAL_USE_FLAGS,
  FORBIDDEN_CT10C_USE_FLAGS,
  normalizeRegistrySource,
  evaluateTruthPolicy,
  resolveRunStatus
};
