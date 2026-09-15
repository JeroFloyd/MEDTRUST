import { AppShell } from "@/components/AppShell";
import { Chip, JsonView, Mono, Panel, Pill, ScoreBar } from "@/components/medtrust/primitives";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Check, Loader2, RefreshCw, Rocket, RotateCcw, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

const SAMPLE_SOURCE = `[
  { "sku": "MED-10482", "drug_name": "Paracetamol 500 mg", "maker": "Kaveri Pharma Limited", "lot": "B1042" },
  { "sku": "11MED-10233", "drug_name": "Azithromycin 250mg", "maker": "Sunveda Biotech", "lot": "LOT-1088" },
  { "sku": "MED-10875", "drug_name": "Amoxicillin 500mg", "maker": "Aravalli Life Sciences", "lot": "B1246" },
  { "sku": "MED-10590", "drug_name": "Metformin 500 mg", "maker": "Trident Healthcare", "lot": "B1152" }
]`;

function columnsFromJson(text: string): { name: string; samples: string[] }[] {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("records must be a JSON array of objects");
  const columns = new Map<string, string[]>();
  for (const row of parsed) {
    if (typeof row !== "object" || row === null) continue;
    for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
      const bucket = columns.get(key) ?? [];
      if (bucket.length < 8) bucket.push(String(value));
      columns.set(key, bucket);
    }
  }
  if (columns.size === 0) throw new Error("no attributes found in the pasted records");
  return Array.from(columns.entries()).map(([name, samples]) => ({ name, samples }));
}

export default function Onboarding() {
  const sources = useQuery(api.registry.listSources);
  const canonical = useQuery(api.registry.canonicalSchema);
  const pending = (sources ?? []).filter((source) => !source.active);

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <Panel
          eyebrow="Innovation · Rubric 2"
          title="Automatic schema mapping and low-effort source onboarding"
          description="A new source arrives with attribute names nobody modelled in advance. The profiler infers each column's datatype from its values, the matcher scores every column against the canonical schema, and an integrator confirms the proposals. Only after a mapping is accepted can the mediator query the source."
        >
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3.5">
              <p className="text-xs font-semibold tracking-tight text-foreground">1 · Profile</p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                Columns are profiled from real sample values: date parsing, numeric detection, identifier shape and
                nullability.
              </p>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3.5">
              <p className="text-xs font-semibold tracking-tight text-foreground">2 · Score candidates</p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                0.50 name similarity + 0.20 datatype compatibility + 0.30 sample-value evidence, with the breakdown
                shown for every proposal.
              </p>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3.5">
              <p className="text-xs font-semibold tracking-tight text-foreground">3 · Human confirms</p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                Accept, reject or override — including the honest case where a column has no confident candidate and
                stays out of the integration.
              </p>
            </div>
          </div>
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] leading-5 text-warning-foreground">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            Deliberately not claimed: the system cannot understand arbitrary databases. It proposes candidates from
            names, datatypes and sample values, and relies on confirmation for the rest.
          </p>
        </Panel>

        {pending.length === 0 && (
          <Panel eyebrow="Onboarding" title="No pending sources">
            <p className="text-sm text-muted-foreground">
              Every registered source has been onboarded. Reset onboarding below to replay the demo.
            </p>
          </Panel>
        )}

        {pending.map((source) => (
          <PendingSourceCard key={source.source_id} sourceId={source.source_id} displayName={source.display_name} />
        ))}

        <RegisterSourcePanel />

        {canonical && (
          <Panel
            eyebrow="Reference"
            title="Canonical fields a column can be mapped onto"
            description="The same vocabulary the matcher scores against."
          >
            <div className="flex flex-wrap gap-1.5">
              {canonical.map((field) => (
                <Chip key={field.id} className="border-primary/25 bg-primary/10 text-primary">
                  {field.id}
                </Chip>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Pending (un-onboarded) source card                                          */
/* -------------------------------------------------------------------------- */

function PendingSourceCard({ sourceId, displayName }: { sourceId: string; displayName: string }) {
  const proposal = useQuery(api.registry.proposal, { source_id: sourceId });
  const canonical = useQuery(api.registry.canonicalSchema);
  const acceptMapping = useMutation(api.registry.acceptMapping);
  const rejectMapping = useMutation(api.registry.rejectMapping);
  const acceptAll = useMutation(api.registry.acceptAllProposals);
  const rerun = useMutation(api.registry.rerunMatcher);
  const reset = useMutation(api.registry.resetOnboarding);
  const complete = useMutation(api.registry.completeOnboarding);
  const [busy, setBusy] = useState<string | null>(null);
  const [manualTarget, setManualTarget] = useState<Record<string, string>>({});

  if (!proposal) {
    return (
      <Panel dense>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading {displayName} schema…
        </div>
      </Panel>
    );
  }

  const { report } = proposal;
  const identityAccepted = proposal.stored_mappings.some(
    (mapping) => mapping.accepted && mapping.canonical_field === "medicine_id",
  );

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel
      eyebrow="Pending source"
      title={`${displayName} — schema profiled, awaiting acceptance`}
      description={`${proposal.row_count} records · ${proposal.fields.length} attributes · ${report.summary.matched} confident, ${report.summary.ambiguous} ambiguous, ${report.summary.unmatched} without a candidate.`}
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone={identityAccepted ? "positive" : "warning"}>
            identity mapping {identityAccepted ? "accepted" : "missing"}
          </Pill>
          <button
            type="button"
            onClick={() => void run("rerun", () => rerun({ source_id: sourceId }), "Matcher re-run on live data")}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium transition-colors hover:bg-accent"
          >
            {busy === "rerun" ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
            Re-run matcher
          </button>
          <button
            type="button"
            onClick={() =>
              void run("acceptAll", () => acceptAll({ source_id: sourceId }), "All confident proposals accepted")
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium transition-colors hover:bg-accent"
          >
            {busy === "acceptAll" ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
            Accept confident proposals
          </button>
          <button
            type="button"
            onClick={() => void run("reset", () => reset({ source_id: sourceId }), "Onboarding reset")}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium transition-colors hover:bg-accent"
          >
            {busy === "reset" ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
            Reset
          </button>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Incoming schema as delivered
          </p>
          <div className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/70">
            {proposal.fields.map((field) => (
              <div key={field.name} className="px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip>{field.name}</Chip>
                  <Pill>{field.datatype}</Pill>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {field.samples.slice(0, 3).map((sample, index) => (
                    <span
                      key={`${field.name}-${index}`}
                      className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground"
                    >
                      {sample.length > 26 ? `${sample.slice(0, 26)}…` : sample}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Sample record
            </p>
            <JsonView value={proposal.fields.reduce<Record<string, string>>((acc, field) => {
              acc[field.name] = field.samples[0] ?? "";
              return acc;
            }, {})} maxHeight="10rem" />
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Matcher proposals with score breakdown
          </p>
          <div className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/70">
            {proposal.report.fields.map((field) => {
              const stored = proposal.stored_mappings.find((m) => m.source_field === field.source_field.name);
              const top = field.recommended;
              const alternatives = field.candidates.slice(1);
              return (
                <div key={field.source_field.name} className="px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip>{field.source_field.name}</Chip>
                    <span className="text-xs text-muted-foreground">→</span>
                    {top ? (
                      <>
                        <Chip className="border-primary/25 bg-primary/10 text-primary">
                          {top.canonical_field}
                        </Chip>
                        <ScoreBar score={top.score} />
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">no candidate</span>
                    )}
                    <Pill
                      tone={
                        field.status === "matched" ? "positive" : field.status === "ambiguous" ? "warning" : "critical"
                      }
                    >
                      {field.status}
                    </Pill>
                    {stored?.accepted && stored.canonical_field ? (
                      <Pill tone="positive">
                        <Check className="size-3" />
                        accepted · {stored.canonical_field}
                      </Pill>
                    ) : (
                      <Pill>not accepted</Pill>
                    )}
                  </div>

                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                    <Mono className="text-muted-foreground">name {top?.name_score.toFixed(2) ?? "—"}</Mono>
                    <Mono className="text-muted-foreground">datatype {top?.datatype_score.toFixed(2) ?? "—"}</Mono>
                    <Mono className="text-muted-foreground">samples {top?.sample_score.toFixed(2) ?? "—"}</Mono>
                    {field.margin > 0 && <Mono className="text-muted-foreground">margin {field.margin.toFixed(2)}</Mono>}
                  </div>

                  {top && (
                    <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">{top.reasoning}</p>
                  )}

                  {alternatives.length > 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      runners-up:{" "}
                      {alternatives
                        .map((candidate) => `${candidate.canonical_field} ${candidate.score.toFixed(2)}`)
                        .join(" · ")}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {top && (
                      <button
                        type="button"
                        onClick={() =>
                          void run(
                            `accept-${field.source_field.name}`,
                            () =>
                              acceptMapping({
                                source_id: sourceId,
                                source_field: field.source_field.name,
                                canonical_field: top.canonical_field,
                              }),
                            `Mapped ${field.source_field.name} → ${top.canonical_field}`,
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15"
                      >
                        {busy === `accept-${field.source_field.name}` ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Check className="size-3" />
                        )}
                        Accept {top.canonical_field}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        void run(
                          `reject-${field.source_field.name}`,
                          () => rejectMapping({ source_id: sourceId, source_field: field.source_field.name }),
                          `${field.source_field.name} kept out of the integration`,
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent"
                    >
                      <X className="size-3" />
                      Keep unmapped
                    </button>
                    <select
                      value={manualTarget[field.source_field.name] ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        setManualTarget((prev) => ({ ...prev, [field.source_field.name]: value }));
                        if (!value) return;
                        void run(
                          `manual-${field.source_field.name}`,
                          () =>
                            acceptMapping({
                              source_id: sourceId,
                              source_field: field.source_field.name,
                              canonical_field: value,
                            }),
                          `Manually mapped ${field.source_field.name} → ${value}`,
                        );
                      }}
                      className="h-7 rounded-md border border-input bg-background px-2 text-[11px] text-foreground outline-none focus-visible:border-ring"
                    >
                      <option value="">manual map…</option>
                      {(canonical ?? []).map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.id}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>

          {report.warnings.length > 0 && (
            <div className="mt-3 rounded-lg border border-border/70 bg-muted/30 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Matcher notes
              </p>
              <ul className="mt-1.5 space-y-1 text-[11px] leading-5 text-muted-foreground">
                {report.warnings.map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 rounded-lg border border-border/70 bg-card p-3.5">
            <p className="text-xs font-semibold tracking-tight text-foreground">Activate for the mediator</p>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              Once the identity column is accepted, the source joins the query plan. Verify a product afterwards and
              the trace will show {proposal.fields.length} mapped attributes coming from this source.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!identityAccepted || busy === "complete"}
                onClick={() =>
                  void run("complete", () => complete({ source_id: sourceId }), `${displayName} onboarded`)
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-opacity",
                  identityAccepted
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "cursor-not-allowed border border-border text-muted-foreground opacity-70",
                )}
              >
                {busy === "complete" ? <Loader2 className="size-3 animate-spin" /> : <Rocket className="size-3" />}
                Onboard source
              </button>
              <Link
                to="/verify?id=MED-10482"
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-accent"
              >
                Verify MED-10482 with the new source
              </Link>
            </div>
            {!identityAccepted && (
              <p className="mt-2 text-[11px] text-warning-foreground">
                Accept a mapping for the identity column first — the mediator cannot join records without it.
              </p>
            )}
          </div>

        </div>
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Register an additional source with a pasted schema + records                */
/* -------------------------------------------------------------------------- */

function RegisterSourcePanel() {
  const [name, setName] = useState("Aushadhi Partner Feed");
  const [records, setRecords] = useState(SAMPLE_SOURCE);
  const [previewFields, setPreviewFields] = useState<{ name: string; samples: string[] }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const preview = useQuery(
    api.registry.previewSchema,
    previewFields && previewFields.length > 0 ? { fields: previewFields } : "skip",
  );
  const register = useMutation(api.registry.registerDynamicSource);

  const columns = useMemo(() => {
    try {
      return columnsFromJson(records);
    } catch {
      return null;
    }
  }, [records]);

  return (
    <Panel
      eyebrow="Simulate a new source"
      title="Register a source that arrives with an unknown schema"
      description="Paste records with attribute names of your choosing. The columns are profiled, the matcher proposes and scores candidates, and the source is stored in generic dynamic storage until you accept a mapping."
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (!columns) {
                setError("The pasted records are not valid JSON objects.");
                return;
              }
              setError(null);
              setPreviewFields(columns);
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium transition-colors hover:bg-accent"
          >
            <Sparkles className="size-3" />
            Preview matching
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const result = await register({ display_name: name, records_json: records });
                toast.success(`Registered ${result.source_id} — accept a mapping to activate it`);
              } catch (err) {
                const message = err instanceof Error ? err.message : "Registration failed";
                setError(message);
                toast.error(message);
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Rocket className="size-3" />}
            Register source
          </button>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Source name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Records (JSON array)
            </span>
            <textarea
              value={records}
              onChange={(event) => setRecords(event.target.value)}
              rows={12}
              spellCheck={false}
              className="rounded-md border border-input bg-background p-2.5 font-mono text-[11px] leading-5 text-foreground outline-none focus-visible:border-ring"
            />
          </label>
          {error && <p className="text-[11px] text-destructive">{error}</p>}
          {columns && (
            <div className="flex flex-wrap gap-1.5">
              {columns.map((column) => (
                <Chip key={column.name}>{column.name}</Chip>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Matcher preview (nothing registered yet)
          </p>
          {!preview ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-xs leading-5 text-muted-foreground">
              Press “Preview matching” to profile the pasted columns and score them against the canonical schema.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/70">
              {preview.report.fields.map((field) => {
                const top = field.recommended;
                return (
                  <div key={field.source_field.name} className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip>{field.source_field.name}</Chip>
                      <Pill>{field.source_field.datatype}</Pill>
                      <span className="text-xs text-muted-foreground">→</span>
                      {top ? (
                        <>
                          <Chip className="border-primary/25 bg-primary/10 text-primary">
                            {top.canonical_field}
                          </Chip>
                          <ScoreBar score={top.score} />
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">no candidate</span>
                      )}
                      <Pill
                        tone={
                          field.status === "matched"
                            ? "positive"
                            : field.status === "ambiguous"
                              ? "warning"
                              : "critical"
                        }
                      >
                        {field.status}
                      </Pill>
                    </div>
                    {top && (
                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{top.reasoning}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {preview && preview.report.warnings.length > 0 && (
            <ul className="mt-2 space-y-1 text-[11px] leading-5 text-muted-foreground">
              {preview.report.warnings.map((warning) => (
                <li key={warning}>• {warning}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}
