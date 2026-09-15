/**
 * AUTOMATIC SCHEMA MAPPING (Project A innovation)
 * ---------------------------------------------------------------------------
 * The matcher compares one source attribute against every canonical field and
 * produces a transparent, deterministic score:
 *
 *   score = 0.50 · name similarity
 *         + 0.20 · datatype compatibility
 *         + 0.30 · sample-value compatibility
 *
 * It is deliberately rule based (no LLM, no training data): every number in the
 * score breakdown can be explained to a TA in one sentence, and the matcher is
 * allowed to say "no confident candidate" so that a human can map the column
 * manually. That is what keeps low-effort source onboarding realistic instead of
 * claiming universal automatic integration.
 */

import {
  CANONICAL_FIELDS,
  CONCEPT_GROUPS,
  compact,
  normaliseValue,
  parseFlexibleDate,
  parseNumber,
  type CanonicalFieldDef,
  type Datatype,
} from "./canonical";

export const WEIGHTS = { name: 0.5, datatype: 0.2, sample: 0.3 } as const;

/** Confidence thresholds used to decide matched / ambiguous / unmatched. */
export const THRESHOLDS = { accept: 0.65, ambiguity_margin: 0.08 } as const;

export interface SourceFieldDescriptor {
  name: string;
  datatype: Datatype;
  samples: string[];
  nullable: boolean;
}

/** canonical field id -> representative raw values observed in the sources */
export type KnownValues = Record<string, string[]>;

export interface CandidateScore {
  canonical_field: string;
  canonical_label: string;
  canonical_datatype: Datatype;
  score: number;
  name_score: number;
  datatype_score: number;
  sample_score: number;
  reasoning: string;
  warnings: string[];
}

export interface FieldProposal {
  source_field: SourceFieldDescriptor;
  candidates: CandidateScore[];
  recommended: CandidateScore | null;
  status: "matched" | "ambiguous" | "unmatched";
  margin: number;
}

export interface SchemaMatchReport {
  fields: FieldProposal[];
  warnings: string[];
  summary: {
    fields: number;
    matched: number;
    ambiguous: number;
    unmatched: number;
    identity_field: string | null;
    required_missing: string[];
  };
}

/* -------------------------------------------------------------------------- */
/* Datatype inference (the "profiler" half of schema profiling)                */
/* -------------------------------------------------------------------------- */

export function inferDatatype(values: string[]): Datatype {
  const clean = values.map((v) => String(v ?? "").trim()).filter(Boolean);
  if (clean.length === 0) return "text";

  const dates = clean.filter((v) => parseFlexibleDate(v) !== null).length;
  if (dates === clean.length) return "date";

  const numerics = clean.filter((v) => {
    const n = parseNumber(v);
    return n !== null && /^[^A-Za-z]+$/.test(v.trim());
  }).length;
  if (numerics === clean.length) return "number";

  const identifiers = clean.filter(
    (v) => v.length >= 4 && v.length <= 32 && /[0-9]/.test(v) && !/\s{2,}/.test(v) && /^[A-Za-z0-9\-_/.]+$/.test(v),
  ).length;
  if (identifiers === clean.length) return "identifier";

  return "text";
}

export function inferFieldDescriptor(name: string, values: unknown[]): SourceFieldDescriptor {
  const strings = values
    .map((v) => (v === null || v === undefined ? "" : String(v)))
    .map((v) => v.trim());
  const samples = Array.from(new Set(strings.filter(Boolean))).slice(0, 8).map((v) => v.slice(0, 48));
  return {
    name,
    datatype: inferDatatype(samples),
    samples,
    nullable: strings.some((v) => v === ""),
  };
}

/* -------------------------------------------------------------------------- */
/* Component 1 — attribute name similarity                                     */
/* -------------------------------------------------------------------------- */

const GENERIC_ALIASES = new Set([
  "id", "code", "item", "name", "medicine", "drug", "product", "status", "batch",
  "lot", "exp", "received", "value", "amount", "sp", "mrp", "mfg", "desc", "no",
  "num", "ref", "key", "title",
]);

const GROUP_MEMBERS: Array<{ group: string; member: string }> = Object.entries(
  CONCEPT_GROUPS,
).flatMap(([group, members]) => members.map((member) => ({ group, member })));

function tokensOf(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function conceptTokens(name: string): Set<string> {
  const result = new Set<string>();
  const tokens = tokensOf(name);
  for (const token of tokens) {
    result.add(token);
    result.add(token.replace(/s$/, ""));
    for (const { group, member } of GROUP_MEMBERS) {
      if (token === member) result.add(group);
      else if (member.length >= 3 && token.includes(member)) result.add(group);
      else if (token.length >= 3 && member.includes(token)) result.add(group);
    }
  }
  return result;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i += 1) {
    const current = [i];
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(prev[j] + 1, current[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = current;
  }
  return prev[n];
}

function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

export function nameSimilarity(
  sourceField: string,
  def: CanonicalFieldDef,
): { score: number; note: string } {
  const sNorm = compact(sourceField);
  const aliases = new Set(def.aliases.map((a) => compact(a)));

  if (aliases.has(sNorm)) {
    if (GENERIC_ALIASES.has(sNorm)) {
      return {
        score: 0.78,
        note: `"${sourceField}" is a registered but generic synonym of ${def.label} — plausible, not certain`,
      };
    }
    return { score: 0.9, note: `"${sourceField}" is a registered synonym of ${def.label}` };
  }

  for (const alias of aliases) {
    if (alias.length >= 4 && sNorm.includes(alias)) {
      return {
        score: 0.7,
        note: `"${sourceField}" contains the known synonym "${alias}" of ${def.label}`,
      };
    }
  }

  const tokenScore = jaccard(conceptTokens(sourceField), conceptTokens(def.id));
  const stringScore = stringSimilarity(sNorm, compact(def.id));
  const score = round2(0.7 * tokenScore + 0.3 * stringScore);
  return {
    score,
    note:
      `no registered synonym for "${sourceField}"; concept-token overlap ${tokenScore.toFixed(2)}, ` +
      `string similarity to "${def.id}" ${stringScore.toFixed(2)}`,
  };
}

/* -------------------------------------------------------------------------- */
/* Component 2 — datatype compatibility                                        */
/* -------------------------------------------------------------------------- */

const DATATYPE_COMPATIBILITY: Record<Datatype, Record<Datatype, number>> = {
  identifier: { identifier: 1, text: 0.85, number: 0.6, date: 0.2 },
  text: { text: 1, identifier: 0.85, number: 0.55, date: 0.5 },
  date: { date: 1, text: 0.8, identifier: 0.4, number: 0.2 },
  number: { number: 1, text: 0.8, identifier: 0.6, date: 0.2 },
};

export function datatypeCompatibility(source: Datatype, canonical: Datatype): number {
  return DATATYPE_COMPATIBILITY[source]?.[canonical] ?? 0.2;
}

/* -------------------------------------------------------------------------- */
/* Component 3 — sample value compatibility                                    */
/* -------------------------------------------------------------------------- */

function sampleCompatibility(
  samples: string[],
  def: CanonicalFieldDef,
  known: string[],
): { score: number; note: string } {
  const clean = samples.filter((s) => s !== "");
  if (clean.length === 0) {
    return { score: 0.3, note: "no sample values available (datatype inferred only)" };
  }
  const knownSet = new Set(known.map((v) => normaliseValue(def.id, v)));
  const hits = clean.filter((v) => knownSet.has(normaliseValue(def.id, v))).length;
  const knownFraction = hits / clean.length;

  if (def.datatype === "date") {
    const parsed = clean.filter((v) => parseFlexibleDate(v) !== null).length;
    const isoForm = clean.filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v.trim())).length;
    const score = round2(0.75 * (parsed / clean.length) + 0.15 * (isoForm / clean.length) + 0.1 * knownFraction);
    return {
      score,
      note: `${parsed}/${clean.length} sample values parse as calendar dates (${isoForm} in ISO form)`,
    };
  }

  if (def.datatype === "number") {
    const numeric = clean.filter((v) => parseNumber(v) !== null && /^[^A-Za-z]+$/.test(v.trim())).length;
    return {
      score: round2(0.9 * (numeric / clean.length) + 0.1 * knownFraction),
      note: `${numeric}/${clean.length} sample values are numeric with a compatible magnitude`,
    };
  }

  if (def.datatype === "identifier") {
    if (def.pattern) {
      const re = new RegExp(def.pattern);
      const matching = clean.filter((v) => re.test(v.trim())).length;
      const score = round2(0.55 * (matching / clean.length) + 0.45 * knownFraction);
      return {
        score,
        note:
          `${matching}/${clean.length} samples match the expected format ${def.pattern} and ` +
          `${hits}/${clean.length} appear in the canonical value set`,
      };
    }
    return {
      score: round2(knownFraction),
      note: `${hits}/${clean.length} sample values appear in the canonical value set`,
    };
  }

  // free text
  if (knownFraction > 0) {
    return {
      score: round2(0.85 * knownFraction + 0.15),
      note: `${hits}/${clean.length} sample values overlap the canonical value set for ${def.label}`,
    };
  }
  return {
    score: 0.3,
    note: "free-text samples provide no discriminating evidence (any text matches any text field)",
  };
}

/* -------------------------------------------------------------------------- */
/* Scoring + proposal generation                                               */
/* -------------------------------------------------------------------------- */

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function scoreCandidate(
  field: SourceFieldDescriptor,
  def: CanonicalFieldDef,
  known: KnownValues,
): CandidateScore {
  const name = nameSimilarity(field.name, def);
  const datatype = datatypeCompatibility(field.datatype, def.datatype);
  const sample = sampleCompatibility(field.samples, def, known[def.id] ?? []);
  const score = round2(
    WEIGHTS.name * name.score + WEIGHTS.datatype * datatype + WEIGHTS.sample * sample.score,
  );

  const warnings: string[] = [];
  if (datatype <= 0.5) {
    warnings.push(
      `datatype conflict: source column profiled as ${field.datatype}, canonical field is ${def.datatype}`,
    );
  }
  if (field.nullable) warnings.push("column contains empty values (nullable at source)");

  const reasoning =
    `Name: ${name.note} (${name.score.toFixed(2)}). ` +
    `Datatype: ${field.datatype} ↔ ${def.datatype} (${datatype.toFixed(2)}). ` +
    `Samples: ${sample.note} (${sample.score.toFixed(2)}). ` +
    `Weighted: 0.50·${name.score.toFixed(2)} + 0.20·${datatype.toFixed(2)} + 0.30·${sample.score.toFixed(2)} = ${score.toFixed(2)}`;

  return {
    canonical_field: def.id,
    canonical_label: def.label,
    canonical_datatype: def.datatype,
    score,
    name_score: name.score,
    datatype_score: datatype,
    sample_score: sample.score,
    reasoning,
    warnings,
  };
}

export function proposeMappings(
  fields: SourceFieldDescriptor[],
  known: KnownValues,
): SchemaMatchReport {
  const proposals: FieldProposal[] = fields.map((field) => {
    const candidates = CANONICAL_FIELDS.map((def) => scoreCandidate(field, def, known)).sort(
      (a, b) => b.score - a.score || a.canonical_field.localeCompare(b.canonical_field),
    );
    const best = candidates[0] ?? null;
    const second = candidates[1] ?? null;
    const margin = best && second ? round2(best.score - second.score) : 0;
    let status: FieldProposal["status"] = "unmatched";
    if (best && best.score >= THRESHOLDS.accept) {
      status = second && margin < THRESHOLDS.ambiguity_margin ? "ambiguous" : "matched";
    }
    return { source_field: field, candidates: candidates.slice(0, 3), recommended: best, status, margin };
  });

  const warnings: string[] = [];
  const targets = new Map<string, string[]>();
  for (const proposal of proposals) {
    if (!proposal.recommended || proposal.status === "unmatched") continue;
    const list = targets.get(proposal.recommended.canonical_field) ?? [];
    list.push(proposal.source_field.name);
    targets.set(proposal.recommended.canonical_field, list);
  }
  for (const [canonical, sources] of targets) {
    if (sources.length > 1) {
      warnings.push(
        `multiple source columns map to ${canonical}: ${sources.join(", ")} — the mediator keeps both and resolves the conflict by source priority`,
      );
    }
  }
  for (const proposal of proposals) {
    if (proposal.status === "unmatched") {
      warnings.push(
        `no confident candidate for "${proposal.source_field.name}" (best score ${proposal.recommended?.score.toFixed(2) ?? "0.00"} < ${THRESHOLDS.accept}) — manual mapping required`,
      );
    } else if (proposal.status === "ambiguous") {
      warnings.push(
        `ambiguous mapping for "${proposal.source_field.name}": ${proposal.recommended?.canonical_field} vs ${proposal.candidates[1]?.canonical_field} within ${proposal.margin}`,
      );
    }
  }

  const identity = proposals.find(
    (p) => p.recommended?.canonical_field === "medicine_id" && p.status !== "unmatched",
  );
  const requiredMissing: string[] = [];
  const allProposals = [...proposals];
  const covered = new Set(
    allProposals
      .filter((p) => p.status !== "unmatched" && p.recommended)
      .map((p) => p.recommended?.canonical_field as string),
  );
  for (const required of ["medicine_id", "medicine_name"]) {
    if (!covered.has(required)) requiredMissing.push(required);
  }
  if (!identity) {
    warnings.push(
      "identity column not detected: without a mapping to Medicine ID the mediator cannot join this source",
    );
  }

  const matched = proposals.filter((p) => p.status === "matched").length;
  const ambiguous = proposals.filter((p) => p.status === "ambiguous").length;

  return {
    fields: proposals,
    warnings,
    summary: {
      fields: proposals.length,
      matched,
      ambiguous,
      unmatched: proposals.length - matched - ambiguous,
      identity_field: identity?.source_field.name ?? null,
      required_missing: requiredMissing,
    },
  };
}
