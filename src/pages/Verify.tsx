import { AppShell } from "@/components/AppShell";
import { Chip, CopyButton, JsonView, KeyValue, Mono, Panel, Pill, Stat } from "@/components/medtrust/primitives";
import { IntegratedView } from "@/components/medtrust/IntegratedView";
import { SourceResponsePanel } from "@/components/medtrust/SourceResponsePanel";
import { TraceCounters, TraceTimeline } from "@/components/medtrust/TraceTimeline";
import { api } from "@/convex/_generated/api";
import { DEMO_CASES } from "@/lib/demo-cases";
import { TONE_CLASSES, formatDateTime, statusMeta, type VerifyResult } from "@/lib/medtrust";
import { convexSiteUrl } from "@/lib/site-url";
import { cn } from "@/lib/utils";
import { useAction, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Search, ShieldAlert, ShieldCheck, SkipForward } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

export default function Verify() {
  const [searchParams] = useSearchParams();
  const initial = searchParams.get("id") ?? "";
  const navigate = useNavigate();
  const [query, setQuery] = useState(initial || "MED-10482");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verify = useAction(api.verify.verifyMedicine);
  const sources = useQuery(api.registry.listSources);
  const site = convexSiteUrl();

  const run = useCallback(
    async (medicineId: string) => {
      const id = medicineId.trim();
      if (!id) {
        setError("Enter a medicine / product id to verify.");
        return;
      }
      setPending(true);
      setError(null);
      try {
        const response = await verify({ medicine_id: id, site_base: site, triggered_by: "verify-screen" });
        setResult(response);
      } catch (err) {
        setResult(null);
        setError(err instanceof Error ? err.message : "The mediation request failed.");
      } finally {
        setPending(false);
      }
    },
    [verify, site],
  );

  useEffect(() => {
    if (initial) void run(initial);
  }, [initial, run]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    navigate(`/verify?id=${encodeURIComponent(query.trim())}`, { replace: true });
    void run(query);
  };

  const meta = result ? statusMeta(result.status.code) : null;
  const queriedSources = (sources ?? []).filter((source) => source.active);

  const summaryFields = result
    ? result.fields.filter((field) =>
        ["manufacturer", "batch_number", "manufacture_date", "expiry_date", "supplier", "procurement_date", "vendor", "price", "complaint_status"].includes(
          field.canonical_field,
        ),
      )
    : [];

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        {/* -------------------------------------------------------- search bar */}
        <Panel
          eyebrow="Mediation request"
          title="Verify an item across independent source systems"
          description="One identifier in, one integrated answer out. The mediator plans which source APIs to call, then normalises and merges what they return."
        >
          <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Enter Medicine / Product ID — e.g. MED-10482"
                className="h-11 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                aria-label="Medicine or product id"
              />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-xs font-bold uppercase tracking-[0.14em] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              Verify medicine
            </button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Demo cases
            </span>
            {DEMO_CASES.map((demoCase) => (
              <button
                key={demoCase.id}
                type="button"
                onClick={() => {
                  setQuery(demoCase.id);
                  navigate(`/verify?id=${encodeURIComponent(demoCase.id)}`, { replace: true });
                  void run(demoCase.id);
                }}
                className={cn(
                  "rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
                  query.trim() === demoCase.id
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:bg-accent",
                )}
              >
                {demoCase.id}
              </button>
            ))}
          </div>
          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
        </Panel>

        {/* --------------------------------------------------------- mediating */}
        {pending && (
          <Panel dense>
            <div className="flex flex-wrap items-center gap-3">
              <Loader2 className="size-4 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">
                Decomposing the request and calling {queriedSources.length || "the"} source API
                {queriedSources.length === 1 ? "" : "s"}…
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {queriedSources.map((source) => (
                <Chip key={source.source_id}>
                  GET {source.api_base}/item/{query.trim() || "…"}
                </Chip>
              ))}
            </div>
          </Panel>
        )}

        {/* ----------------------------------------------------------- result */}
        {result && meta && (
          <>
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <Panel
                eyebrow="Integrated medicine view"
                title={`${result.fields.find((f) => f.canonical_field === "medicine_id")?.value ?? result.request.input} · ${
                  result.fields.find((f) => f.canonical_field === "medicine_name")?.value ?? "unknown product"
                }`}
                description={result.status.description}
                actions={
                  <div className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", TONE_CLASSES[meta.tone])}>
                    {result.status.label}
                  </div>
                }
              >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {summaryFields.map((field) => (
                    <KeyValue key={field.canonical_field} label={field.label}>
                      <span className="font-medium">{field.value || "—"}</span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {field.contributors.length > 0
                          ? `source${field.contributors.length > 1 ? "s" : ""}: ${Array.from(
                              new Set(field.contributors.map((c) => c.source_id)),
                            ).join(", ")}`
                          : "not returned by any source"}
                      </span>
                    </KeyValue>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat
                    label="Sources queried"
                    value={`${result.statistics.sources_responded}/${result.statistics.sources_queried}`}
                    hint="held a matching record / APIs called"
                  />
                  <Stat
                    label="Fields resolved"
                    value={`${result.statistics.fields_resolved}/${result.statistics.fields_total}`}
                    hint="canonical fields filled by the merge"
                  />
                  <Stat
                    label="Conflicts resolved"
                    value={result.statistics.conflicts}
                    hint="differing values kept in provenance"
                  />
                  <Stat
                    label="Total latency"
                    value={`${result.trace.total_latency_ms}ms`}
                    hint={`run ${String(result.request.run_id ?? "").slice(0, 8) || "—"} stored at ${formatDateTime(result.request.requested_at)}`}
                  />
                </div>

                <p className="mt-4 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
                  {result.status.disclaimer}
                </p>
              </Panel>
            </motion.section>

            <Panel
              eyebrow="Provenance"
              title="Every field keeps its source"
              description="Expand a field to see the raw value each source returned, which source won the merge, and where values disagreed."
            >
              <IntegratedView fields={result.fields} />
            </Panel>

            <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
              <Panel
                eyebrow="Query federation"
                title="Request decomposition"
                description="The mediator translated one identifier into a source-level predicate per system, and recorded why the others were skipped."
              >
                <div className="overflow-x-auto rounded-lg border border-border/70">
                  <table className="w-full min-w-[30rem] border-collapse text-left text-sm">
                    <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Source</th>
                        <th className="px-3 py-2 font-semibold">Predicate</th>
                        <th className="px-3 py-2 font-semibold">Endpoint</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.plan.queries.map((planQuery) => (
                        <tr key={planQuery.source_id} className="border-t border-border/60">
                          <td className="px-3 py-2.5 text-xs font-medium text-foreground">
                            {planQuery.display_name}
                          </td>
                          <td className="px-3 py-2.5">
                            <Mono>
                              {planQuery.predicate.field} eq '{planQuery.predicate.value}'
                            </Mono>
                          </td>
                          <td className="px-3 py-2.5">
                            <Mono className="text-muted-foreground">{planQuery.endpoint}</Mono>
                          </td>
                        </tr>
                      ))}
                      {result.plan.queries.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-3 py-3 text-xs text-muted-foreground">
                            No source had an accepted identity mapping for this request.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {result.plan.skipped.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2">
                    {result.plan.skipped.map((skip) => (
                      <div
                        key={skip.source_id}
                        className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs"
                      >
                        <p className="flex items-center gap-1.5 font-semibold text-warning-foreground">
                          <SkipForward className="size-3.5" />
                          {skip.display_name} skipped
                        </p>
                        <p className="mt-1 leading-5 text-warning-foreground/90">
                          {skip.reason} — {skip.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <details className="mt-3">
                  <summary className="cursor-pointer text-[11px] font-medium text-primary">
                    source selection table ({result.plan.considered.length} sources)
                  </summary>
                  <div className="mt-2 flex flex-col divide-y divide-border/60 rounded-lg border border-border/70">
                    {result.plan.considered.map((entry) => (
                      <div key={entry.source_id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
                        <span className="font-medium text-foreground">{entry.display_name}</span>
                        <Pill tone={entry.decision === "query" ? "positive" : "neutral"}>{entry.decision}</Pill>
                        <Mono className="text-muted-foreground">
                          onboarded: {String(entry.active)} · identity mapping: {String(entry.has_identity_mapping)}
                        </Mono>
                      </div>
                    ))}
                  </div>
                </details>
              </Panel>

              <Panel
                eyebrow="Integration trace"
                title={`${result.trace.steps.length} recorded steps`}
                description="Generated by the mediator while it ran — not written by hand. Each step records the real API call, status, latency and transport."
              >
                <TraceCounters counters={result.trace.counters} />
                <div className="mt-4">
                  <TraceTimeline steps={result.trace.steps} />
                </div>
              </Panel>
            </div>

            <Panel
              eyebrow="Source communication"
              title="What each source API returned"
              description="Raw payloads keep the source's own attribute names — the mediator, not the source, owns the mapping to the canonical schema."
            >
              <div className="flex flex-col gap-2">
                {result.sources.map((response) => (
                  <SourceResponsePanel key={response.source_id} response={response} />
                ))}
                {result.sources.length === 0 && (
                  <div className="rounded-lg border border-border/70 bg-muted/30 p-4 text-xs">
                    <p className="flex items-center gap-1.5 font-medium text-foreground">
                      <ShieldAlert className="size-3.5" />
                      No source API answered this request.
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Try a seeded identifier such as MED-10482, or register a new source on the onboarding screen.
                    </p>
                  </div>
                )}
              </div>
            </Panel>

            <Panel
              eyebrow="Raw artifact"
              title="Complete mediator response"
              description="Exactly what the integration hub returned to this screen, stored alongside the run so a TA can re-open it from the trace history."
              actions={<CopyButton text={JSON.stringify(result, null, 2)} label="Copy JSON" />}
            >
              <JsonView value={result} maxHeight="24rem" />
            </Panel>
          </>
        )}

        {!result && !pending && (
          <Panel eyebrow="How it works" title="What happens when you press verify">
            <ol className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              {[
                "The identifier is canonicalised (case and separators removed).",
                "The source registry decides which systems may answer.",
                "One query per source is planned with that source's own column.",
                "Each source API is called over HTTP and its response logged.",
                "Returned records are normalised through accepted mappings.",
                "Records are matched on the canonical identity key.",
                "Values are merged by source priority; conflicts are kept.",
                "The unified view is returned with per-field provenance.",
              ].map((line, index) => (
                <li key={line} className="flex gap-2 leading-6">
                  <Mono className="text-primary">{String(index + 1).padStart(2, "0")}</Mono>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => void run(query)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-primary-foreground transition-opacity hover:opacity-90"
            >
              Run the mediator
              <ArrowRight className="size-4" />
            </button>
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
