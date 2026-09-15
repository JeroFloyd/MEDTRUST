/**
 * SOURCE APIs
 * ---------------------------------------------------------------------------
 * Every source system exposes its own HTTP API. The routes are registered in
 * convex/http.ts and are served by this handler:
 *
 *   GET /api/health
 *   GET /api/sources                                 index of all sources
 *   GET /api/sources/<source_id>/schema              the source's own schema
 *   GET /api/sources/<source_id>/items?limit=10      raw records
 *   GET /api/sources/<source_id>/item/<key>          resolve one record
 *
 * The mediator calls exactly these endpoints. The same handler is reused for the
 * in-process transport fallback (see integration/adapters.ts) so that both
 * transports return byte-identical payloads.
 */

import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { normaliseIdentifier, normaliseValue } from "../integration/canonical";

export const API_VERSION = "medtrust-source-api/v1";

export interface ApiResponse {
  status: number;
  body: unknown;
}

export interface SourceDescriptorRow {
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
  mappings: Array<{ source_field: string; canonical_field: string; score: number; accepted: boolean }>;
}

function json(status: number, body: unknown): ApiResponse {
  return { status, body };
}

function identityField(source: SourceDescriptorRow): string {
  const accepted = source.mappings.find((m) => m.accepted && m.canonical_field === "medicine_id");
  if (accepted) return accepted.source_field;
  const proposed = source.mappings.find((m) => m.canonical_field === "medicine_id");
  if (proposed) return proposed.source_field;
  return source.fields[0]?.name ?? "id";
}

/** GET /api/health */
export async function healthResponse(ctx: ActionCtx): Promise<ApiResponse> {
  const counts = await ctx.runQuery(internal.sources.readers.storageCounts, {});
  const sources = (await ctx.runQuery(internal.registry.internalListSources, {})) as SourceDescriptorRow[];
  return json(200, {
    api_version: API_VERSION,
    service: "MEDTRUST source API gateway",
    status: "ok",
    registered_sources: sources.length,
    active_sources: sources.filter((s) => s.active).length,
    storage_counts: counts,
  });
}

/** GET /api/sources */
export async function sourceIndexResponse(ctx: ActionCtx, requestUrl: string): Promise<ApiResponse> {
  const sources = (await ctx.runQuery(internal.registry.internalListSources, {})) as SourceDescriptorRow[];
  const base = requestUrl.replace(/\/api\/sources\/?$/, "");
  return json(200, {
    api_version: API_VERSION,
    service: "MEDTRUST sources",
    note: "Each entry is an independent source system with its own schema; the mediator queries these endpoints.",
    sources: sources.map((source) => ({
      source_id: source.source_id,
      display_name: source.display_name,
      owner: source.owner,
      kind: source.kind,
      active: source.active,
      priority: source.priority,
      storage: source.storage,
      attribute_count: source.fields.length,
      accepted_mappings: source.mappings.filter((m) => m.accepted).length,
      endpoints: {
        schema: `${base}${source.api_base}/schema`,
        items: `${base}${source.api_base}/items`,
        item: `${base}${source.api_base}/item/{medicine_id}`,
      },
    })),
  });
}

async function schemasResponse(ctx: ActionCtx, sourceId: string): Promise<ApiResponse> {
  const sources = (await ctx.runQuery(internal.registry.internalListSources, {})) as SourceDescriptorRow[];
  const source = sources.find((s) => s.source_id === sourceId);
  if (!source) {
    return json(404, {
      api_version: API_VERSION,
      error: "unknown_source",
      message: `no source system registered with id "${sourceId}"`,
      available: sources.map((s) => s.source_id),
    });
  }
  const counts = await ctx.runQuery(internal.sources.readers.listSourceRows, {
    source_id: sourceId,
  });
  return json(200, {
    api_version: API_VERSION,
    source: {
      source_id: source.source_id,
      display_name: source.display_name,
      owner: source.owner,
      kind: source.kind,
      description: source.description,
      storage: source.storage,
      active: source.active,
      registry_priority: source.priority,
    },
    schema: {
      attribute_count: source.fields.length,
      attributes: source.fields.map((field) => ({
        name: field.name,
        datatype: field.datatype,
        nullable: field.nullable,
        sample_values: field.samples.slice(0, 4),
      })),
    },
    identity: {
      lookup_field: identityField(source),
      accepted_mappings: source.mappings
        .filter((m) => m.accepted)
        .map((m) => `${m.source_field} -> ${m.canonical_field} (${m.score.toFixed(2)})`),
    },
    record_count: counts?.total ?? 0,
  });
}

async function itemsResponse(
  ctx: ActionCtx,
  sourceId: string,
  search: URLSearchParams,
): Promise<ApiResponse> {
  const rawLimit = Number(search.get("limit") ?? "10");
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 10;
  const result = await ctx.runQuery(internal.sources.readers.listSourceRows, {
    source_id: sourceId,
    limit,
  });
  if (!result) {
    return json(404, {
      api_version: API_VERSION,
      error: "unknown_source",
      message: `no source system registered with id "${sourceId}"`,
    });
  }
  return json(200, {
    api_version: API_VERSION,
    source_id: result.source_id,
    storage: result.storage,
    total_records: result.total,
    returned: result.rows.length,
    limit,
    records: result.rows,
  });
}

async function itemResponse(
  ctx: ActionCtx,
  sourceId: string,
  key: string,
  requestUrl: string,
): Promise<ApiResponse> {
  const started = Date.now();
  const sources = (await ctx.runQuery(internal.registry.internalListSources, {})) as SourceDescriptorRow[];
  const source = sources.find((s) => s.source_id === sourceId);
  if (!source) {
    return json(404, {
      api_version: API_VERSION,
      error: "unknown_source",
      message: `no source system registered with id "${sourceId}"`,
      available: sources.map((s) => s.source_id),
    });
  }
  if (!key) {
    return json(400, {
      api_version: API_VERSION,
      error: "missing_key",
      message: "include the item key in the path, e.g. /api/sources/manufacturer/item/MED-10482",
    });
  }

  const field = identityField(source);
  const result = await ctx.runQuery(internal.sources.readers.resolveSourceRecord, {
    source_id: sourceId,
    field,
    value: key,
  });
  const elapsed = Date.now() - started;

  if (result.rows.length === 0) {
    return json(404, {
      api_version: API_VERSION,
      source: { source_id: source.source_id, display_name: source.display_name },
      query: {
        endpoint: requestUrl,
        lookup_field: field,
        lookup_value: key,
        lookup_normalized: normaliseIdentifier(key),
        strategy: "miss",
      },
      record_count: 0,
      records: [],
      message: `no record for ${key} in source ${sourceId}`,
    });
  }

  return json(200, {
    api_version: API_VERSION,
    source: {
      source_id: source.source_id,
      display_name: source.display_name,
      owner: source.owner,
      kind: source.kind,
      active: source.active,
    },
    query: {
      endpoint: requestUrl,
      lookup_field: field,
      lookup_value: key,
      lookup_normalized: normaliseIdentifier(key),
      strategy: result.strategy,
      handled_in_ms: elapsed,
    },
    record_count: result.rows.length,
    records: (result.rows as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      // The source also reports how it interpreted its own identifier column.
      __lookup: {
        field,
        raw: String(row[field] ?? ""),
        normalised: normaliseValue("medicine_id", row[field]),
        strategy: result.strategy,
      },
    })),
  });
}

/**
 * Router for everything under /api/sources.
 * `segments` are the path parts after "/api/sources".
 */
export async function handleSourceApiRequest(
  ctx: ActionCtx,
  segments: string[],
  search: URLSearchParams,
  requestUrl: string,
): Promise<ApiResponse> {
  const [sourceId, resource, ...rest] = segments;
  if (!sourceId) return sourceIndexResponse(ctx, requestUrl);
  if (!resource || resource === "schema" || resource === "meta") {
    return schemasResponse(ctx, sourceId);
  }
  if (resource === "items") return itemsResponse(ctx, sourceId, search);
  if (resource === "item") return itemResponse(ctx, sourceId, rest.join("/"), requestUrl);
  return json(404, {
    api_version: API_VERSION,
    error: "unknown_resource",
    message: `unknown resource "${resource}" for source "${sourceId}"`,
    supported: ["schema", "items", "item/<key>"],
  });
}

/** Router for the whole /api surface (source APIs + health). */
export async function handleApiRequest(
  ctx: ActionCtx,
  pathname: string,
  search: URLSearchParams,
  requestUrl: string,
): Promise<ApiResponse> {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "api") {
    return json(404, {
      api_version: API_VERSION,
      error: "not_found",
      message: "MEDTRUST API surface lives under /api",
    });
  }
  if (segments.length === 1 || segments[1] === "health") {
    return healthResponse(ctx);
  }
  if (segments[1] === "sources") {
    return handleSourceApiRequest(ctx, segments.slice(2), search, requestUrl);
  }
  return json(404, {
    api_version: API_VERSION,
    error: "not_found",
    message: `no route for ${pathname}`,
    routes: ["/api/health", "/api/sources", "/api/sources/<id>/schema", "/api/sources/<id>/items", "/api/sources/<id>/item/<key>"],
  });
}
