'use strict';

const crypto = require('node:crypto');

const PACKAGE_ID = 'ct-17-source-rights-review-packets-2026-07-15';
const CREATED_AT = '2026-07-15T18:00:00Z';
const RETRIEVED_ON = '2026-07-15';
const PRIMAP_SHA256 = '7607f2b7c5b00d3ddbb19e5c7b100ff7bd8c2d8c2bfc8959c40f41d2cfecf4d9';
const PRIMAP_FILENAME = 'Guetschow_et_al_2025-PRIMAP-hist_v2.6.1_final_13-Mar-2025.csv';
const EXPECTED_SOURCE_REGISTRY_JSON_HASH = '0388bb245c0e09eb465813402878d9e396e1842d2abb25fe63179c3ce74f448b';
const SOURCE_IDS = Object.freeze([
  'primap-hist-2.6.1-final',
  'unfccc-ndc-registry-continuous-2026-07-15',
  'unfccc-nir-crt-2026-cycle',
  'unfccc-btr-continuous-2026-07-15',
  'unfccc-ter-continuous-2026-07-15',
]);
const EXPECTED_INPUT_SHA256 = Object.freeze({
  source_registry: 'ae32cc5799a96115d1b8568250638759020ff36cb1b6d1fa6aa032f56d07634d',
  ct15_readiness: 'bd1234b7e90d0bcf12940b0ee944d92bf64c42740b596efd26f88c66d98b22bb',
  ct16_policy: '911760896a34b9ef73bdd73f26dd2855e7f7b8eef1dc12e4435b6de695a627a0',
  ct16_queue: 'bb9a403375246718cef825f79565ced496b8dadfdd52566efcb7b37ad8a0eff8',
  ct40_result: '59e0229d58f42616a39546cc731d0ed2a24feef3726e10bda58bba515491abeb',
});
const DECISION_FIELDS = Object.freeze([
  'decision_id',
  'decision_outcome',
  'source_registry_id',
  'reviewer_id',
  'reviewer_role',
  'reviewer_independence_confirmed',
  'reviewed_at',
  'decision_by',
  'decision_at',
  'reviewed_scope_confirmed',
  'reviewed_source_version',
  'reviewed_source_checksum_sha256_or_per_document_checksums',
  'licence_identifier',
  'terms_url',
  'licence_evidence_url_or_written_clarification_reference',
  'rights_holder_or_licensor_authority_confirmed',
  'conflicting_terms_resolved',
  'document_specific_exceptions_reviewed',
  'source_files_approved',
  'metadata_and_links_approved',
  'normalized_values_approved',
  'redistribution_approved',
  'derivative_database_use_approved',
  'commercial_use_approved',
  'transformation_approved',
  'scoring_approved',
  'attribution_approved',
  'attribution_template',
  'required_change_notice',
  'restrictions',
  'decision_scope',
  'source_registry_change_required',
  'expires_or_recheck_at',
  'decision_notes',
]);
const CT15_REQUIRED_DECISION_FIELDS = Object.freeze([
  'decision_id',
  'source_registry_id',
  'reviewed_source_version',
  'reviewed_source_checksum_sha256_or_per_document_checksums',
  'licence_identifier',
  'terms_url',
  'licence_evidence_url_or_written_clarification_reference',
  'redistribution_approved',
  'scoring_approved',
  'source_files_approved',
  'normalized_values_approved',
  'attribution_template',
  'restrictions',
  'decision_by',
  'decision_at',
  'decision_notes',
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function hashJson(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function evidence(id, type, authority, title, url, pageState, facts) {
  return {
    evidence_id: id,
    evidence_type: type,
    authority,
    title,
    url,
    retrieved_on: RETRIEVED_ON,
    page_state: pageState,
    evidence_origin: 'official_primary_page',
    official_factual_summary: facts,
  };
}

const UNFCCC_TERMS_EVIDENCE = Object.freeze(evidence(
  'unfccc-terms-2026-07-15',
  'terms_page',
  'UNFCCC secretariat',
  'UNFCCC Terms of Use',
  'https://unfccc.int/this-site/terms-of-use',
  'mutable_live_page_no_local_copy',
  [
    'The copyright section describes official texts, data and documents as public domain and permits downloading, copying and printing only when content is unchanged and the source is acknowledged.',
    'The website-use section separately describes permission for personal, non-commercial downloading and copying, with no resale, redistribution, compilation or derivative works, and makes that permission subject to content-specific restrictions.',
    'The terms state that site content from UNFCCC and users is subject to the terms.',
    'The terms direct requests for exceptions or licensing information to the UNFCCC secretariat and state that exceptions require written permission.',
  ],
));

function blankDecision(sourceRegistryId) {
  return {
    decision_id: null,
    decision_outcome: null,
    source_registry_id: sourceRegistryId,
    reviewer_id: null,
    reviewer_role: null,
    reviewer_independence_confirmed: false,
    reviewed_at: null,
    decision_by: null,
    decision_at: null,
    reviewed_scope_confirmed: false,
    reviewed_source_version: null,
    reviewed_source_checksum_sha256_or_per_document_checksums: [],
    licence_identifier: null,
    terms_url: null,
    licence_evidence_url_or_written_clarification_reference: null,
    rights_holder_or_licensor_authority_confirmed: false,
    conflicting_terms_resolved: false,
    document_specific_exceptions_reviewed: false,
    source_files_approved: false,
    metadata_and_links_approved: false,
    normalized_values_approved: false,
    redistribution_approved: false,
    derivative_database_use_approved: false,
    commercial_use_approved: false,
    transformation_approved: false,
    scoring_approved: false,
    attribution_approved: false,
    attribution_template: null,
    required_change_notice: null,
    restrictions: [],
    decision_scope: null,
    source_registry_change_required: null,
    expires_or_recheck_at: null,
    decision_notes: null,
  };
}

function reviewAnalysis(ambiguities, restrictions, attributionQuestions, transformationQuestions, reviewerQuestions, counselQuestions) {
  return {
    analysis_origin: 'project_inference_for_authorized_review',
    ambiguities,
    restrictions_and_conditions_to_evaluate: restrictions,
    attribution_questions: attributionQuestions,
    transformation_questions: transformationQuestions,
    questions_for_authorized_reviewer: reviewerQuestions,
    questions_requiring_counsel_or_human_rights_review: counselQuestions,
  };
}

const CONFIGS = Object.freeze([
  {
    sourceId: SOURCE_IDS[0],
    packetId: 'ct17-rights-primap-v2.6.1-final',
    purpose: 'Review assessment, scoring, derivative-database, and other uses of the exact frozen PRIMAP v2.6.1 CSV beyond the already approved factual-display and magnitude-comparison tiers.',
    expectedRegistry: ['approved', 'confirmed', 'CC-BY-4.0', 'permitted', 'recorded_allowed', 'recorded_allowed'],
    scope: {
      scope_kind: 'frozen_file',
      source_version: 'v2.6.1 final, published 13 March 2025',
      doi: '10.5281/zenodo.15016289',
      artifact_filename: PRIMAP_FILENAME,
      artifact_sha256: PRIMAP_SHA256,
      publisher_checksum_algorithm: 'md5',
      publisher_checksum_value: '09b9c61629f87e16012222e5b303bc36',
      captured_document_ids: [],
      captured_document_checksums_sha256: [],
      acquisition_state: 'exact_sha256_pinned_no_raw_file_committed',
      scope_note: 'The SHA-256 is the exact project pin supplied for the named CSV. The official Zenodo record exposes the matching filename and an MD5, not this SHA-256. The existing source-registry decision and batch attestation already support factual display and magnitude comparison; this packet seeks independent review only for broader assessment/scoring uses.',
    },
    evidence: [
      evidence(
        'primap-zenodo-record-15016289',
        'repository_record',
        'Zenodo / record depositors',
        'The PRIMAP-hist national historical emissions time series (1750-2023) v2.6.1',
        'https://zenodo.org/records/15016289',
        'versioned_record_metadata_modified_2025-09-10',
        [
          'The record identifies version v2.6.1, publication date 13 March 2025 and DOI 10.5281/zenodo.15016289.',
          'The record labels the dataset Creative Commons Attribution 4.0 International.',
          'The file list names the exact main CSV, reports a size of 74.7 MB and publishes MD5 09b9c61629f87e16012222e5b303bc36.',
          'The record asks users to cite the precise dataset version and the data-description article and to consider citing relevant original sources.',
        ],
      ),
      evidence(
        'cc-by-4.0-legal-code',
        'licence_legal_code',
        'Creative Commons',
        'Attribution 4.0 International legal code',
        'https://creativecommons.org/licenses/by/4.0/legalcode.en',
        'canonical_legal_code',
        [
          'The legal code grants reproduction, sharing and adaptation of licensed material subject to its conditions.',
          'Sharing requires retention of supplied attribution and licence information and an indication of modifications.',
          'The licence covers only rights the licensor has authority to grant and does not license patent or trademark rights.',
          'The legal code addresses extraction and reuse where sui generis database rights apply.',
        ],
      ),
    ],
    analysis: reviewAnalysis(
      [
        'The official record publishes an MD5 for the named CSV, while the project pins a SHA-256; the exact-byte correspondence has not been independently attested in this packet.',
        'The dataset combines multiple underlying sources. The record-level CC BY statement does not by itself answer whether any source-specific rights or attribution duties survive for Earth Love United use.',
        'Zenodo flags a newer version; this packet intentionally covers only frozen v2.6.1 and must not be read as covering v2.7 or later releases.',
      ],
      [
        'Retain dataset authors, precise DOI, licence reference and modification notice in any approved use.',
        'Do not imply endorsement by authors, Zenodo or underlying data providers.',
        'Keep scenario, gas, sector, GWP, LULUCF, rounding and extrapolation choices visible in the transformation record.',
      ],
      [
        'What exact public attribution template is sufficient for cards, globe tooltips, downloadable data and machine-readable metadata?',
        'Which underlying sources, if any, must also be credited for the selected rows and series?',
      ],
      [
        'Do selection, normalization, CO2e conversion, aggregation, rounding and visual scoring create adapted material or a derivative database, and how must changes be marked?',
        'May normalized values and derived scores be redistributed commercially under the record-level licence and the relevant underlying-source terms?',
      ],
      [
        'Does an independent checksum verification confirm that the pinned SHA-256 belongs to the exact named v2.6.1 CSV whose Zenodo MD5 is recorded?',
        'Beyond the existing factual-display decision, does CC BY 4.0 and the incorporated-source record cover derivative-database use, assessment and scoring for this exact artifact?',
        'What additional attribution, change notice and re-review cadence must an assessed or scored production release enforce?',
      ],
      [
        'Does the record-level licence grant sufficient authority over the composite dataset for assessment, scoring and derived outputs beyond limited factual display?',
        'Do any incorporated-source notices require additional attribution or restrict downstream assessment, derivative-database use or scoring?',
      ],
    ),
  },
  {
    sourceId: SOURCE_IDS[1],
    packetId: 'ct17-rights-unfccc-ndc-registry',
    purpose: 'Review registry metadata, Party NDC files and normalized target extraction for active-NDC and target-methodology uses only.',
    expectedRegistry: ['pending', 'uncertain', 'UNFCCC-terms-and-party-document-rights', 'metadata_only', 'recorded_blocked', 'recorded_blocked'],
    scope: {
      scope_kind: 'live_registry_family',
      source_version: 'continuous NDC Registry snapshot retrieved 2026-07-15',
      doi: null,
      artifact_filename: null,
      artifact_sha256: null,
      publisher_checksum_algorithm: null,
      publisher_checksum_value: null,
      captured_document_ids: [],
      captured_document_checksums_sha256: [],
      acquisition_state: 'live_family_only_no_party_documents_acquired',
      scope_note: 'This packet covers the registry family and terms evidence only. Each Party submission, translation, annex and superseded version requires its own identity, rights-notice and checksum record.',
    },
    evidence: [
      evidence(
        'unfccc-ndc-registry-2026-07-15',
        'source_landing_page',
        'UNFCCC secretariat',
        'Nationally Determined Contributions Registry',
        'https://unfccc.int/NDCREG',
        'mutable_live_registry_no_local_copy',
        [
          'The page identifies the service as the public NDC registry maintained by the secretariat under Article 4, paragraph 12 of the Paris Agreement.',
          'Registry entries expose Party, title, language, version, status, submission date and links to submitted files or additional documents.',
          'The registry includes both active and archived status values, so current-document selection requires version and status review rather than presence alone.',
        ],
      ),
      UNFCCC_TERMS_EVIDENCE,
    ],
    analysis: reviewAnalysis(
      [
        'The terms do not expressly reconcile the unchanged public-domain statement with the personal non-commercial, no-redistribution and no-derivatives website-use language.',
        'The registry hosts Party-submitted documents, and the reviewed pages do not establish that every Party submission, translation or annex has identical downstream rights.',
        'A live registry page is not an immutable snapshot and does not identify exact bytes for every active and superseded document.',
      ],
      [
        'Preserve Party authorship, document title, version/status, submission date, direct URL and retrieval date.',
        'Do not treat an archived, superseded or legacy INDC as an active NDC.',
        'Do not alter or republish Party files unless an authorized decision expressly covers that use.',
      ],
      [
        'What acknowledgement is required for registry metadata versus each Party-authored document and official translation?',
        'Must citations identify both the Party and UNFCCC, and how must superseded versions be labelled?',
      ],
      [
        'Is extracting target percentages, years, scope fields, conditionality and methodology into normalized records a prohibited derivative or a permissible factual extraction?',
        'May extracted target facts be combined into comparisons, rankings or scores and redistributed as a database?',
      ],
      [
        'Which terms control registry metadata, unchanged Party files and normalized target facts respectively?',
        'Must every Party document and annex receive a document-specific rights review and checksum before extraction?',
        'Are normalized target facts, comparison outputs and scoring authorized for public and commercial reuse?',
      ],
      [
        'How should the conflicting UNFCCC terms clauses be interpreted for Party-submitted NDCs and factual extraction?',
        'Is written UNFCCC or Party clarification required, and who has authority to grant it for submissions, translations and annexes?',
      ],
    ),
  },
  {
    sourceId: SOURCE_IDS[2],
    packetId: 'ct17-rights-unfccc-nir-crt',
    purpose: 'Review Party NID/NIR documents, CRT attachments and normalized official-inventory facts.',
    expectedRegistry: ['pending', 'uncertain', 'UNFCCC-terms-and-party-document-rights', 'metadata_only', 'recorded_blocked', 'recorded_blocked'],
    scope: {
      scope_kind: 'live_document_family',
      source_version: '2026 NIR/CRT submission cycle; reports snapshot retrieved 2026-07-15',
      doi: null,
      artifact_filename: null,
      artifact_sha256: null,
      publisher_checksum_algorithm: null,
      publisher_checksum_value: null,
      captured_document_ids: [],
      captured_document_checksums_sha256: [],
      acquisition_state: 'live_family_only_no_submission_packages_acquired',
      scope_note: 'No Party NID/NIR, CRT, annex or recalculation file is captured by this family packet. Every selected package needs exact document IDs and per-attachment SHA-256 values.',
    },
    evidence: [
      evidence(
        'unfccc-reports-catalogue-2026-07-15',
        'source_catalogue',
        'UNFCCC secretariat',
        'UNFCCC Reports catalogue',
        'https://unfccc.int/reports',
        'mutable_live_catalogue_no_local_copy',
        [
          'The catalogue lists document name, document type, Party or author, submission date and detail links for reporting artifacts.',
          'The catalogue includes National Inventory Documents and Common Reporting Tables as distinct document types and versions.',
          'The catalogue is continuously updated and therefore does not supply an immutable package checksum by itself.',
        ],
      ),
      evidence(
        'unfccc-btr-overview-nir-components-2026-07-15',
        'source_landing_page',
        'UNFCCC secretariat',
        'Biennial Transparency Reports overview',
        'https://unfccc.int/biennial-transparency-reports',
        'mutable_live_page_no_local_copy',
        [
          'The page states that a national inventory report may be submitted separately and describes the NIR as a National Inventory Document plus Common Reporting Tables.',
          'The page identifies CRTs as the electronic tables for inventory information and explains that report components are submitted through the UNFCCC submission portal.',
        ],
      ),
      UNFCCC_TERMS_EVIDENCE,
    ],
    analysis: reviewAnalysis(
      [
        'The UNFCCC terms conflict is unresolved for Party submissions and normalized extraction.',
        'A reports-catalogue entry is not the complete NIR package; annexes, recalculation material and machine-readable CRT attachments may have separate notices and bytes.',
        'The reviewed pages do not provide a family-wide licence identifier for altered or normalized inventory data.',
      ],
      [
        'Preserve Party, submission cycle, document type, inventory year, gas, sector, GWP convention, LULUCF treatment, recalculation status and direct URLs.',
        'Do not republish altered source files or silently combine vintages and accounting frames.',
        'Keep the source package and every attachment checksum tied to each extracted fact.',
      ],
      [
        'What acknowledgement is required for Party-authored NIDs, CRTs, annexes and UNFCCC catalogue metadata?',
        'Must normalized rows retain a citation to every attachment used in the calculation?',
      ],
      [
        'Is parsing CRT cells, unit conversion, gas aggregation, GWP conversion, LULUCF separation and recalculation reconciliation permissible transformation?',
        'May normalized official-inventory facts be redistributed and used in delivery metrics or scores?',
      ],
      [
        'Which exact files constitute a complete, current inventory package for each Party and reporting obligation?',
        'Do the terms authorize source-file archiving, normalized fact extraction, redistribution and scoring?',
        'Which document-specific exceptions or notices must be recorded before use?',
      ],
      [
        'Does the unchanged-document permission permit factual extraction and transformed databases from Party NIR/CRT submissions?',
        'Is written clarification required for commercial redistribution and scoring, and should it come from UNFCCC, each Party or both?',
      ],
    ),
  },
  {
    sourceId: SOURCE_IDS[3],
    packetId: 'ct17-rights-unfccc-btr-ctf',
    purpose: 'Review BTR textual reports, explicit CTF/CRT components and normalized progress, policy, finance or conditionally routed inventory facts.',
    expectedRegistry: ['pending', 'uncertain', 'UNFCCC-terms-and-party-document-rights', 'metadata_only', 'recorded_blocked', 'recorded_blocked'],
    scope: {
      scope_kind: 'live_document_family',
      source_version: 'first BTR cycle; continuous reports snapshot retrieved 2026-07-15',
      doi: null,
      artifact_filename: null,
      artifact_sha256: null,
      publisher_checksum_algorithm: null,
      publisher_checksum_value: null,
      captured_document_ids: [],
      captured_document_checksums_sha256: [],
      acquisition_state: 'live_family_only_no_btr_component_packages_acquired',
      scope_note: 'This family packet grants no BTR-wide inventory role. CT-16 requires explicit component identity and governance for any conditionally routed CRT/CTF component.',
    },
    evidence: [
      evidence(
        'unfccc-btr-overview-components-2026-07-15',
        'source_landing_page',
        'UNFCCC secretariat',
        'Biennial Transparency Reports overview',
        'https://unfccc.int/biennial-transparency-reports',
        'mutable_live_page_no_local_copy',
        [
          'The page describes a BTR submission as a textual report plus CRTs for inventory information and CTFs for NDC progress and support information.',
          'The page distinguishes information on finance, technology transfer and capacity-building that is provided, mobilized, needed or received.',
          'The page states that submitted BTRs undergo technical expert review.',
        ],
      ),
      evidence(
        'unfccc-reports-catalogue-btr-2026-07-15',
        'source_catalogue',
        'UNFCCC secretariat',
        'UNFCCC Reports catalogue',
        'https://unfccc.int/reports',
        'mutable_live_catalogue_no_local_copy',
        [
          'The catalogue lists BTRs, CRTs, NIDs and related attachments as distinct records with Party and submission metadata.',
          'The catalogue is a discovery interface and does not itself establish exact package completeness or immutable bytes.',
        ],
      ),
      UNFCCC_TERMS_EVIDENCE,
    ],
    analysis: reviewAnalysis(
      [
        'The UNFCCC terms conflict is unresolved for Party BTRs, CTFs, CRTs and normalized extraction.',
        'BTR is a multi-component family; rights and routing cannot be inferred once for the whole family.',
        'The current source registry does not declare the official_inventory domain for BTR; a rights packet cannot cure that routing and governance mismatch.',
      ],
      [
        'Identify every textual report, CRT, CTF, annex and revision separately with checksum and document role.',
        'Do not merge provided, mobilized, needed and received support or finance categories.',
        'Do not use a BTR family label to bypass CT-16 explicit-component governance.',
      ],
      [
        'What attribution is required for Party-authored text, tables, annexes and UNFCCC catalogue records?',
        'How must revisions, translations and component-level citations appear in normalized facts?',
      ],
      [
        'Are table parsing, terminology normalization, currency conversion, category mapping and derived progress indicators permissible?',
        'May normalized policy, progress and finance facts be redistributed and used for country evaluation or scoring?',
      ],
      [
        'Which BTR component and exact checksum supports each proposed fact?',
        'Do terms authorize source-file archiving, normalized extraction, redistribution, transformation and scoring for that component?',
        'Does any proposed inventory use also have the required CT-16 domain and explicit-component governance decision?',
      ],
      [
        'Does unchanged-document permission extend to normalized facts from Party BTR/CTF/CRT components?',
        'Who can authorize commercial derivative-database and scoring uses when UNFCCC hosts Party-authored submissions?',
      ],
    ),
  },
  {
    sourceId: SOURCE_IDS[4],
    packetId: 'ct17-rights-unfccc-ter-findings',
    purpose: 'Review unchanged Technical Expert Review reports and separately review normalized TER findings for corroboration only.',
    expectedRegistry: ['pending', 'confirmed', 'UNFCCC-official-document-public-domain', 'metadata_only', 'recorded_allowed', 'recorded_blocked'],
    scope: {
      scope_kind: 'live_document_family',
      source_version: 'continuous TER publication set retrieved 2026-07-15',
      doi: null,
      artifact_filename: null,
      artifact_sha256: null,
      publisher_checksum_algorithm: null,
      publisher_checksum_value: null,
      captured_document_ids: [],
      captured_document_checksums_sha256: [],
      acquisition_state: 'live_family_only_no_ter_documents_acquired',
      scope_note: 'This packet distinguishes unchanged official TER documents from normalized findings. It never makes TER a primary inventory value source and captures no report bytes.',
    },
    evidence: [
      evidence(
        'unfccc-reporting-review-etf-2026-07-15',
        'source_landing_page',
        'UNFCCC secretariat',
        'Reporting and Review',
        'https://unfccc.int/reporting-and-review',
        'mutable_live_page_no_local_copy',
        [
          'The page states that the secretariat is requested to publish Party BTRs, stand-alone NIRs, technical expert review reports and FMCP records on the UNFCCC website.',
          'The page describes technical expert review as part of the Enhanced Transparency Framework.',
        ],
      ),
      evidence(
        'unfccc-first-btr-ter-table-2026-07-15',
        'source_catalogue',
        'UNFCCC secretariat',
        'First Biennial Transparency Reports',
        'https://unfccc.int/first-biennial-transparency-reports',
        'mutable_live_table_last_update_2026-06-19',
        [
          'The page provides a Party table linking BTR/NIR submissions, annexes, technical expert review report symbols and FMCP outputs as they become available.',
          'The page identifies the NIR as a National Inventory Document plus Common Reporting Tables and separates TERR records from Party submissions.',
        ],
      ),
      UNFCCC_TERMS_EVIDENCE,
    ],
    analysis: reviewAnalysis(
      [
        'The public-domain statement is limited to unchanged official documents, while normalized findings alter context and structure and are also exposed to the broader website-use restrictions.',
        'A TER publication table does not pin the exact report, addendum, language version or checksum used for a finding.',
        'Even if reuse is authorized, CT-16 makes TER corroboration-only and never a primary inventory value source.',
      ],
      [
        'Keep report symbol, Party, report/addendum identity, publication date, direct URL, locator and exact checksum with every normalized finding.',
        'Do not paraphrase a review finding as a Party-reported value or use TER to replace the primary submission.',
        'Preserve qualifiers, issue status, recommendation language and later addenda or corrections.',
      ],
      [
        'What acknowledgement is required for unchanged official TER reports and for normalized finding records?',
        'How should report symbols, team authorship and UNFCCC publication be represented?',
      ],
      [
        'Is extracting and normalizing findings, recommendations, inconsistencies and resolved issues a permissible factual transformation?',
        'May normalized findings be indexed, compared across Parties or used as corroborating inputs to country evaluation and scoring?',
      ],
      [
        'Does the unchanged official-document basis authorize archiving exact TER files with attribution?',
        'What separate authority covers normalized findings, derivative databases and any scoring use?',
        'How will the release enforce the corroboration-only boundary independently of rights approval?',
      ],
      [
        'Does the official-document public-domain statement permit normalized extraction despite the unchanged-content condition and broader website-use clause?',
        'Is written UNFCCC clarification required for commercial normalized findings and scoring?',
      ],
    ),
  },
]);

function registryState(source) {
  return {
    snapshot_kind: 'pre_existing_registry_state_not_a_ct17_decision',
    record_hash_sha256: hashJson(source),
    approval_state: source.approval.state,
    licence_status: source.licence.status,
    licence_identifier: source.licence.identifier,
    redistribution_status: source.redistribution.status,
    source_files_state: source.redistribution.source_files ? 'recorded_allowed' : 'recorded_blocked',
    normalized_values_state: source.redistribution.normalized_values ? 'recorded_allowed' : 'recorded_blocked',
  };
}

function assertCt15DecisionContract(ct15Readiness) {
  assert(ct15Readiness.work_package_id === 'ct15-production-evidence-readiness-2026-07-15' && ct15Readiness.status === 'blocked', 'CT-15 readiness boundary drift');
  const tracks = new Map(ct15Readiness.readiness_tracks.map(item => [item.track_id, item]));
  assert(tracks.get('factual_display_and_magnitude_comparison')?.status === 'eligible', 'CT-15 factual publication state drift');
  assert(tracks.get('assessed_runtime_and_scoring')?.status === 'blocked', 'CT-15 assessed-runtime boundary drift');
  const work = new Map(ct15Readiness.source_decision_work.map(item => [item.source_registry_id, item]));
  for (const sourceId of SOURCE_IDS) {
    const decisionWork = work.get(sourceId);
    assert(decisionWork, 'CT-15 decision work missing for ' + sourceId);
    assert(JSON.stringify(decisionWork.required_decision_record_fields) === JSON.stringify(CT15_REQUIRED_DECISION_FIELDS), 'CT-15 required decision field contract drift for ' + sourceId);
    for (const field of decisionWork.required_decision_record_fields) {
      assert(DECISION_FIELDS.includes(field), 'CT-17 decision contract omits CT-15 field ' + field + ' for ' + sourceId);
    }
  }
}

function assertInputs(sourceRegistry, ct40Result, ct15Readiness, inputPins) {
  assert(hashJson(sourceRegistry) === EXPECTED_SOURCE_REGISTRY_JSON_HASH, 'source registry content drift');
  for (const [key, expected] of Object.entries(EXPECTED_INPUT_SHA256)) {
    assert(inputPins[key]?.sha256 === expected, key + ' immutable input checksum drift');
  }
  assert(ct40Result.decision === 'deny' && ct40Result.eligible === false && ct40Result.release_authority === false, 'CT-40 DENY boundary required');
  assert(ct40Result.decision_scope === 'assessed_climate_release', 'CT-40 decision scope drift');
  assert(ct40Result.counts?.facts_evaluated === 2060 && ct40Result.counts?.facts_eligible === 0, 'CT-40 fact-count boundary drift');
  assert(ct40Result.publication_tiers?.factual_display?.status === 'eligible' && ct40Result.publication_tiers.factual_display.eligible_count === 2060, 'CT-40 factual-display tier drift');
  assert(ct40Result.publication_tiers?.magnitude_comparison?.status === 'eligible' && ct40Result.publication_tiers.magnitude_comparison.eligible_count === 2060, 'CT-40 magnitude-comparison tier drift');
  for (const tier of ['commitment_display', 'derived_metrics', 'performance_assessment', 'score']) {
    assert(ct40Result.publication_tiers?.[tier]?.status === 'not_present', `CT-40 ${tier} tier drift`);
  }
  assertCt15DecisionContract(ct15Readiness);
  const sourceMap = new Map(sourceRegistry.sources.map(source => [source.id, source]));
  for (const config of CONFIGS) {
    const source = sourceMap.get(config.sourceId);
    assert(source, 'missing source registry entry ' + config.sourceId);
    const actual = registryState(source);
    const expected = config.expectedRegistry;
    assert(actual.approval_state === expected[0], config.sourceId + ' registry approval drift');
    assert(actual.licence_status === expected[1], config.sourceId + ' registry licence status drift');
    assert(actual.licence_identifier === expected[2], config.sourceId + ' registry licence identifier drift');
    assert(actual.redistribution_status === expected[3], config.sourceId + ' registry redistribution drift');
    assert(actual.source_files_state === expected[4], config.sourceId + ' registry source-file state drift');
    assert(actual.normalized_values_state === expected[5], config.sourceId + ' registry normalized-value state drift');
  }
  return sourceMap;
}

function compile(input) {
  const sourceMap = assertInputs(input.sourceRegistry, input.ct40Result, input.ct15Readiness, input.inputPins);
  const output = {
    schema_version: '1.1.0',
    package_id: PACKAGE_ID,
    created_at: CREATED_AT,
    retrieved_on: RETRIEVED_ON,
    status: 'requires_authorized_review',
    purpose: 'Decision-ready official evidence packets for independent review of assessment/scoring and unresolved source uses. This package records evidence and questions only; it neither grants new approval nor revokes the existing PRIMAP factual-display and magnitude-comparison approval.',
    immutable_inputs: input.inputPins,
    governance_boundary: {
      source_registry_modified: false,
      rights_decisions_made: false,
      ct40_decision_modified: false,
      preexisting_factual_tier_state: 'eligible_unchanged',
      preexisting_factual_facts: 2060,
      new_normalized_fact_uses_authorized: false,
      scoring_authorized: false,
      release_authority: false,
      production_runtime_release: false,
    },
    evidence_method: {
      official_fact_label: 'official_primary_page',
      project_analysis_label: 'project_inference_for_authorized_review',
      live_page_capture_state: 'urls_and_retrieval_dates_recorded_no_raw_page_copies',
      raw_or_large_downloads_committed: false,
      rule: 'Official page metadata and factual summaries are evidence; rights interpretation, applicability and authorization remain questions for an authorized independent reviewer.',
    },
    required_decision_fields: DECISION_FIELDS,
    prohibited_inferences: [
      'permission from public availability',
      'permission from a download link or registry listing',
      'normalized-extraction permission from unchanged-document language',
      'scoring permission from factual-use permission',
      'family-wide permission from one document or component',
      'release authority from a source-registry state or this packet',
    ],
    packets: CONFIGS.map(config => ({
      packet_id: config.packetId,
      source_registry_id: config.sourceId,
      source_title: sourceMap.get(config.sourceId).title,
      status: 'requires_authorized_review',
      purpose: config.purpose,
      source_registry_snapshot: registryState(sourceMap.get(config.sourceId)),
      exact_scope: config.scope,
      official_evidence: config.evidence,
      review_analysis: config.analysis,
      blank_decision_record: blankDecision(config.sourceId),
    })),
    calculation_hash: null,
  };
  output.calculation_hash = hashJson(output);
  validate(output, input);
  return output;
}

function validateDecision(decision, packetId, sourceRegistryId) {
  assert(JSON.stringify(Object.keys(decision)) === JSON.stringify(DECISION_FIELDS), packetId + ' decision field coverage or order drift');
  assert(decision.decision_id === null && decision.reviewer_id === null, packetId + ' invented decision or reviewer ID');
  for (const [key, value] of Object.entries(decision)) {
    if (key === 'source_registry_id') {
      assert(value === sourceRegistryId, packetId + ' decision source-registry identity drift');
      continue;
    }
    if (typeof value === 'boolean') assert(value === false, packetId + ' decision boolean enabled: ' + key);
    else if (Array.isArray(value)) assert(value.length === 0, packetId + ' decision array populated: ' + key);
    else assert(value === null, packetId + ' decision value populated: ' + key);
  }
}

function validate(output, input) {
  assert(output.package_id === PACKAGE_ID && output.status === 'requires_authorized_review', 'rights packet status drift');
  const boundary = output.governance_boundary;
  assert(boundary?.preexisting_factual_tier_state === 'eligible_unchanged' && boundary.preexisting_factual_facts === 2060, 'pre-existing factual publication state was hidden or changed');
  for (const field of ['source_registry_modified', 'rights_decisions_made', 'ct40_decision_modified', 'new_normalized_fact_uses_authorized', 'scoring_authorized', 'release_authority', 'production_runtime_release']) {
    assert(boundary[field] === false, `rights packet leaked authority through ${field}`);
  }
  assert(output.evidence_method.raw_or_large_downloads_committed === false, 'raw or large download claimed committed');
  assert(JSON.stringify(output.immutable_inputs) === JSON.stringify(input.inputPins), 'immutable input pins drift');
  assert(JSON.stringify(output.required_decision_fields) === JSON.stringify(DECISION_FIELDS), 'required decision fields drift');
  assert(output.prohibited_inferences.includes('permission from public availability'), 'public-availability inference prohibition missing');
  assert(output.packets.length === SOURCE_IDS.length, 'source packet coverage drift');
  assert(JSON.stringify(output.packets.map(packet => packet.source_registry_id)) === JSON.stringify(SOURCE_IDS), 'source packet order or identity drift');

  const sourceMap = assertInputs(input.sourceRegistry, input.ct40Result, input.ct15Readiness, input.inputPins);
  for (let index = 0; index < output.packets.length; index += 1) {
    const packet = output.packets[index];
    const config = CONFIGS[index];
    assert(packet.packet_id === config.packetId && packet.status === 'requires_authorized_review', packet.source_registry_id + ' packet status drift');
    assert(packet.source_registry_snapshot.snapshot_kind === 'pre_existing_registry_state_not_a_ct17_decision', packet.packet_id + ' registry boundary missing');
    assert(JSON.stringify(packet.source_registry_snapshot) === JSON.stringify(registryState(sourceMap.get(packet.source_registry_id))), packet.packet_id + ' registry snapshot drift');
    assert(packet.official_evidence.length >= 2, packet.packet_id + ' official evidence incomplete');
    for (const item of packet.official_evidence) {
      assert(item.evidence_origin === 'official_primary_page' && item.retrieved_on === RETRIEVED_ON, packet.packet_id + ' evidence origin or retrieval date drift');
      assert(item.url.startsWith('https://unfccc.int/') || item.url.startsWith('https://zenodo.org/') || item.url.startsWith('https://creativecommons.org/'), packet.packet_id + ' non-authoritative evidence URL');
      assert(item.official_factual_summary.length >= 2, packet.packet_id + ' official factual summary incomplete');
    }
    const analysis = packet.review_analysis;
    assert(analysis.analysis_origin === 'project_inference_for_authorized_review', packet.packet_id + ' analysis origin drift');
    for (const key of ['ambiguities', 'restrictions_and_conditions_to_evaluate', 'attribution_questions', 'transformation_questions', 'questions_for_authorized_reviewer', 'questions_requiring_counsel_or_human_rights_review']) {
      assert(Array.isArray(analysis[key]) && analysis[key].length >= 2, packet.packet_id + ' review analysis incomplete: ' + key);
    }
    validateDecision(packet.blank_decision_record, packet.packet_id, packet.source_registry_id);
  }

  const primap = output.packets[0].exact_scope;
  assert(primap.scope_kind === 'frozen_file' && primap.artifact_filename === PRIMAP_FILENAME, 'PRIMAP artifact identity drift');
  assert(primap.artifact_sha256 === PRIMAP_SHA256, 'PRIMAP exact checksum drift');
  assert(primap.publisher_checksum_algorithm === 'md5' && primap.publisher_checksum_value === '09b9c61629f87e16012222e5b303bc36', 'PRIMAP publisher checksum evidence drift');
  for (const packet of output.packets.slice(1)) {
    assert(packet.exact_scope.artifact_sha256 === null, packet.packet_id + ' invented family checksum');
    assert(packet.exact_scope.captured_document_ids.length === 0 && packet.exact_scope.captured_document_checksums_sha256.length === 0, packet.packet_id + ' invented document scope');
  }
  for (const packet of output.packets.slice(1)) {
    assert(packet.official_evidence.some(item => item.url === 'https://unfccc.int/this-site/terms-of-use'), packet.packet_id + ' UNFCCC terms evidence missing');
    assert(packet.review_analysis.ambiguities.some(item => item.toLowerCase().includes('terms') || item.toLowerCase().includes('public-domain')), packet.packet_id + ' UNFCCC terms ambiguity hidden');
  }
  const forHash = structuredClone(output);
  forHash.calculation_hash = null;
  assert(hashJson(forHash) === output.calculation_hash, 'rights packet calculation hash drift');
  return true;
}

module.exports = {
  PACKAGE_ID,
  CREATED_AT,
  RETRIEVED_ON,
  SOURCE_IDS,
  DECISION_FIELDS,
  EXPECTED_INPUT_SHA256,
  PRIMAP_SHA256,
  PRIMAP_FILENAME,
  compile,
  validate,
  hashJson,
  stable,
};
