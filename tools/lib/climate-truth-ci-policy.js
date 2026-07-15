'use strict';

const crypto = require('crypto');

const POLICY_VERSION = '1.0.0';
const PROHIBITED_PHRASES = Object.freeze(['On track', 'No target', 'composite score']);
const PROHIBITED_FIELDS = new Set(['composite_score', 'overall_score', 'climate_score', 'on_track', 'cat_score', 'reality_gap_mt']);

function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
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
      !Array.isArray(diff.changed_entity_ids) || !Array.isArray(diff.source_revision_ids) || !isSha(diff.diff_hash)) {
    add(failures, 'release_diff_invalid', 'release_diff', 'Release diff lacks version lineage, entity/source changes, summary, or hash.');
  }
  const review = diff.review || {};
  if (review.status !== 'reviewed' || !isText(review.builder_id) || !isText(review.reviewer_id) ||
      review.builder_id === review.reviewer_id || !isText(review.reviewed_at)) {
    add(failures, 'release_diff_not_reviewed', 'release_diff.review', 'Release diff lacks independent review.');
  }
}

function auditFacts(facts, sources, methodologyVersion, failures) {
  const sourceMap = new Map((sources || []).map((source) => [source.source_id, source]));
  const factIds = new Set((facts || []).map((fact) => fact.fact_id));
  for (const fact of facts || []) {
    const subject = fact.fact_id || 'fact:missing';
    const source = sourceMap.get(fact.source_id);
    if (!source || !source.licence || source.licence.redistribution_approved !== true ||
        !isText(source.licence.decision_id) || source.checksum_sha256 !== fact.source_checksum_sha256) {
      add(failures, 'fact_licence_missing', subject, 'Fact lacks an approved pinned source decision.');
    }
    const review = fact.review || {};
    if (review.status !== 'reviewed' || !isText(review.extractor_id) || !isText(review.reviewer_id) ||
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
  auditFacts(input.facts, input.sources, input.methodology_version, failures);
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

module.exports = { POLICY_VERSION, evaluateTruthPolicy, resolveRunStatus };
