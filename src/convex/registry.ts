/**
 * SOURCE REGISTRY / METADATA CATALOGUE
 * ---------------------------------------------------------------------------
 * One row per source system: its own schema descriptor (profiled), the mappings
 * to the canonical schema with their matcher scores, and whether the mediator is
 * allowed to query it. Built-in sources are seeded already accepted; a newly
 * onboarded source stays inactive until its identity mapping is accepted.
 */

import { v } from "convex/values";
import { internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  CANONICAL_FIELDS,
  canonicalProductKey,
  type CanonicalFieldId,
  type Datatype,
} from "./integration/canonical";
import {
  THRESHOLDS,
  inferFieldDescriptor,
  proposeMappings,
  scoreCandidate,
  type KnownValues,
  type SourceFieldDescriptor,
} from "./integration/schemaMatching";
import { buildDataset, buildKnownValues } from "./data/dataset";
import { loadAllRows, type SourceRow } from "./sources/readers";

/* -------------------------------------------------------------------------- */
/* Built-in source definitions                                                */
/* -------------------------------------------------------------------------- */

export interface SourceDefinition {
  source_id: string;
  display_name: string;
  owner: string;
  kind: string;
  storage: string;
  description: string;
  priority: number;
  notes: string;
}

export const SOURCE_DEFINITIONS: SourceDefinition[] = [
  {
    source_id: "manufacturer",
    display_name: "Manufacturer ERP",
    owner: "Participating pharma manufacturers",
    kind: "manufacturer",
    storage: "table:src_manufacturer",
    description:
      "Production records published by each manufacturing company. Own schema: product_code / product_name / company / batch_no / manufacture_date / expiry_date.",
    priority: 1,
    notes: "Highest trust for identity, batch and manufacturing dates.",
  },
  {
    source_id: "distributor",
    display_name: "Distributor Supply Chain",
    owner: "Wholesale distribution network",
    kind: "distributor",
    storage: "table:src_distributor",
    description:
      "Outbound dispatch register. Own schema: item_id / medicine / supplier / batch_number / procured_on / vendor_name / quantity.",
    priority: 2,
    notes: "Owns supplier, procurement date and which vendor received the stock.",
  },
  {
    source_id: "vendor",
    display_name: "Vendor Point of Sale",
    owner: "Retail chemists",
    kind: "vendor",
    storage: "table:src_vendor",
    description:
      "Retail counter system. Own schema: barcode / item / seller / batch / received_on / selling_price. Barcodes may carry a retail outlet suffix.",
    priority: 3,
    notes: "Stores its own barcode convention; the mediator asks the source to resolve the key.",
  },
  {
    source_id: "consumer_affairs",
    display_name: "Consumer Affairs Complaints",
    owner: "District consumer affairs desk",
    kind: "consumer",
    storage: "table:src_consumer_affairs",
    description:
      "Counterfeit and quality complaint register. Own schema: product_id / complaint_type / complaint_date / status / remarks.",
    priority: 4,
    notes: "Sparse by design: absence of a row means no complaint was filed.",
  },
  {
    source_id: "state_drug_registry",
    display_name: "State Drug Control Registry",
    owner: "State drugs control department",
    kind: "registry",
    storage: "dynamic",
    description:
      "A newly acquired third-party registry with an unrelated schema: sku / drug_name / maker / lot / license_no. Used for the onboarding demo.",
    priority: 5,
    notes: "Starts unregistered; the matcher proposes the mapping and an integrator accepts it.",
  },
];

export const DYNAMIC_SOURCE_IDS = ["state_drug_registry"];

/* -------------------------------------------------------------------------- */
/* Profiling + mapping helpers (plain functions, reused by seed and onboarding) */
/* -------------------------------------------------------------------------- */

export function profileRows(rows: SourceRow[]): SourceFieldDescriptor[] {
  const columns = new Map<string, unknown[]>();
  for (const row of rows) {
    for (const [name, value] of Object.entries(row)) {
      const bucket = columns.get(name);
      if (bucket) bucket.push(value);
      else columns.set(name, [value]);
    }
  }
  return Array.from(columns.entries()).map(([name, values]) => inferFieldDescriptor(name, values));
}

export interface MappingRecord {
  source_field: string;
  canonical_field: string;
  score: number;
  name_score: number;
  datatype_score: number;
  sample_score: number;
  reasoning: string;
  origin: string;
  accepted: boolean;
  warnings: string[];
}

export function knownValueSets(): KnownValues {
  return buildKnownValues(buildDataset());
}

/** Run the matcher over a source's own columns and produce registry mappings. */
export function buildMappings(
  fields: SourceFieldDescriptor[],
  known: KnownValues,
): MappingRecord[] {
  const report = proposeMappings(fields, known);
  const targetCounts = new Map<string, number>();
  for (const proposal of report.fields) {
    if (!proposal.recommended || proposal.status === "unmatched") continue;
    const key = proposal.recommended.canonical_field;
    targetCounts.set(key, (targetCounts.get(key) ?? 0) + 1);
  }

  return report.fields.map((proposal) => {
    const best = proposal.recommended;
    const confident = Boolean(best) && proposal.status !== "unmatched";
    const warnings = confident && best ? [...best.warnings] : [];
    if (proposal.status === "ambiguous") {
      warnings.push(
        `ambiguous: ${proposal.candidates[1]?.canonical_field} scores within ${proposal.margin.toFixed(2)} — human confirmation recommended`,
      );
    }
    if (!confident) {
      warnings.push(
        `below the acceptance threshold of ${THRESHOLDS.accept}: kept out of the integration`,
      );
    }
    if (confident && best && (targetCounts.get(best.canonical_field) ?? 0) > 1) {
      warnings.push(
        `another column maps to ${best.canonical_field}; the mediator applies source priority to resolve the overlap`,
      );
    }
    return {
      source_field: proposal.source_field.name,
      canonical_field: confident && best ? best.canonical_field : "",
      score: best?.score ?? 0,
      name_score: best?.name_score ?? 0,
      datatype_score: best?.datatype_score ?? 0,
      sample_score: best?.sample_score ?? 0,
      reasoning: best?.reasoning ?? "no candidate produced a score",
      origin: confident ? "matcher" : "unmatched",
      accepted: confident,
      warnings,
    };
  });
}

export function buildRegistryRow(def: SourceDefinition, rows: SourceRow[], active: boolean) {
  const fields = profileRows(rows);
  const mappings = buildMappings(fields, knownValueSets());
  return {
    source_id: def.source_id,
    display_name: def.display_name,
    owner: def.owner,
    kind: def.kind,
    storage: def.storage,
    description: def.description,
    api_base: `/api/sources/${def.source_id}`,
    fields,
    mappings,
    active,
    priority: def.priority,
    onboarded_at: active ? Date.now() : undefined,
    notes: def.notes,
  };
}

/* -------------------------------------------------------------------------- */
/* Shared stats (queries must read the database directly)                      */
/* -------------------------------------------------------------------------- */

async function statsFor(ctx: QueryCtx) {
  const [manufacturer, distributor, vendor, consumer, dynamic, registry, runs] = await Promise.all([
    ctx.db.query("src_manufacturer").collect(),
    ctx.db.query("src_distributor").collect(),
    ctx.db.query("src_vendor").collect(),
    ctx.db.query("src_consumer_affairs").collect(),
    ctx.db.query("src_dynamic").collect(),
    ctx.db.query("source_registry").collect(),
    ctx.db.query("integration_runs").collect(),
  ]);
  const products = new Set<string>();
  const add = (value: string) => products.add(canonicalProductKey(value));
  for (const row of manufacturer) add(row.product_code);
  for (const row of distributor) add(row.item_id);
  for (const row of vendor) add(row.barcode);
  for (const row of consumer) add(row.product_id);

  return {
    tables: {
      src_manufacturer: manufacturer.length,
      src_distributor: distributor.length,
      src_vendor: vendor.length,
      src_consumer_affairs: consumer.length,
      src_dynamic: dynamic.length,
    },
    total_records:
      manufacturer.length + distributor.length + vendor.length + consumer.length + dynamic.length,
    distinct_products: products.size,
    registered_sources: registry.length,
    active_sources: registry.filter((r) => r.active).length,
    integration_runs: runs.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Queries                                                                    */
/* -------------------------------------------------------------------------- */

export const status = query({
  args: {},
  handler: async (ctx) => {
    const state = await ctx.db
      .query("system_state")
      .withIndex("by_key", (q) => q.eq("key", "dataset"))
      .first();
    const stats = await statsFor(ctx);
    return { seeded: state?.value === "seeded", stats };
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => statsFor(ctx),
});

export const canonicalSchema = query({
  args: {},
  handler: async () =>
    CANONICAL_FIELDS.map((field) => ({
      id: field.id,
      label: field.label,
      datatype: field.datatype,
      description: field.description,
      pattern: field.pattern ?? null,
      aliases: field.aliases,
      order: field.order,
    })),
});

export const listSources = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("source_registry").collect();
    const enriched = await Promise.all(
      rows.map(async (row) => {
        const data = await loadAllRows(ctx, row.storage, row.source_id);
        return {
          source_id: row.source_id,
          display_name: row.display_name,
          owner: row.owner,
          kind: row.kind,
          storage: row.storage,
          description: row.description,
          api_base: row.api_base,
          active: row.active,
          priority: row.priority,
          notes: row.notes,
          onboarded_at: row.onboarded_at ?? null,
          fields: row.fields,
          mappings: row.mappings,
          record_count: data.length,
          accepted_mappings: row.mappings.filter((m) => m.accepted).length,
          unresolved_columns: row.mappings.filter((m) => !m.accepted).map((m) => m.source_field),
        };
      }),
    );
    return enriched.sort((a, b) => a.priority - b.priority);
  },
});

/** Live matcher output for one source, computed from its current data. */
export const proposal = query({
  args: { source_id: v.string() },
  handler: async (ctx, args) => {
    const source = await ctx.db
      .query("source_registry")
      .withIndex("by_source_id", (q) => q.eq("source_id", args.source_id))
      .first();
    if (!source) return null;
    const rows = await loadAllRows(ctx, source.storage, source.source_id);
    const fields = profileRows(rows);
    const known = knownValueSets();
    const report = proposeMappings(fields, known);
    return {
      source_id: source.source_id,
      display_name: source.display_name,
      active: source.active,
      row_count: rows.length,
      fields,
      report,
      stored_mappings: source.mappings,
    };
  },
});

/**
 * Matcher dry-run for a pasted schema, used by the onboarding screen to show
 * what the system would propose before anything is registered.
 */
export const previewSchema = query({
  args: {
    fields: v.array(
      v.object({
        name: v.string(),
        samples: v.array(v.string()),
      }),
    ),
  },
  handler: async (_ctx, args) => {
    const known = knownValueSets();
    const descriptors: SourceFieldDescriptor[] = args.fields
      .filter((field) => field.name.trim().length > 0)
      .map((field) => inferFieldDescriptor(field.name.trim(), field.samples));
    const report = proposeMappings(descriptors, known);
    return { fields: descriptors, report };
  },
});

/** Internal: full registry rows for the source APIs and the mediator. */
export const internalListSources = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("source_registry").collect();
    return rows.sort((a, b) => a.priority - b.priority);
  },
});

export const seedState = internalQuery({
  args: {},
  handler: async (ctx) => {
    const state = await ctx.db
      .query("system_state")
      .withIndex("by_key", (q) => q.eq("key", "dataset"))
      .first();
    return { seeded: state?.value === "seeded" };
  },
});

/* -------------------------------------------------------------------------- */
/* Registry mutations                                                         */
/* -------------------------------------------------------------------------- */

async function loadRegistryRow(ctx: MutationCtx, sourceId: string) {
  return ctx.db
    .query("source_registry")
    .withIndex("by_source_id", (q) => q.eq("source_id", sourceId))
    .first();
}

export const acceptMapping = mutation({
  args: {
    source_id: v.string(),
    source_field: v.string(),
    canonical_field: v.string(),
  },
  handler: async (ctx, args) => {
    const source = await loadRegistryRow(ctx, args.source_id);
    if (!source) throw new Error(`unknown source ${args.source_id}`);
    const field = source.fields.find((f) => f.name === args.source_field);
    if (!field) throw new Error(`unknown column ${args.source_field}`);
    const canonicalId = args.canonical_field as CanonicalFieldId;
    const def = CANONICAL_FIELDS.find((f) => f.id === canonicalId);
    if (!def) throw new Error(`unknown canonical field ${args.canonical_field}`);

    const existing = source.mappings.find((m) => m.source_field === args.source_field);
    const descriptor: SourceFieldDescriptor = {
      name: field.name,
      datatype: field.datatype as Datatype,
      samples: field.samples,
      nullable: field.nullable,
    };
    const scored = scoreCandidate(descriptor, def, knownValueSets());
    const changedByHuman = existing ? existing.canonical_field !== args.canonical_field : true;

    const nextMapping = {
      source_field: args.source_field,
      canonical_field: def.id,
      score: scored.score,
      name_score: scored.name_score,
      datatype_score: scored.datatype_score,
      sample_score: scored.sample_score,
      reasoning: changedByHuman
        ? `Accepted by an integrator (matcher ${existing?.score.toFixed(2) ?? "—"} → ${scored.score.toFixed(2)}). ${scored.reasoning}`
        : `Accepted as proposed. ${scored.reasoning}`,
      origin: changedByHuman ? "manual" : "matcher-accepted",
      accepted: true,
      warnings: scored.warnings,
    };

    const mappings = existing
      ? source.mappings.map((m) => (m.source_field === args.source_field ? nextMapping : m))
      : [...source.mappings, nextMapping];

    await ctx.db.patch(source._id, { mappings });
    return { ok: true, mapping: nextMapping };
  },
});

export const rejectMapping = mutation({
  args: { source_id: v.string(), source_field: v.string() },
  handler: async (ctx, args) => {
    const source = await loadRegistryRow(ctx, args.source_id);
    if (!source) throw new Error(`unknown source ${args.source_id}`);
    const mappings = source.mappings.map((m) =>
      m.source_field === args.source_field
        ? { ...m, accepted: false, origin: "rejected", canonical_field: "" }
        : m,
    );
    await ctx.db.patch(source._id, { mappings });
    return { ok: true };
  },
});

export const acceptAllProposals = mutation({
  args: { source_id: v.string() },
  handler: async (ctx, args) => {
    const source = await loadRegistryRow(ctx, args.source_id);
    if (!source) throw new Error(`unknown source ${args.source_id}`);
    const rows = await loadAllRows(ctx, source.storage, source.source_id);
    const known = knownValueSets();
    const fields = profileRows(rows);
    const proposals = buildMappings(fields, known).map((mapping) =>
      mapping.canonical_field
        ? { ...mapping, accepted: true, origin: "matcher-accepted" }
        : mapping,
    );
    await ctx.db.patch(source._id, { fields, mappings: proposals });
    return { ok: true, accepted: proposals.filter((m) => m.accepted).length };
  },
});

export const rerunMatcher = mutation({
  args: { source_id: v.string() },
  handler: async (ctx, args) => {
    const source = await loadRegistryRow(ctx, args.source_id);
    if (!source) throw new Error(`unknown source ${args.source_id}`);
    const rows = await loadAllRows(ctx, source.storage, source.source_id);
    const known = knownValueSets();
    const fields = profileRows(rows);
    const fresh = buildMappings(fields, known);
    // Keep existing human decisions (accepted flag + manual targets) sticky.
    const permissions = new Map(source.mappings.map((m) => [m.source_field, m]));
    const mappings = fresh.map((mapping) => {
      const previous = permissions.get(mapping.source_field);
      if (!previous) return mapping;
      if (previous.origin === "manual" || previous.origin === "rejected") {
        return { ...previous, score: mapping.score, name_score: mapping.name_score, datatype_score: mapping.datatype_score, sample_score: mapping.sample_score, reasoning: mapping.reasoning };
      }
      return { ...mapping, accepted: previous.accepted };
    });
    await ctx.db.patch(source._id, { fields, mappings });
    return { ok: true, mappings };
  },
});

export const completeOnboarding = mutation({
  args: { source_id: v.string() },
  handler: async (ctx, args) => {
    const source = await loadRegistryRow(ctx, args.source_id);
    if (!source) throw new Error(`unknown source ${args.source_id}`);
    const identity = source.mappings.find(
      (m) => m.accepted && m.canonical_field === "medicine_id",
    );
    if (!identity) {
      throw new Error(
        "the mediator needs an accepted mapping to Medicine ID before this source can be queried",
      );
    }
    await ctx.db.patch(source._id, { active: true, onboarded_at: Date.now() });
    return { ok: true, identity_field: identity.source_field };
  },
});

export const resetOnboarding = mutation({
  args: { source_id: v.string() },
  handler: async (ctx, args) => {
    const source = await loadRegistryRow(ctx, args.source_id);
    if (!source) throw new Error(`unknown source ${args.source_id}`);
    const rows = await loadAllRows(ctx, source.storage, source.source_id);
    const fields = profileRows(rows);
    const mappings = buildMappings(fields, knownValueSets()).map((m) => ({
      ...m,
      accepted: false,
      origin: m.canonical_field ? "matcher" : "unmatched",
    }));
    await ctx.db.patch(source._id, {
      fields,
      mappings,
      active: false,
      onboarded_at: undefined,
    });
    return { ok: true };
  },
});

/**
 * Register an additional source that arrives with an arbitrary schema.
 * The columns are profiled and the matcher proposes mappings; the source stays
 * inactive until the integrator accepts them.
 */
export const registerDynamicSource = mutation({
  args: {
    display_name: v.string(),
    owner: v.optional(v.string()),
    records_json: v.string(),
  },
  handler: async (ctx, args) => {
    const displayName = args.display_name.trim();
    if (!displayName) throw new Error("give the incoming source a name");

    let parsed: unknown;
    try {
      parsed = JSON.parse(args.records_json);
    } catch {
      throw new Error("records must be a JSON array of objects, one per record");
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("records must be a non-empty JSON array of objects");
    }
    const rows: SourceRow[] = parsed.map((row, index) => {
      if (typeof row !== "object" || row === null || Array.isArray(row)) {
        throw new Error(`record ${index + 1} is not a JSON object`);
      }
      return row as SourceRow;
    });
    if (rows.length > 200) throw new Error("keep the demonstration dataset under 200 records");

    const slug =
      displayName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "") || "new_source";
    let sourceId = slug;
    let suffix = 2;
    while (await loadRegistryRow(ctx, sourceId)) {
      sourceId = `${slug}_${suffix}`;
      suffix += 1;
    }

    const fields = profileRows(rows);
    const mappings = buildMappings(fields, knownValueSets()).map((m) => ({
      ...m,
      accepted: false,
      origin: m.canonical_field ? "matcher" : "unmatched",
    }));

    for (const row of rows) {
      await ctx.db.insert("src_dynamic", {
        source_id: sourceId,
        attributes_json: JSON.stringify(row),
      });
    }

    await ctx.db.insert("source_registry", {
      source_id: sourceId,
      display_name: displayName,
      owner: args.owner?.trim() || "External partner (demo)",
      kind: "third_party",
      storage: "dynamic",
      description: `Onboarded during the demo with ${fields.length} attributes and ${rows.length} records. Schema was profiled by the matcher, not hand-written.`,
      api_base: `/api/sources/${sourceId}`,
      fields,
      mappings,
      active: false,
      priority: 6,
      notes: "Awaiting mapping acceptance.",
    });

    return { ok: true, source_id: sourceId, fields, mappings };
  },
});

export const deleteDynamicSource = mutation({
  args: { source_id: v.string() },
  handler: async (ctx, args) => {
    const source = await loadRegistryRow(ctx, args.source_id);
    if (!source) throw new Error("unknown source");
    if (!DYNAMIC_SOURCE_IDS.includes(source.source_id) && source.storage !== "dynamic") {
      throw new Error("only dynamically onboarded sources can be removed");
    }
    if (DYNAMIC_SOURCE_IDS.includes(source.source_id)) {
      throw new Error(
        "the seeded state registry is part of the demo dataset — use 'Reset onboarding' instead",
      );
    }
    const rows = await ctx.db
      .query("src_dynamic")
      .withIndex("by_source_id", (q) => q.eq("source_id", args.source_id))
      .collect();
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
    await ctx.db.delete(source._id);
    return { ok: true };
  },
});
