/**
 * MEDIATOR / INTEGRATION HUB
 * ---------------------------------------------------------------------------
 * The heart of the project. One user request becomes a mediated integration:
 *
 *   1. canonicalise the requested identifier
 *   2. load the source registry and decide which sources can answer
 *   3. decompose the request into per-source predicates
 *   4. fan out to the independent source APIs (see adapters.ts)
 *   5. normalise every returned record through its accepted schema mapping
 *   6. match records on the canonical identity
 *   7. merge into one unified medicine view, keeping per-field provenance
 *   8. emit a trace that reflects what actually happened
 *
 * No step reads an integrated master table: the unified view is constructed here
 * at query time from the source responses.
 */

import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import {
  CANONICAL_FIELDS,
  NO_COMPLAINT_LABEL,
  formatDisplayValue,
  normaliseKey,
  normaliseValue,
} from "./canonical";
import { callSourceApi, type TransportAttempt } from "./adapters";

export const DISCLAIMER =
  "Synthetic academic dataset (IIIT Delhi, CSE656 Information Integration & Applications). No real medicine, pharmacy or government record is involved and no medical claim is made.";

export type RunStatus = "verified" | "suspicious" | "partial" | "not_found";

const STATUS_COPY: Record<RunStatus, { label: string; description: string }> = {
  verified: {
    label: "Verified across available demo sources",
    description:
      "Every queried demo source returned a matching record for this product and no open complaint was found.",
  },
  suspicious: {
    label: "Potentially suspicious based on demo source records",
    description:
      "The demo source records contain an open counterfeit / quality complaint for this product, so the integrated view is flagged for manual review.",
  },
  partial: {
    label: "Partially covered by the connected demo sources",
    description:
      "Some demo sources hold a record for this product and others return nothing. The gaps are reported instead of being filled in.",
  },
  not_found: {
    label: "No record in the connected demo sources",
    description:
      "None of the queried source APIs returned a record for this identifier. Check the identifier or try one of the demo cases.",
  },
};

interface RegistryMapping {
  source_field: string;
  canonical_field: string;
  score: number;
  accepted: boolean;
  origin: string;
}

interface RegistrySource {
  source_id: string;
  display_name: string;
  owner: string;
  kind: string;
  description: string;
  storage: string;
  api_base: string;
  active: boolean;
  priority: number;
  fields: Array<{ name: string; datatype: string; samples: string[]; nullable: boolean }>;
  mappings: RegistryMapping[];
}

interface NormalisedField {
  canonical_field: string;
  label: string;
  source_field: string;
  raw_value: string;
  normalized_value: string;
  display_value: string;
  /** set when the source resolved a source-local identifier form for us */
  resolved_from: string | null;
}

interface NormalisedRecord {
  identity: string | null;
  matched: boolean;
  resolved_by_source: boolean;
  fields: NormalisedField[];
}

const DATE_FIELDS = new Set([
  "manufacture_date",
  "expiry_date",
  "procurement_date",
  "complaint_date",
]);

/**
 * Only report normalisation steps that actually change how a value compares.
 * Case folding of names is expected and would otherwise drown the trace.
 */
function normalisationNote(field: string, raw: string, normalized: string): string | null {
  const trimmed = raw.trim();
  if (field === "medicine_id" || field === "batch_number") {
    const compacted = trimmed.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (compacted === normalized) return null;
    return `"${trimmed}" → ${normalized} (re-formatted to the canonical identifier form)`;
  }
  if (DATE_FIELDS.has(field)) {
    if (trimmed === normalized) return null;
    return `"${trimmed}" → ${normalized} (converted to canonical ISO date)`;
  }
  if (field === "price") {
    if (/[^0-9.]/.test(trimmed)) {
      return `"${trimmed}" → ${normalized} (currency / formatting stripped)`;
    }
    return null;
  }
  return null;
}

export interface SourceView {
  source_id: string;
  display_name: string;
  owner: string;
  kind: string;
  description: string;
  endpoint: string;
  url: string | null;
  predicate: { field: string; operator: string; value: string; normalized: string };
  strategy: string | null;
  transport: string;
  transport_origin: string;
  status: number;
  ok: boolean;
  latency_ms: number;
  bytes: number;
  query_attempts: TransportAttempt[];
  record_count: number;
  matched_count: number;
  records: Array<Record<string, unknown>>;
  normalized_records: NormalisedRecord[];
  normalization_notes: string[];
  mappings_applied: string[];
  error: string | null;
}

export interface IntegratedField {
  canonical_field: string;
  label: string;
  datatype: string;
  value: string;
  raw: string;
  normalized: string;
  agreement: "consistent" | "single_source" | "conflict" | "derived_absent" | "absent";
  contributors: Array<{
    source_id: string;
    source_display_name: string;
    source_field: string;
    raw_value: string;
    display_value: string;
    resolved_from: string | null;
    priority: number;
  }>;
  alternatives: Array<{ source_id: string; source_display_name: string; value: string }>;
}

export interface TraceStep {
  seq: number;
  phase: "request" | "registry" | "plan" | "fanout" | "normalize" | "match" | "merge" | "respond";
  title: string;
  detail: string;
  status: "ok" | "info" | "warn" | "error";
  at_ms: number;
  data: Record<string, unknown> | null;
}

export interface IntegrationResult {
  request: {
    input: string;
    canonical_key: string;
    requested_at: number;
    run_id: string | null;
    triggered_by: string;
  };
  status: {
    code: RunStatus;
    label: string;
    description: string;
    disclaimer: string;
    open_complaints: number;
  };
  plan: {
    canonical_key: string;
    identity_field_per_source: Array<{ source_id: string; display_name: string; field: string }>;
    queries: Array<{
      source_id: string;
      display_name: string;
      endpoint: string;
      predicate: { field: string; operator: string; value: string; normalized: string };
    }>;
    skipped: Array<{ source_id: string; display_name: string; reason: string; detail: string }>;
    considered: Array<{
      source_id: string;
      display_name: string;
      active: boolean;
      has_identity_mapping: boolean;
      decision: "query" | "skip";
    }>;
  };
  sources: SourceView[];
  fields: IntegratedField[];
  trace: {
    steps: TraceStep[];
    total_latency_ms: number;
    counters: {
      sources_registered: number;
      sources_queried: number;
      sources_answered: number;
      sources_responded: number;
      records_returned: number;
      records_matched: number;
      mappings_applied: number;
      fields_resolved: number;
      conflicts: number;
      http_calls: number;
      in_process_calls: number;
    };
  };
  statistics: {
    sources_answered: number;
    sources_responded: number;
    sources_queried: number;
    fields_resolved: number;
    fields_total: number;
    conflicts: number;
    open_complaints: number;
  };
}

function identityMapping(source: RegistrySource): RegistryMapping | null {
  return (
    source.mappings.find((m) => m.accepted && m.canonical_field === "medicine_id") ?? null
  );
}

function statusOf(records: number, responded: number, openComplaints: number): RunStatus {
  if (records === 0) return "not_found";
  if (openComplaints > 0) return "suspicious";
  if (responded >= 3) return "verified";
  return "partial";
}

function isOpenComplaint(status: string): boolean {
  const value = status.toLowerCase();
  return value.includes("investigat") || value === "open" || value.includes("pending");
}

/**
 * Run one mediated request end-to-end and persist the run record.
 */
export async function integrateMedicine(
  ctx: ActionCtx,
  options: { medicine_id: string; triggered_by?: string; site_base?: string | null },
): Promise<IntegrationResult> {
  const input = options.medicine_id.trim();
  if (!input) {
    throw new Error("Enter a medicine / product id (for example MED-10482).");
  }
  const canonicalKey = normaliseKey(input);
  const startedAt = Date.now();
  const at = () => Date.now() - startedAt;
  const triggeredBy = options.triggered_by ?? "verify-screen";
  const steps: TraceStep[] = [];
  let seq = 1;

  const step = (
    phase: TraceStep["phase"],
    title: string,
    detail: string,
    status: TraceStep["status"] = "info",
    data: Record<string, unknown> | null = null,
  ) => {
    steps.push({ seq: seq++, phase, title, detail, status, at_ms: at(), data });
  };

  step(
    "request",
    "Request received",
    `Mediation request for "${input}" — canonical identity key ${canonicalKey}`,
    "ok",
    { input, canonical_key: canonicalKey },
  );

  /* ------------------------- 1. source selection -------------------------- */
  const registry = (await ctx.runQuery(
    internal.registry.internalListSources,
    {},
  )) as unknown as RegistrySource[];

  const considered: IntegrationResult["plan"]["considered"] = [];
  const queries: IntegrationResult["plan"]["queries"] = [];
  const skipped: IntegrationResult["plan"]["skipped"] = [];
  const identityFields: Array<{ source_id: string; display_name: string; field: string }> = [];
  const queryable: RegistrySource[] = [];

  for (const source of registry) {
    const mapping = identityMapping(source);
    const hasIdentity = Boolean(mapping);
    considered.push({
      source_id: source.source_id,
      display_name: source.display_name,
      active: source.active,
      has_identity_mapping: hasIdentity,
      decision: source.active && hasIdentity ? "query" : "skip",
    });
    if (!source.active) {
      const unresolved = source.mappings
        .filter((m) => !m.accepted)
        .map((m) => m.source_field)
        .join(", ");
      skipped.push({
        source_id: source.source_id,
        display_name: source.display_name,
        reason: "not onboarded — the mediator only queries sources with an accepted mapping",
        detail: unresolved
          ? `identity column not accepted yet (unmapped columns: ${unresolved})`
          : "no mapping accepted for this source",
      });
      continue;
    }
    if (!mapping) {
      skipped.push({
        source_id: source.source_id,
        display_name: source.display_name,
        reason: "no accepted mapping to Medicine ID — the source cannot be joined",
        detail: "accept a mapping on the /onboarding screen to include this source",
      });
      continue;
    }
    identityFields.push({
      source_id: source.source_id,
      display_name: source.display_name,
      field: mapping.source_field,
    });
    queryable.push(source);
    queries.push({
      source_id: source.source_id,
      display_name: source.display_name,
      endpoint: `${source.api_base}/item/{medicine_id}`,
      predicate: {
        field: mapping.source_field,
        operator: "eq",
        value: input,
        normalized: canonicalKey,
      },
    });
  }

  step(
    "registry",
    "Source registry loaded",
    `${registry.length} source systems registered · ${registry.filter((s) => s.active).length} onboarded · ${queryable.length} usable for this request`,
    "ok",
    {
      registered: registry.map((s) => ({
        source_id: s.source_id,
        active: s.active,
        accepted_mappings: s.mappings.filter((m) => m.accepted).length,
      })),
    },
  );

  step(
    "plan",
    "Query decomposed into source-level lookups",
    queryable.length > 0
      ? queries
          .map((q) => `${q.display_name}: ${q.predicate.field} = '${q.predicate.value}'`)
          .join(" · ")
      : "no source is currently able to answer an identity lookup",
    queryable.length > 0 ? "ok" : "warn",
    {
      queries: queries.map((q) => ({
        source_id: q.source_id,
        field: q.predicate.field,
        value: q.predicate.value,
        endpoint: q.endpoint,
      })),
    },
  );

  for (const skip of skipped) {
    step("plan", `Skipped: ${skip.display_name}`, `${skip.reason} (${skip.detail})`, "warn", {
      source_id: skip.source_id,
    });
  }

  /* --------------------------- 2. fan out ------------------------------- */
  const responses = await Promise.all(
    queryable.map(async (source) => {
      const mapping = identityMapping(source) as RegistryMapping;
      const log = await callSourceApi(ctx, {
        source_id: source.source_id,
        display_name: source.display_name,
        segments: [source.source_id, "item", input],
        search: new URLSearchParams(),
        site_base: options.site_base ?? null,
      });
      return { source, mapping, log };
    }),
  );

  /* ------------------- 3. normalise + match + provenance ----------------- */
  const sourceViews: SourceView[] = [];
  const fieldCandidates = new Map<string, Array<NormalisedField & { source: RegistrySource }>>();
  const matchedRecords = new Map<string, Array<{ source: RegistrySource; record: NormalisedRecord }>>();
  let recordsReturned = 0;
  let recordsMatched = 0;
  let mappingsAppliedCount = 0;
  const identityMismatches: string[] = [];
  const sourceResolutionNotes: string[] = [];

  for (const { source, mapping, log } of responses) {
    const payload = (log.payload ?? {}) as {
      records?: Array<Record<string, unknown>>;
      record_count?: number;
      query?: { strategy?: string };
      error?: string;
      message?: string;
    };
    const records = Array.isArray(payload.records) ? payload.records : [];
    const strategy = payload.query?.strategy ?? null;
    const acceptedMappings = source.mappings.filter((m) => m.accepted && m.canonical_field);
    const normalizationNotes: string[] = [];
    const normalizedRecords: NormalisedRecord[] = [];

    for (const record of records) {
      recordsReturned += 1;
      const normalised: NormalisedField[] = [];
      for (const candidate of acceptedMappings) {
        const raw = record[candidate.source_field];
        if (raw === undefined || raw === null || String(raw).trim() === "") continue;
        const normalized = normaliseValue(candidate.canonical_field, raw);
        if (!normalized) continue;
        mappingsAppliedCount += 1;
        const display = formatDisplayValue(candidate.canonical_field, raw);
        normalised.push({
          canonical_field: candidate.canonical_field,
          label: CANONICAL_FIELDS.find((f) => f.id === candidate.canonical_field)?.label ?? candidate.canonical_field,
          source_field: candidate.source_field,
          raw_value: String(raw),
          normalized_value: normalized,
          display_value: display,
          resolved_from: null,
        });
        const note = normalisationNote(candidate.canonical_field, String(raw), normalized);
        if (note) normalizationNotes.push(`${source.source_id}.${candidate.source_field} ${note}`);
      }

      const identity = normalised.find((f) => f.canonical_field === "medicine_id")?.normalized_value ?? null;

      const lookup = record.__lookup as
        | { field?: string; raw?: string; normalised?: string; strategy?: string }
        | undefined;
      // The source may resolve identifiers through its own convention (e.g. a
      // retail barcode that carries an outlet suffix). That resolution is
      // trusted *and* recorded, because the API answered the identity question.
      const resolvedBySource =
        lookup?.strategy === "prefix_scan" &&
        Boolean(identity) &&
        (identity as string).startsWith(canonicalKey);

      if (resolvedBySource) {
        const identityField = normalised.find((f) => f.canonical_field === "medicine_id");
        if (identityField) {
          identityField.resolved_from = identityField.raw_value;
          identityField.raw_value = canonicalKey;
          identityField.normalized_value = canonicalKey;
          identityField.display_value = canonicalKey;
        }
        normalizationNotes.push(
          `${source.source_id}.${lookup?.field} "${String(lookup?.raw ?? "")}" → ${identity} (resolved by the source's own identifier convention; canonical key ${canonicalKey})`,
        );
        sourceResolutionNotes.push(
          `${source.display_name} resolved its own identifier "${String(lookup?.raw ?? "")}" to canonical key ${canonicalKey}`,
        );
      }

      const matched = identity === canonicalKey || resolvedBySource;
      if (matched) {
        recordsMatched += 1;
        const key = canonicalKey;
        const bucket = matchedRecords.get(key) ?? [];
        bucket.push({
          source,
          record: { identity, matched, resolved_by_source: resolvedBySource, fields: normalised },
        });
        matchedRecords.set(key, bucket);
        for (const field of normalised) {
          const list = fieldCandidates.get(field.canonical_field) ?? [];
          list.push({ ...field, source });
          fieldCandidates.set(field.canonical_field, list);
        }
      } else if (identity) {
        identityMismatches.push(
          `${source.display_name} returned a record whose canonical identity is ${identity}, not ${canonicalKey}`,
        );
      }

      normalizedRecords.push({ identity, matched, resolved_by_source: resolvedBySource, fields: normalised });
    }

    sourceViews.push({
      source_id: source.source_id,
      display_name: source.display_name,
      owner: source.owner,
      kind: source.kind,
      description: source.description,
      endpoint: log.path,
      url: log.url,
      predicate: {
        field: mapping.source_field,
        operator: "eq",
        value: input,
        normalized: canonicalKey,
      },
      strategy,
      transport: log.transport,
      transport_origin: log.base_origin,
      status: log.status,
      ok: log.ok,
      latency_ms: log.latency_ms,
      bytes: log.bytes,
      query_attempts: log.attempts,
      record_count: payload.record_count ?? records.length,
      matched_count: normalizedRecords.filter((row) => row.matched).length,
      records,
      normalized_records: normalizedRecords,
      normalization_notes: normalizationNotes,
      mappings_applied: acceptedMappings.map((m) => `${m.source_field} → ${m.canonical_field} (${m.score.toFixed(2)})`),
      error: log.error ?? (payload.error ? String(payload.error) : null),
    });

    step(
      "fanout",
      `GET ${log.path}`,
      log.ok
        ? `${log.status} in ${log.latency_ms}ms via ${log.transport} · ${records.length} record(s) · strategy ${strategy ?? "n/a"}`
        : `${log.status} — ${log.error ?? payload.message ?? "source error"}`,
      log.ok ? "ok" : "error",
      {
        source_id: source.source_id,
        url: log.url,
        transport: log.transport,
        attempts: log.attempts,
        predicate: `${mapping.source_field} eq '${input}'`,
      },
    );
  }

  const responded = sourceViews.filter((view) => view.matched_count > 0).length;
  const answered = sourceViews.filter((view) => view.ok).length;

  step(
    "normalize",
    "Source responses normalised through accepted mappings",
    `${mappingsAppliedCount} field values normalised across ${sourceViews.length} responses · ${recordsReturned} raw records processed`,
    "ok",
    {
      per_source: sourceViews.map((view) => ({
        source_id: view.source_id,
        mappings_applied: view.mappings_applied.length,
        notes: view.normalization_notes,
      })),
    },
  );

  step(
    "match",
    "Records matched on the canonical identity",
    `${recordsMatched} of ${recordsReturned} returned records matched key ${canonicalKey} across ${responded} source(s)`,
    recordsMatched > 0 ? "ok" : "warn",
    { requested_key: canonicalKey, identities: Array.from(matchedRecords.keys()) },
  );

  for (const note of sourceResolutionNotes) {
    step("match", "Source resolved its own identifier format", note, "info", null);
  }

  for (const mismatch of identityMismatches) {
    step("match", "Identity mismatch excluded from the merge", mismatch, "warn", null);
  }

  /* ---------------------------- 4. merge -------------------------------- */
  const consumerQueried = sourceViews.find((view) => view.source_id === "consumer_affairs");
  const fields: IntegratedField[] = [];
  let conflicts = 0;

  for (const definition of CANONICAL_FIELDS) {
    const candidates = (fieldCandidates.get(definition.id) ?? [])
      .slice()
      .sort((a, b) => a.source.priority - b.source.priority);

    if (candidates.length === 0) {
      const derivedAbsent =
        definition.id === "complaint_status" && consumerQueried && consumerQueried.ok;
      fields.push({
        canonical_field: definition.id,
        label: definition.label,
        datatype: definition.datatype,
        value: derivedAbsent ? NO_COMPLAINT_LABEL : "",
        raw: "",
        normalized: "",
        agreement: derivedAbsent ? "derived_absent" : "absent",
        contributors: derivedAbsent
          ? [
              {
                source_id: "consumer_affairs",
                source_display_name: "Consumer Affairs Complaints",
                source_field: "(no complaint row for this product)",
                raw_value: "",
                display_value: NO_COMPLAINT_LABEL,
                resolved_from: null,
                priority: 4,
              },
            ]
          : [],
        alternatives: [],
      });
      continue;
    }

    const distinct = new Map<string, NormalisedField & { source: RegistrySource }>();
    for (const candidate of candidates) {
      if (!distinct.has(candidate.normalized_value)) distinct.set(candidate.normalized_value, candidate);
    }
    const winner = candidates[0];
    const isConflict = distinct.size > 1;
    if (isConflict) conflicts += 1;

    fields.push({
      canonical_field: definition.id,
      label: definition.label,
      datatype: definition.datatype,
      value: winner.display_value,
      raw: winner.raw_value,
      normalized: winner.normalized_value,
      agreement: isConflict ? "conflict" : candidates.length > 1 ? "consistent" : "single_source",
      contributors: candidates.map((candidate) => ({
        source_id: candidate.source.source_id,
        source_display_name: candidate.source.display_name,
        source_field: candidate.source_field,
        raw_value: candidate.raw_value,
        display_value: candidate.display_value,
        resolved_from: candidate.resolved_from,
        priority: candidate.source.priority,
      })),
      alternatives: Array.from(distinct.values())
        .filter((candidate) => candidate.normalized_value !== winner.normalized_value)
        .map((candidate) => ({
          source_id: candidate.source.source_id,
          source_display_name: candidate.source.display_name,
          value: candidate.display_value,
        })),
    });
  }

  const resolvedFields = fields.filter((field) => field.value !== "");
  const complaintStatus = fields.find((field) => field.canonical_field === "complaint_status");
  const openComplaints =
    complaintStatus &&
    complaintStatus.normalized &&
    isOpenComplaint(complaintStatus.normalized)
      ? 1
      : 0;
  const code = statusOf(recordsMatched, responded, openComplaints);

  step(
    "merge",
    "Unified medicine view constructed",
    `${resolvedFields.length} of ${CANONICAL_FIELDS.length} canonical fields resolved · ${conflicts} field conflict(s) resolved by source priority`,
    "ok",
    {
      resolved: resolvedFields.map((field) => ({
        canonical_field: field.canonical_field,
        sources: field.contributors.map((c) => c.source_id),
        agreement: field.agreement,
      })),
    },
  );

  step(
    "respond",
    "Integrated result returned to the GUI",
    `${STATUS_COPY[code].label} — ${responded}/${queries.length} source(s) returned a matching record`,
    code === "suspicious" ? "warn" : code === "not_found" ? "warn" : "ok",
    null,
  );

  const totalLatency = at();
  const result: IntegrationResult = {
    request: {
      input,
      canonical_key: canonicalKey,
      requested_at: startedAt,
      run_id: null,
      triggered_by: triggeredBy,
    },
    status: {
      code,
      label: STATUS_COPY[code].label,
      description: STATUS_COPY[code].description,
      disclaimer: DISCLAIMER,
      open_complaints: openComplaints,
    },
    plan: {
      canonical_key: canonicalKey,
      identity_field_per_source: identityFields,
      queries,
      skipped,
      considered,
    },
    sources: sourceViews,
    fields,
    trace: {
      steps,
      total_latency_ms: totalLatency,
      counters: {
        sources_registered: registry.length,
        sources_queried: queries.length,
        sources_answered: answered,
        sources_responded: responded,
        records_returned: recordsReturned,
        records_matched: recordsMatched,
        mappings_applied: mappingsAppliedCount,
        fields_resolved: resolvedFields.length,
        conflicts,
        http_calls: sourceViews.filter((view) => view.transport === "http").length,
        in_process_calls: sourceViews.filter((view) => view.transport === "in-process").length,
      },
    },
    statistics: {
      sources_answered: answered,
      sources_responded: responded,
      sources_queried: queries.length,
      fields_resolved: resolvedFields.length,
      fields_total: CANONICAL_FIELDS.length,
      conflicts,
      open_complaints: openComplaints,
    },
  };

  const transportSummary =
    sourceViews.length === 0
      ? "none"
      : sourceViews.every((view) => view.transport === "http")
        ? "http"
        : sourceViews.every((view) => view.transport === "in-process")
          ? "in-process"
          : "mixed";

  const runId = await ctx.runMutation(internal.runs.logRun, {
    medicine_id: input,
    normalized_key: canonicalKey,
    status: code,
    status_label: STATUS_COPY[code].label,
    sources_queried: queries.length,
    sources_responded: responded,
    fields_resolved: resolvedFields.length,
    conflicts,
    latency_ms: totalLatency,
    transport: transportSummary,
    triggered_by: triggeredBy,
    result_json: JSON.stringify(result),
    trace_json: JSON.stringify({
      steps,
      counters: result.trace.counters,
      total_latency_ms: totalLatency,
    }),
  });

  return {
    ...result,
    request: { ...result.request, run_id: runId as unknown as string },
  };
}
