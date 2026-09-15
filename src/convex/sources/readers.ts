/**
 * SOURCE STORAGE READERS
 * ---------------------------------------------------------------------------
 * The only place in the backend that touches source storage. Each source keeps
 * its own table (own schema, own attribute names) and its own access path:
 *
 *   src_manufacturer      <- product_code
 *   src_distributor       <- item_id
 *   src_vendor            <- barcode
 *   src_consumer_affairs  <- product_id
 *   src_dynamic           <- attributes_json (onboarded sources, unknown schema)
 *
 * Lookup order per source: index hit on the raw key, then a normalised scan
 * (case / separator insensitive), then prefix resolution for identifiers that
 * carry a source-local suffix (a retail barcode such as MED10482-KM).
 */

import { v } from "convex/values";
import { internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { canonicalProductKey, normaliseIdentifier } from "../integration/canonical";

export type SourceRow = Record<string, unknown>;

export interface LookupResult {
  strategy: "index" | "normalized_scan" | "prefix_scan" | "miss";
  rows: SourceRow[];
}

function toPlain(row: Record<string, unknown>): SourceRow {
  const out: SourceRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === "_id" || key === "_creationTime") continue;
    out[key] = value;
  }
  return out;
}

export const SOURCE_STORAGE = {
  manufacturer: "table:src_manufacturer",
  distributor: "table:src_distributor",
  vendor: "table:src_vendor",
  consumer_affairs: "table:src_consumer_affairs",
  dynamic: "dynamic",
} as const;

export async function loadAllRows(
  ctx: QueryCtx | MutationCtx,
  storage: string,
  sourceId: string,
): Promise<SourceRow[]> {
  switch (storage) {
    case SOURCE_STORAGE.manufacturer:
      return (await ctx.db.query("src_manufacturer").collect()).map((r) => toPlain(r));
    case SOURCE_STORAGE.distributor:
      return (await ctx.db.query("src_distributor").collect()).map((r) => toPlain(r));
    case SOURCE_STORAGE.vendor:
      return (await ctx.db.query("src_vendor").collect()).map((r) => toPlain(r));
    case SOURCE_STORAGE.consumer_affairs:
      return (await ctx.db.query("src_consumer_affairs").collect()).map((r) => toPlain(r));
    case SOURCE_STORAGE.dynamic: {
      const rows = await ctx.db
        .query("src_dynamic")
        .withIndex("by_source_id", (q) => q.eq("source_id", sourceId))
        .collect();
      return rows.map((row) => {
        try {
          return JSON.parse(row.attributes_json) as SourceRow;
        } catch {
          return { __parse_error: row.attributes_json } as SourceRow;
        }
      });
    }
    default:
      return [];
  }
}

async function indexLookup(
  ctx: QueryCtx | MutationCtx,
  storage: string,
  field: string,
  value: string,
): Promise<SourceRow | null> {
  if (storage === SOURCE_STORAGE.manufacturer && field === "product_code") {
    const hit = await ctx.db
      .query("src_manufacturer")
      .withIndex("by_product_code", (q) => q.eq("product_code", value))
      .first();
    return hit ? toPlain(hit) : null;
  }
  if (storage === SOURCE_STORAGE.distributor && field === "item_id") {
    const hit = await ctx.db
      .query("src_distributor")
      .withIndex("by_item_id", (q) => q.eq("item_id", value))
      .first();
    return hit ? toPlain(hit) : null;
  }
  if (storage === SOURCE_STORAGE.vendor && field === "barcode") {
    const hit = await ctx.db
      .query("src_vendor")
      .withIndex("by_barcode", (q) => q.eq("barcode", value))
      .first();
    return hit ? toPlain(hit) : null;
  }
  if (storage === SOURCE_STORAGE.consumer_affairs && field === "product_id") {
    const hit = await ctx.db
      .query("src_consumer_affairs")
      .withIndex("by_product_id", (q) => q.eq("product_id", value))
      .first();
    return hit ? toPlain(hit) : null;
  }
  return null;
}

/** Full dump of one source (used by GET /api/sources/<id>/items and by stats). */
export const listSourceRows = internalQuery({
  args: { source_id: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const source = await ctx.db
      .query("source_registry")
      .withIndex("by_source_id", (q) => q.eq("source_id", args.source_id))
      .first();
    if (!source) return null;
    const rows = await loadAllRows(ctx, source.storage, args.source_id);
    const limit = args.limit ?? rows.length;
    return {
      source_id: source.source_id,
      storage: source.storage,
      total: rows.length,
      rows: rows.slice(0, Math.max(0, limit)),
    };
  },
});

/**
 * Source-local record resolution. The source knows its own identifier semantics,
 * which is exactly why the mediator delegates resolution instead of assuming
 * one global key format.
 */
export const resolveSourceRecord = internalQuery({
  args: {
    source_id: v.string(),
    field: v.string(),
    value: v.string(),
  },
  handler: async (ctx, args): Promise<LookupResult> => {
    const source = await ctx.db
      .query("source_registry")
      .withIndex("by_source_id", (q) => q.eq("source_id", args.source_id))
      .first();
    if (!source) return { strategy: "miss", rows: [] };

    const exact = await indexLookup(ctx, source.storage, args.field, args.value);
    if (exact) return { strategy: "index", rows: [exact] };

    const all = await loadAllRows(ctx, source.storage, args.source_id);
    const target = normaliseIdentifier(args.value);

    const normalised = all.filter(
      (row) => normaliseIdentifier(String(row[args.field] ?? "")) === target,
    );
    if (normalised.length > 0) return { strategy: "normalized_scan", rows: normalised };

    const prefixed = all.filter((row) =>
      normaliseIdentifier(String(row[args.field] ?? "")).startsWith(target),
    );
    if (prefixed.length > 0) return { strategy: "prefix_scan", rows: prefixed };

    return { strategy: "miss", rows: [] };
  },
});

/** Row counts per physical source table, used by the console + /sources screen. */
export const storageCounts = internalQuery({
  args: {},
  handler: async (ctx) => {
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
    for (const row of manufacturer) products.add(canonicalProductKey(row.product_code));
    for (const row of distributor) products.add(canonicalProductKey(row.item_id));
    for (const row of vendor) products.add(canonicalProductKey(row.barcode));
    for (const row of consumer) products.add(canonicalProductKey(row.product_id));

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
      integration_runs: runs.length,
    };
  },
});
