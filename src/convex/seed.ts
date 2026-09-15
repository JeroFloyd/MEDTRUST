/**
 * SEEDING
 * ---------------------------------------------------------------------------
 * Populates the five independent source systems with the synthetic dataset and
 * registers them in the source registry. Sources are inserted through their own
 * tables (never a shared one) so that the independence is real, and their
 * mappings are produced by the matcher at seed time exactly like a fresh
 * onboarding would produce them.
 */

import { v } from "convex/values";
import { action, internalMutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { buildDataset } from "./data/dataset";
import { SOURCE_DEFINITIONS, buildRegistryRow, knownValueSets, profileRows } from "./registry";

async function clearTable(ctx: MutationCtx, table: string) {
  switch (table) {
    case "src_manufacturer":
      for (const row of await ctx.db.query("src_manufacturer").collect()) await ctx.db.delete(row._id);
      break;
    case "src_distributor":
      for (const row of await ctx.db.query("src_distributor").collect()) await ctx.db.delete(row._id);
      break;
    case "src_vendor":
      for (const row of await ctx.db.query("src_vendor").collect()) await ctx.db.delete(row._id);
      break;
    case "src_consumer_affairs":
      for (const row of await ctx.db.query("src_consumer_affairs").collect()) await ctx.db.delete(row._id);
      break;
    case "src_dynamic":
      for (const row of await ctx.db.query("src_dynamic").collect()) await ctx.db.delete(row._id);
      break;
    case "source_registry":
      for (const row of await ctx.db.query("source_registry").collect()) await ctx.db.delete(row._id);
      break;
    default:
      break;
  }
}

export const seedManufacturer = internalMutation({
  args: {},
  handler: async (ctx) => {
    const { manufacturer } = buildDataset();
    await clearTable(ctx, "src_manufacturer");
    for (const row of manufacturer) await ctx.db.insert("src_manufacturer", row);
    return { inserted: manufacturer.length };
  },
});

export const seedDistributor = internalMutation({
  args: {},
  handler: async (ctx) => {
    const { distributor } = buildDataset();
    await clearTable(ctx, "src_distributor");
    for (const row of distributor) await ctx.db.insert("src_distributor", row);
    return { inserted: distributor.length };
  },
});

export const seedVendor = internalMutation({
  args: {},
  handler: async (ctx) => {
    const { vendor } = buildDataset();
    await clearTable(ctx, "src_vendor");
    for (const row of vendor) await ctx.db.insert("src_vendor", row);
    return { inserted: vendor.length };
  },
});

export const seedConsumerAffairs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const { consumer } = buildDataset();
    await clearTable(ctx, "src_consumer_affairs");
    for (const row of consumer) await ctx.db.insert("src_consumer_affairs", row);
    return { inserted: consumer.length };
  },
});

/** The fifth source keeps generic storage because its schema is unknown. */
export const seedDynamicSource = internalMutation({
  args: {},
  handler: async (ctx) => {
    const { central_registry } = buildDataset();
    await clearTable(ctx, "src_dynamic");
    for (const row of central_registry) {
      await ctx.db.insert("src_dynamic", {
        source_id: "state_drug_registry",
        attributes_json: JSON.stringify(row),
      });
    }
    return { inserted: central_registry.length };
  },
});

/**
 * Register every source with its profiled schema + matcher mappings. The four
 * built-in systems are seeded as already onboarded; the fifth arrives pending so
 * that the onboarding demo can accept its mappings live.
 */
export const seedSourceRegistry = internalMutation({
  args: {},
  handler: async (ctx) => {
    const dataset = buildDataset();
    await clearTable(ctx, "source_registry");

    const rowsBySource: Record<string, Array<Record<string, unknown>>> = {
      manufacturer: dataset.manufacturer as unknown as Array<Record<string, unknown>>,
      distributor: dataset.distributor as unknown as Array<Record<string, unknown>>,
      vendor: dataset.vendor as unknown as Array<Record<string, unknown>>,
      consumer_affairs: dataset.consumer as unknown as Array<Record<string, unknown>>,
      state_drug_registry: dataset.central_registry as unknown as Array<Record<string, unknown>>,
    };

    const created: Array<{ source_id: string; active: boolean; fields: number; accepted: number }> = [];
    for (const definition of SOURCE_DEFINITIONS) {
      const rows = rowsBySource[definition.source_id] ?? [];
      const active = definition.source_id !== "state_drug_registry";
      const registryRow = buildRegistryRow(definition, rows, active);
      // The fifth source is seeded pending: proposals exist, nothing is accepted yet.
      const mappings = active
        ? registryRow.mappings
        : registryRow.mappings.map((mapping) => ({
            ...mapping,
            accepted: false,
            origin: mapping.canonical_field ? "matcher" : "unmatched",
          }));
      await ctx.db.insert("source_registry", { ...registryRow, mappings });
      created.push({
        source_id: definition.source_id,
        active,
        fields: registryRow.fields.length,
        accepted: mappings.filter((m) => m.accepted).length,
      });
    }
    return { sources: created };
  },
});

/** Re-profile the fifth source live (used by the console "re-run matcher"). */
export const refreshDynamicProfile = internalMutation({
  args: {},
  handler: async (ctx) => {
    const source = await ctx.db
      .query("source_registry")
      .withIndex("by_source_id", (q) => q.eq("source_id", "state_drug_registry"))
      .first();
    if (!source) return { ok: false };
    const stored = await ctx.db
      .query("src_dynamic")
      .withIndex("by_source_id", (q) => q.eq("source_id", "state_drug_registry"))
      .collect();
    const rows = stored.flatMap((row) => {
      try {
        return [JSON.parse(row.attributes_json) as Record<string, unknown>];
      } catch {
        return [];
      }
    });
    const fields = profileRows(rows);
    await ctx.db.patch(source._id, { fields });
    return { ok: true, fields: fields.length, rows: rows.length };
  },
});

export const markSeeded = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("system_state")
      .withIndex("by_key", (q) => q.eq("key", "dataset"))
      .first();
    if (existing) await ctx.db.patch(existing._id, { value: "seeded" });
    else await ctx.db.insert("system_state", { key: "dataset", value: "seeded" });
    const known = knownValueSets();
    return { ok: true, canonical_value_sets: Object.keys(known).length };
  },
});

export interface BootstrapResult {
  seeded: boolean;
  skipped: boolean;
  message?: string;
  inserted?: {
    manufacturer: number;
    distributor: number;
    vendor: number;
    consumer_affairs: number;
    state_drug_registry: number;
  };
  registered_sources?: Array<{
    source_id: string;
    active: boolean;
    fields: number;
    accepted: number;
  }>;
}

/** Public entry point: idempotent dataset bootstrap (force = re-seed). */
export const bootstrapDataset = action({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<BootstrapResult> => {
    const state = await ctx.runQuery(internal.registry.seedState, {});
    if (state.seeded && !args.force) {
      return { seeded: true, skipped: true, message: "dataset already present" };
    }
    const manufacturer = await ctx.runMutation(internal.seed.seedManufacturer, {});
    const distributor = await ctx.runMutation(internal.seed.seedDistributor, {});
    const vendor = await ctx.runMutation(internal.seed.seedVendor, {});
    const consumer = await ctx.runMutation(internal.seed.seedConsumerAffairs, {});
    const dynamic = await ctx.runMutation(internal.seed.seedDynamicSource, {});
    const registry = await ctx.runMutation(internal.seed.seedSourceRegistry, {});
    await ctx.runMutation(internal.seed.markSeeded, {});
    return {
      seeded: true,
      skipped: false,
      inserted: {
        manufacturer: manufacturer.inserted,
        distributor: distributor.inserted,
        vendor: vendor.inserted,
        consumer_affairs: consumer.inserted,
        state_drug_registry: dynamic.inserted,
      },
      registered_sources: registry.sources,
    };
  },
});
