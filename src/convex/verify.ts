/**
 * PUBLIC VERIFY ACTIONS
 * ---------------------------------------------------------------------------
 * Thin entry points for the GUI. All integration work happens inside the
 * mediator; these actions only translate arguments and, for the bulk console
 * action, run the authored demo cases through the same pipeline.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { integrateMedicine } from "./integration/mediator";
import { DEMO_CASES } from "./data/dataset";

export const verifyMedicine = action({
  args: {
    medicine_id: v.string(),
    /** Derived from VITE_CONVEX_URL by the client; used to reach the source APIs over HTTP. */
    site_base: v.optional(v.string()),
    triggered_by: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await integrateMedicine(ctx, {
      medicine_id: args.medicine_id,
      triggered_by: args.triggered_by ?? "verify-screen",
      site_base: args.site_base ?? null,
    });
  },
});

export const verifyDemoCases = action({
  args: { site_base: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const summaries: Array<{
      medicine_id: string;
      title: string;
      status: string;
      sources_responded: number;
      sources_queried: number;
      fields_resolved: number;
      conflicts: number;
      latency_ms: number;
      run_id: string | null;
    }> = [];

    for (const demoCase of DEMO_CASES) {
      const result = await integrateMedicine(ctx, {
        medicine_id: demoCase.id,
        triggered_by: "console-bulk",
        site_base: args.site_base ?? null,
      });
      summaries.push({
        medicine_id: demoCase.id,
        title: demoCase.title,
        status: result.status.code,
        sources_responded: result.statistics.sources_responded,
        sources_queried: result.statistics.sources_queried,
        fields_resolved: result.statistics.fields_resolved,
        conflicts: result.statistics.conflicts,
        latency_ms: result.trace.total_latency_ms,
        run_id: result.request.run_id,
      });
    }
    return summaries;
  },
});
