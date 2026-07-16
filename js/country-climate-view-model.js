/**
 * COUNTRY_CLIMATE_VIEW_MODEL — truthful presentation adapter for CT-22 profiles.
 *
 * This module is intentionally not loaded by index.html yet. CT-22 must freeze
 * its release shape before the globe and country card consume this adapter.
 */
const COUNTRY_CLIMATE_VIEW_MODEL = (() => {
  'use strict';

  const VERSION = '0.1.0';
  const CARD_SECTION_ORDER = [
    'identity',
    'responsibility',
    'commitment',
    'ambition',
    'delivery',
    'fair_contribution',
    'evidence',
    'projects_separate',
  ];

  const LABELS = {
    impact: {
      very_high: 'Very high impact',
      high: 'High impact',
      medium: 'Medium impact',
      low: 'Low impact',
      not_assessed: 'Impact not assessed',
    },
    target: {
      comparable: 'Target comparable',
      partially_comparable: 'Target partly comparable',
      non_comparable: 'Target not comparable',
      qualitative_or_sectoral: 'Qualitative or sectoral target',
      no_active_target_found: 'No documented active target',
      not_assessed: 'Target not assessed',
    },
    ambition: {
      aligned: 'Aligned ambition',
      almost_sufficient: 'Almost sufficient ambition',
      insufficient: 'Insufficient ambition',
      highly_insufficient: 'Highly insufficient ambition',
      critically_insufficient: 'Critically insufficient ambition',
      not_assessed: 'Ambition not assessed',
    },
    delivery: {
      ahead: 'Ahead of required pace',
      on_pace: 'On pace',
      uncertain: 'Pace uncertain',
      off_course: 'Off course',
      not_assessed: 'Progress not assessed',
    },
  };

  const DELIVERY_PRESENTATION = {
    ahead: { cue: 'double_chevron', tone: 'positive' },
    on_pace: { cue: 'checkmark', tone: 'positive' },
    uncertain: { cue: 'uncertainty_diamond', tone: 'unknown' },
    off_course: { cue: 'warning_triangle', tone: 'negative' },
    not_assessed: { cue: 'open_circle', tone: 'unknown' },
  };

  const EVIDENCE_BLOCKERS = new Set([
    'conflicting',
    'stale',
    'stale_source',
    'not_reviewed',
    'climate_evidence_not_reviewed',
    'source_not_reviewed',
    'source_missing',
    'source_unavailable',
    'licence_not_approved',
    'value_withheld',
    'unresolved_source_conflict',
  ]);

  const CONTROLLED_REASON_COPY = {
    climate_evidence_not_reviewed: 'Climate evidence has not completed independent review.',
    source_not_reviewed: 'The source has not completed review.',
    source_missing: 'A required source is missing.',
    source_unavailable: 'The approved source is unavailable.',
    licence_not_approved: 'The value is withheld pending licence approval.',
    value_not_reported: 'The value was not reported.',
    value_withheld: 'The value is withheld from this release.',
    reporting_not_yet_due: 'Reporting is not yet due.',
    reporting_optional: 'Reporting is optional in this context; this is not a performance result.',
    stale_source: 'The latest approved source is stale.',
    unresolved_source_conflict: 'Official and harmonized evidence conflict.',
    target_not_found: 'No documented active target was found in the approved release.',
    target_expired: 'The documented target is no longer active.',
    qualitative_target: 'The target is qualitative and cannot be normalized to an absolute endpoint.',
    sectoral_target: 'The target covers selected sectors and is not economy-wide comparable.',
    reference_value_missing: 'The target reference value is missing.',
    intensity_denominator_missing: 'The target-year intensity denominator is missing.',
    scope_mismatch: 'The target and observation scopes do not match.',
    evidence_insufficient: 'Evidence is insufficient for this assessment.',
    independent_review_required: 'Independent review is required before assessment.',
  };

  function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function axis(profile, name, fallback) {
    const axes = asObject(profile.axes);
    const value = Object.prototype.hasOwnProperty.call(axes, name) ? axes[name] : profile[name];
    return Object.assign({}, fallback || {}, asObject(value));
  }

  function list(value) {
    return Array.isArray(value) ? value.slice() : [];
  }

  function unique(values) {
    return Array.from(new Set(values.filter(value => typeof value === 'string' && value.length > 0)));
  }

  function safeEnum(value, dictionary, fallback) {
    return Object.prototype.hasOwnProperty.call(dictionary, value) ? value : fallback;
  }

  function targetIntegrity(target) {
    return safeEnum(target.integrity || target.value, LABELS.target, 'not_assessed');
  }

  function impactBand(impact) {
    if (impact.state && impact.state !== 'available' && impact.state !== 'conflicting') return 'not_assessed';
    return safeEnum(impact.band || impact.value, LABELS.impact, 'not_assessed');
  }

  function evidenceFlags(evidence, profile) {
    const release = asObject(profile.release);
    return unique(list(evidence.flags).concat(list(evidence.reason_codes), list(release.reason_codes)));
  }

  function gatedDelivery(delivery, target, evidence, profile) {
    const requested = safeEnum(delivery.value, LABELS.delivery, 'not_assessed');
    const flags = evidenceFlags(evidence, profile);
    const hasBlocker = flags.some(flag => EVIDENCE_BLOCKERS.has(flag));
    const comparable = targetIntegrity(target) === 'comparable';
    const available = delivery.state === 'available';
    const gatePassed = delivery.evidence_gate_passed === true;

    if (!available || !comparable || !gatePassed || hasBlocker) return 'not_assessed';
    return requested;
  }

  function targetMarker(integrity, impact) {
    if (integrity === 'comparable') return { cue: 'target_ring', tone: 'neutral' };
    if (integrity === 'no_active_target_found' && (impact === 'very_high' || impact === 'high')) {
      return { cue: 'target_absent_warning', tone: 'caution' };
    }
    if (integrity === 'no_active_target_found') return { cue: 'target_absent', tone: 'neutral' };
    if (integrity === 'qualitative_or_sectoral') return { cue: 'partial_target_shape', tone: 'neutral' };
    if (integrity === 'non_comparable' || integrity === 'partially_comparable') {
      return { cue: 'broken_target_ring', tone: 'caution' };
    }
    return { cue: 'open_circle', tone: 'unknown' };
  }

  function reasonText(codes) {
    return unique(codes).map(code => CONTROLLED_REASON_COPY[code] || ('Assessment reason: ' + code.replace(/_/g, ' ') + '.'));
  }

  function evidenceLabel(evidence) {
    const grade = /^[ABCD]$/.test(evidence.grade || '') ? evidence.grade : 'D';
    return 'Evidence ' + grade;
  }

  function ambitionLabel(ambition) {
    if (ambition.state !== 'available') return LABELS.ambition.not_assessed;
    const key = safeEnum(ambition.value, LABELS.ambition, 'not_assessed');
    return LABELS.ambition[key];
  }

  function preserveValue(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key) ? object[key] : null;
  }

  function usableObservation(observation) {
    return Object.prototype.hasOwnProperty.call(observation, 'value') &&
      observation.value !== null &&
      typeof observation.value === 'number' &&
      Number.isFinite(observation.value) &&
      typeof observation.year === 'number' &&
      Number.isFinite(observation.year) &&
      typeof observation.unit === 'string' && observation.unit.length > 0 &&
      typeof observation.scope === 'string' && observation.scope.length > 0;
  }

  function provenanceHook(profile, evidence) {
    const release = asObject(profile.release);
    const provenance = asObject(evidence.provenance);
    return {
      release_id: preserveValue(release, 'release_id'),
      methodology_version: preserveValue(release, 'methodology_version'),
      last_reviewed_at: preserveValue(evidence, 'last_reviewed_at'),
      source_ids: list(provenance.source_ids),
      fact_ids: list(provenance.fact_ids),
      lineage_hash: preserveValue(provenance, 'lineage_hash'),
    };
  }

  function build(profileInput) {
    const profile = asObject(profileInput);
    const identity = axis(profile, 'identity');
    const impact = axis(profile, 'impact', { state: 'not_assessed', band: 'not_assessed' });
    const target = axis(profile, 'target_integrity', axis(profile, 'target'));
    const ambition = axis(profile, 'ambition', { state: 'not_assessed', value: null });
    const delivery = axis(profile, 'delivery', { state: 'not_assessed', value: null });
    const fairContribution = axis(profile, 'fair_contribution', { state: 'not_assessed' });
    const evidence = axis(profile, 'evidence', { grade: 'D', flags: [] });
    const projects = asObject(profile.projects);

    const impactKey = impactBand(impact);
    const integrityKey = targetIntegrity(target);
    const deliveryKey = gatedDelivery(delivery, target, evidence, profile);
    const deliveryStyle = DELIVERY_PRESENTATION[deliveryKey];
    const flags = evidenceFlags(evidence, profile);
    const conflict = flags.includes('conflicting') || flags.includes('unresolved_source_conflict');
    const withheld = flags.includes('licence_not_approved') || flags.includes('value_withheld');
    const stale = flags.includes('stale') || flags.includes('stale_source');
    const targetReasons = unique(list(target.reason_codes));
    const allReasons = unique(targetReasons.concat(flags));
    const targetLabel = LABELS.target[integrityKey];
    const impactLabel = LABELS.impact[impactKey];
    const deliveryLabel = LABELS.delivery[deliveryKey];
    const evidenceGradeLabel = evidenceLabel(evidence);
    const ambitionHeadline = ambition.state === 'available' ? ambitionLabel(ambition) : targetLabel;
    const headlineParts = [impactLabel, ambitionHeadline, deliveryLabel, evidenceGradeLabel];
    if (conflict) headlineParts.push('Evidence conflict');

    const latestObservation = asObject(impact.latest_observation);
    const impactRankingCandidate = impactKey !== 'not_assessed' && usableObservation(latestObservation) && (
      impact.state === 'available' || (impact.state === 'conflicting' && typeof impact.plane === 'string' && impact.plane.length > 0)
    );
    const overshootRankingCandidate = impactRankingCandidate &&
      integrityKey === 'comparable' &&
      target.normalized_endpoint != null &&
      target.scope_match === true &&
      !flags.some(flag => EVIDENCE_BLOCKERS.has(flag));

    return {
      view_model_version: VERSION,
      country_id: preserveValue(identity, 'country_id'),
      entity_label: preserveValue(identity, 'name'),
      headline: headlineParts.join(' · '),
      accessible_summary: headlineParts.join('. ') + '.',
      composite_score: null,
      axes: [
        { id: 'impact', label: impactLabel, state: impact.state || 'not_assessed' },
        { id: 'target_integrity', label: targetLabel, state: integrityKey },
        { id: 'ambition', label: ambitionLabel(ambition), state: ambition.state || 'not_assessed', benchmark: preserveValue(ambition, 'benchmark') },
        { id: 'delivery', label: deliveryLabel, state: deliveryKey },
        { id: 'fair_contribution', label: fairContribution.label || 'Fair contribution context', state: fairContribution.state || 'not_assessed' },
        { id: 'evidence', label: evidenceGradeLabel, state: evidence.state || 'available' },
      ],
      globe: {
        impact_height: impactKey === 'not_assessed' ? 'geographic_minimum_unknown' : impactKey,
        face_treatment: impactKey === 'not_assessed' ? 'unknown_visible_pattern' : 'impact_sequential_' + impactKey,
        impact_label: impactLabel,
        target_marker: Object.assign({ label: targetLabel }, targetMarker(integrityKey, impactKey)),
        delivery_marker: { label: deliveryLabel, cue: deliveryStyle.cue, tone: deliveryStyle.tone },
        evidence_marker: {
          label: evidenceGradeLabel,
          cue: conflict ? 'split_plane_conflict' : (stale ? 'stale_clock' : (withheld ? 'withheld_lock' : 'evidence_grade')),
          tone: conflict || stale || withheld ? 'caution' : 'neutral',
        },
      },
      ranking: {
        emissions: {
          eligible: false,
          ordinal: null,
          state: impactRankingCandidate ? 'eligible_pending_shared_ranking' : 'not_ranked',
          group: impactRankingCandidate ? 'eligible_pending_shared_ranking' : 'not_ranked',
          reason: impactRankingCandidate ? null : (flags[0] || 'evidence_insufficient'),
        },
        overshoot: {
          eligible: false,
          ordinal: null,
          state: overshootRankingCandidate ? 'eligible_pending_shared_ranking' : 'not_ranked',
          reason: overshootRankingCandidate ? null : (targetReasons[0] || flags.find(flag => EVIDENCE_BLOCKERS.has(flag)) || 'evidence_insufficient'),
        },
      },
      card: {
        section_order: CARD_SECTION_ORDER.slice(),
        responsibility: {
          state: impact.state || 'not_assessed',
          impact_band: impactKey,
          latest_value: preserveValue(latestObservation, 'value'),
          year: preserveValue(latestObservation, 'year'),
          unit: preserveValue(latestObservation, 'unit'),
          scope: preserveValue(latestObservation, 'scope'),
          plane: preserveValue(impact, 'plane'),
        },
        commitment: {
          state: integrityKey,
          label: targetLabel,
          type: preserveValue(target, 'type'),
          normalized_endpoint: integrityKey === 'comparable' ? preserveValue(target, 'normalized_endpoint') : null,
          reasons: reasonText(targetReasons),
        },
        ambition: {
          state: ambition.state || 'not_assessed',
          label: ambitionLabel(ambition),
          benchmark: preserveValue(ambition, 'benchmark'),
        },
        delivery: {
          state: deliveryKey,
          label: deliveryLabel,
          level_gap: preserveValue(delivery, 'level_gap'),
          reasons: reasonText(unique(list(delivery.reason_codes).concat(flags.filter(flag => EVIDENCE_BLOCKERS.has(flag))))),
        },
        fair_contribution: {
          state: fairContribution.state || 'not_assessed',
          facts: list(fairContribution.facts),
        },
        evidence: {
          grade: evidenceGradeLabel.replace('Evidence ', ''),
          label: evidenceGradeLabel,
          flags,
          reasons: reasonText(allReasons),
          provenance: provenanceHook(profile, evidence),
        },
        projects_separate: {
          heading: 'Projects and markets',
          disclaimer: 'Not part of the national climate performance profile',
          state: projects.state || 'not_assessed',
          affects_profile: false,
        },
      },
      provenance: provenanceHook(profile, evidence),
    };
  }

  return { VERSION, CARD_SECTION_ORDER: CARD_SECTION_ORDER.slice(), build };
})();

if (typeof window !== 'undefined') window.COUNTRY_CLIMATE_VIEW_MODEL = COUNTRY_CLIMATE_VIEW_MODEL;

if (typeof hasModule === 'function' && hasModule('MODULE_CONTRACTS')) {
  safeCall('MODULE_CONTRACTS', 'register', 'COUNTRY_CLIMATE_VIEW_MODEL', {
    provides: ['build'],
    requires: [],
  });
}

if (typeof module !== 'undefined' && module.exports) module.exports = COUNTRY_CLIMATE_VIEW_MODEL;
