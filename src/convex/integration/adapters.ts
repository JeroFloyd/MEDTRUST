/**
 * SOURCE ADAPTERS
 * ---------------------------------------------------------------------------
 * The mediator never reads a source table. It speaks to each source through its
 * API. Two transports are supported, and the trace always records which one was
 * used:
 *
 *   http        real HTTP GET against <deployment>/api/sources/...
 *               (the site URL is taken from the Convex deployment environment,
 *                or from the browser origin when the deployment env is silent)
 *   in-process  the identical handler invoked inside the action; used only when
 *               the deployment cannot reach its own HTTP surface. The payload is
 *               produced by the same code path, so responses stay comparable.
 */

import type { ActionCtx } from "../_generated/server";
import { handleSourceApiRequest, type ApiResponse } from "../sources/api";

const TIMEOUT_MS = 5000;

export interface TransportAttempt {
  base: string;
  error: string;
}

export interface SourceCallLog {
  source_id: string;
  display_name: string;
  path: string;
  url: string | null;
  transport: "http" | "in-process";
  base: string | null;
  base_origin: string;
  status: number;
  ok: boolean;
  latency_ms: number;
  bytes: number;
  attempts: TransportAttempt[];
  payload: unknown;
  error: string | null;
}

let preferredBase: string | null = null;

function cleanBase(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

/**
 * Site URL candidates, most trustworthy first. `override` comes from the
 * browser (the Vite client knows VITE_CONVEX_URL and can derive the .convex.site
 * origin) and is validated before use.
 */
export function candidateBases(override?: string | null): Array<{ base: string; origin: string }> {
  const candidates: Array<{ base: string; origin: string }> = [];
  const push = (base: string | undefined, origin: string) => {
    if (!base) return;
    const cleaned = cleanBase(base);
    if (!/^https?:\/\//.test(cleaned)) return;
    if (candidates.some((c) => c.base === cleaned)) return;
    candidates.push({ base: cleaned, origin });
  };

  if (preferredBase) push(preferredBase, "cached from a previous successful call");
  push(override ?? undefined, "supplied by the client (derived from VITE_CONVEX_URL)");
  push(process.env.CONVEX_SITE_URL, "CONVEX_SITE_URL deployment variable");
  if (process.env.CONVEX_CLOUD_URL) {
    push(process.env.CONVEX_CLOUD_URL.replace(/\.convex\.cloud/, ".convex.site"), "derived from CONVEX_CLOUD_URL");
  }
  if (process.env.SITE_URL && cleanBase(process.env.SITE_URL).includes(".convex.site")) {
    push(process.env.SITE_URL, "SITE_URL deployment variable");
  }
  return candidates;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)),
  ]);
}

export interface CallSourceArgs {
  source_id: string;
  display_name: string;
  segments: string[];
  search: URLSearchParams;
  site_base?: string | null;
}

/** Call one source API and normalise both transports into one log record. */
export async function callSourceApi(ctx: ActionCtx, args: CallSourceArgs): Promise<SourceCallLog> {
  const path = `/api/sources/${args.segments.map(encodeURIComponent).join("/")}`;
  const search = args.search.toString();
  const query = search ? `?${search}` : "";
  const attempts: TransportAttempt[] = [];
  const candidates = candidateBases(args.site_base ?? null);

  for (const candidate of candidates) {
    const url = `${candidate.base}${path}${query}`;
    const started = Date.now();
    try {
      const response = await withTimeout(
        fetch(url, { method: "GET", headers: { accept: "application/json" } }),
        TIMEOUT_MS,
      );
      const text = await response.text();
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        attempts.push({ base: candidate.base, error: "response was not valid JSON" });
        continue;
      }
      preferredBase = candidate.base;
      const latency = Date.now() - started;
      return {
        source_id: args.source_id,
        display_name: args.display_name,
        path,
        url,
        transport: "http",
        base: candidate.base,
        base_origin: candidate.origin,
        status: response.status,
        ok: response.status < 500,
        latency_ms: latency,
        bytes: text.length,
        attempts,
        payload,
        error: response.status >= 500 ? `source API returned ${response.status}` : null,
      };
    } catch (error) {
      attempts.push({
        base: candidate.base,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (candidates.length === 0) {
    attempts.push({
      base: "(none)",
      error: "no site URL available in the deployment environment",
    });
  }

  // Fallback: identical handler, in-process transport.
  const started = Date.now();
  let result: ApiResponse;
  try {
    result = await handleSourceApiRequest(ctx, args.segments, args.search, path);
  } catch (error) {
    result = {
      status: 503,
      body: {
        error: "source_unavailable",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
  const payload = result.body;
  const bytes = JSON.stringify(payload ?? null).length;

  return {
    source_id: args.source_id,
    display_name: args.display_name,
    path,
    url: null,
    transport: "in-process",
    base: null,
    base_origin: "same handler as the HTTP route, invoked in-process",
    status: result.status,
    ok: result.status < 500,
    latency_ms: Date.now() - started,
    bytes,
    attempts,
    payload,
    error: result.status >= 500 ? `source API returned ${result.status}` : null,
  };
}
