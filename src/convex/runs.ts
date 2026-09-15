/**
 * INTEGRATION RUN LOG
 * ---------------------------------------------------------------------------
 * Every mediation request is persisted with its plan, trace and integrated
 * result, so the /trace screen can show real history instead of a mock-up.
 */

import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const logRun = internalMutation({
  args: {
    medicine_id: v.string(),
    normalized_key: v.string(),
    status: v.string(),
    status_label: v.string(),
    sources_queried: v.number(),
    sources_responded: v.number(),
    fields_resolved: v.number(),
    conflicts: v.number(),
    latency_ms: v.number(),
    transport: v.string(),
    triggered_by: v.string(),
    result_json: v.string(),
    trace_json: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("integration_runs", args);
    // Keep the demo history bounded.
    const all = await ctx.db.query("integration_runs").collect();
    if (all.length > 60) {
      const oldest = all
        .sort((a, b) => a._creationTime - b._creationTime)
        .slice(0, all.length - 60);
      for (const row of oldest) await ctx.db.delete(row._id);
    }
    return id;
  },
});

function toSummary(row: {
  _id: Id<"integration_runs">;
  _creationTime: number;
  medicine_id: string;
  normalized_key: string;
  status: string;
  status_label: string;
  sources_queried: number;
  sources_responded: number;
  fields_resolved: number;
  conflicts: number;
  latency_ms: number;
  transport: string;
  triggered_by: string;
}) {
  return {
    run_id: row._id,
    created_at: row._creationTime,
    medicine_id: row.medicine_id,
    normalized_key: row.normalized_key,
    status: row.status,
    status_label: row.status_label,
    sources_queried: row.sources_queried,
    sources_responded: row.sources_responded,
    fields_resolved: row.fields_resolved,
    conflicts: row.conflicts,
    latency_ms: row.latency_ms,
    transport: row.transport,
    triggered_by: row.triggered_by,
  };
}

export const history = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 25, 1), 60);
    const rows = await ctx.db.query("integration_runs").order("desc").take(limit);
    return rows.map((row) => toSummary(row));
  },
});

export const latest = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("integration_runs").order("desc").first();
    return row ? toSummary(row) : null;
  },
});

export const detail = query({
  args: { run_id: v.id("integration_runs") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.run_id);
    if (!row) return null;
    let result: unknown = null;
    let trace: unknown = null;
    try {
      result = JSON.parse(row.result_json);
    } catch {
      result = null;
    }
    try {
      trace = JSON.parse(row.trace_json);
    } catch {
      trace = null;
    }
    return { ...toSummary(row), result, trace };
  },
});
