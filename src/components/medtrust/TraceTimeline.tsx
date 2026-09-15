import { JsonView, Mono } from "@/components/medtrust/primitives";
import type { TraceStep } from "@/lib/medtrust";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, CircleDashed, Info, XCircle } from "lucide-react";

const PHASE_LABEL: Record<TraceStep["phase"], string> = {
  request: "Request",
  registry: "Registry",
  plan: "Query planning",
  fanout: "Source communication",
  normalize: "Normalization",
  match: "Entity matching",
  merge: "Merge",
  respond: "Response",
};

function StatusIcon({ status }: { status: TraceStep["status"] }) {
  if (status === "ok") return <CheckCircle2 className="size-4 text-success" />;
  if (status === "warn") return <AlertTriangle className="size-4 text-warning-foreground" />;
  if (status === "error") return <XCircle className="size-4 text-destructive" />;
  return <Info className="size-4 text-muted-foreground" />;
}

export function TraceTimeline({ steps, dense = false }: { steps: TraceStep[]; dense?: boolean }) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => (
        <li key={`${step.seq}-${step.title}`} className="relative flex gap-3 pb-4 last:pb-0">
          {index < steps.length - 1 && (
            <span className="absolute left-[7px] top-5 h-full w-px bg-border" aria-hidden />
          )}
          <span className="relative mt-0.5 flex size-4 shrink-0 items-center justify-center">
            <StatusIcon status={step.status} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {PHASE_LABEL[step.phase]}
              </span>
              <Mono className="text-muted-foreground">+{step.at_ms}ms</Mono>
            </div>
            <p className="mt-0.5 text-sm font-medium leading-5 text-foreground">{step.title}</p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{step.detail}</p>
            {step.data && !dense && (
              <details className="mt-1.5">
                <summary className="cursor-pointer text-[11px] font-medium text-primary">
                  step payload
                </summary>
                <JsonView value={step.data} maxHeight="14rem" className="mt-1.5" />
              </details>
            )}
          </div>
        </li>
      ))}
      {steps.length === 0 && (
        <li className="flex items-center gap-2 text-xs text-muted-foreground">
          <CircleDashed className="size-4" />
          No trace recorded yet — run a verification to generate one.
        </li>
      )}
    </ol>
  );
}

export function TraceCounters({
  counters,
}: {
  counters: {
    sources_registered: number;
    sources_queried: number;
    sources_answered?: number;
    sources_responded: number;
    records_returned: number;
    records_matched: number;
    mappings_applied: number;
    fields_resolved: number;
    conflicts: number;
    http_calls: number;
    in_process_calls: number;
  };
}) {
  const items: Array<[string, string | number]> = [
    ["Sources registered", counters.sources_registered],
    ["Sources queried", counters.sources_queried],
    ["APIs answered", counters.sources_answered ?? counters.sources_queried],
    ["Held a matching record", counters.sources_responded],
    ["Raw records returned", counters.records_returned],
    ["Records matched", counters.records_matched],
    ["Mappings applied", counters.mappings_applied],
    ["Fields resolved", counters.fields_resolved],
    ["Conflicts resolved", counters.conflicts],
    ["HTTP calls", counters.http_calls],
    ["In-process calls", counters.in_process_calls],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className={cn("border-l-2 border-border pl-2.5")}>
          <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
