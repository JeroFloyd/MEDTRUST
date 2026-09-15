/**
 * Client-side view types + display helpers.
 *
 * The heavy lifting (schema matching, mediation, provenance) happens in Convex;
 * this module only mirrors the shapes the GUI renders and keeps status wording
 * consistent in one place.
 */

import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

export type VerifyResult = FunctionReturnType<typeof api.verify.verifyMedicine>;
export type IntegratedField = VerifyResult["fields"][number];
export type SourceResponse = VerifyResult["sources"][number];
export type TraceStep = VerifyResult["trace"]["steps"][number];
export type SourceRecord = FunctionReturnType<typeof api.registry.listSources>[number];
export type CanonicalField = FunctionReturnType<typeof api.registry.canonicalSchema>[number];
export type MappingProposal = NonNullable<FunctionReturnType<typeof api.registry.proposal>>;
export type ProposalField = MappingProposal["report"]["fields"][number];
export type CandidateScore = ProposalField["candidates"][number];
export type RunSummary = FunctionReturnType<typeof api.runs.history>[number];
export type Stats = FunctionReturnType<typeof api.registry.stats>;

export type RunStatus = "verified" | "suspicious" | "partial" | "not_found";

export interface StatusMeta {
  label: string;
  short: string;
  tone: "positive" | "warning" | "critical" | "neutral";
  description: string;
}

export const STATUS_META: Record<RunStatus, StatusMeta> = {
  verified: {
    label: "Verified across available demo sources",
    short: "Verified",
    tone: "positive",
    description: "All queried demo sources returned a matching record and no open complaint was found.",
  },
  suspicious: {
    label: "Potentially suspicious",
    short: "Flagged",
    tone: "critical",
    description: "An open counterfeit / quality complaint exists for this product in the demo register.",
  },
  partial: {
    label: "Partially covered",
    short: "Partial",
    tone: "warning",
    description: "Some demo sources hold a record for this product, others have none.",
  },
  not_found: {
    label: "No record found",
    short: "Not found",
    tone: "neutral",
    description: "No queried source API returned a record for this identifier.",
  },
};

export function statusMeta(code: string): StatusMeta {
  return STATUS_META[code as RunStatus] ?? STATUS_META.not_found;
}

export const TONE_CLASSES: Record<StatusMeta["tone"], string> = {
  positive: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning-foreground",
  critical: "border-destructive/30 bg-destructive/10 text-destructive",
  neutral: "border-border bg-muted text-muted-foreground",
};

export const AGREEMENT_LABEL: Record<string, string> = {
  consistent: "Corroborated by multiple sources",
  single_source: "From a single source",
  conflict: "Sources disagree — resolved by priority",
  derived_absent: "Inferred from the absence of a complaint row",
  absent: "Not available in any source",
};

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Which case does this identifier correspond to (for the demo chips). */
export const DEMO_CASE_IDS = ["MED-10482", "MED-10233", "MED-10875", "MED-10590", "MED-10027"];

export function parseStoredResult(raw: unknown): VerifyResult | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as VerifyResult;
  if (!Array.isArray(candidate.fields) || !candidate.status) return null;
  return candidate;
}
