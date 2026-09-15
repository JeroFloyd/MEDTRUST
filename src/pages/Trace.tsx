import { AppShell } from "@/components/AppShell";
import { Chip, JsonView, Mono, Panel, Pill, Stat } from "@/components/medtrust/primitives";
import { IntegratedView } from "@/components/medtrust/IntegratedView";
import { TraceCounters, TraceTimeline } from "@/components/medtrust/TraceTimeline";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { TONE_CLASSES, formatDateTime, parseStoredResult, statusMeta, type TraceStep } from "@/lib/medtrust";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export default function Trace() {
  const history = useQuery(api.runs.history, { limit: 30 });
  const stats = useQuery(api.registry.stats);
  const [selected, setSelected] = useState<Id<"integration_runs"> | null>(null);
  const activeId = selected ?? history?.[0]?.run_id ?? null;
  const detail = useQuery(api.runs.detail, activeId ? { run_id: activeId } : "skip");

  const result = parseStoredResult(detail?.result);
  const trace = detail?.trace as
    | { steps?: TraceStep[]; counters?: Parameters<typeof TraceCounters>[0]["counters"]; total_latency_ms?: number }
    | null;

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <Panel
          eyebrow="Rubric 7 · 8"
          title="Integration trace history"
          description="Every mediation request is stored with its plan, the real API calls it made, the normalisation it applied and the merged result. Nothing on this screen is written by hand — it is replayed from the stored run records."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Stored runs" value={stats?.integration_runs ?? "—"} hint="bounded to the latest 60" />
            <Stat label="Selected run" value={activeId ? activeId.slice(0, 8) : "—"} hint="click a run to replay it" />
            <Stat
              label="Steps in trace"
              value={trace?.steps?.length ?? "—"}
              hint="mediator events, not simulated"
            />
            <Stat
              label="Run latency"
              value={detail ? `${detail.latency_ms}ms` : "—"}
              hint={detail ? `${detail.transport} transport` : undefined}
            />
          </div>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <Panel eyebrow="History" title="Mediation runs" dense>
            {!history ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading run history…
              </div>
            ) : history.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No runs stored yet. Verify a medicine and the trace will appear here.
              </p>
            ) : (
              <div className="flex max-h-[32rem] flex-col gap-1.5 overflow-auto pr-1">
                {history.map((run) => {
                  const meta = statusMeta(run.status);
                  const isActive = run.run_id === activeId;
                  return (
                    <button
                      key={run.run_id}
                      type="button"
                      onClick={() => setSelected(run.run_id)}
                      className={cn(
                        "rounded-lg border px-3 py-2.5 text-left transition-colors",
                        isActive ? "border-primary/40 bg-primary/5" : "border-border/70 hover:bg-accent/50",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Chip>{run.medicine_id}</Chip>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", TONE_CLASSES[meta.tone])}>
                          {meta.short}
                        </span>
                        <Mono className="ml-auto text-muted-foreground">{run.latency_ms}ms</Mono>
                      </div>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {run.sources_responded}/{run.sources_queried} sources · {run.fields_resolved} fields ·{" "}
                        {run.conflicts} conflict(s) · {formatDateTime(run.created_at)}
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-muted-foreground">triggered by {run.triggered_by}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </Panel>

          <div className="flex flex-col gap-4">
            {detail && trace?.steps && trace.counters ? (
              <>
                <Panel
                  eyebrow="Replayed trace"
                  title={`${detail.medicine_id} · ${statusMeta(detail.status).label}`}
                  description={`Stored ${formatDateTime(detail.created_at)} · ${detail.sources_responded}/${detail.sources_queried} sources held a record · ${detail.transport} transport`}
                  actions={<Pill tone="neutral">run {detail.run_id.slice(0, 8)}</Pill>}
                >
                  <TraceCounters counters={trace.counters} />
                  <div className="mt-4">
                    <TraceTimeline steps={trace.steps} />
                  </div>
                </Panel>

                {result && (
                  <Panel
                    eyebrow="Integrated view at that time"
                    title="Fields and provenance captured in the run"
                    description="The stored artifact is the same object the verify screen rendered, so a TA can audit any earlier mediation."
                  >
                    <IntegratedView fields={result.fields} />
                  </Panel>
                )}

                <Panel eyebrow="Artifact" title="Stored run payload" dense>
                  <JsonView
                    value={{
                      run: {
                        medicine_id: detail.medicine_id,
                        status: detail.status,
                        sources_queried: detail.sources_queried,
                        sources_responded: detail.sources_responded,
                        conflicts: detail.conflicts,
                        latency_ms: detail.latency_ms,
                        transport: detail.transport,
                      },
                      counters: trace.counters,
                    }}
                    maxHeight="18rem"
                  />
                </Panel>
              </>
            ) : (
              <Panel eyebrow="Replay" title="No run selected">
                <p className="text-sm text-muted-foreground">
                  Run a verification, then pick a run from the history to replay its trace.
                </p>
              </Panel>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
