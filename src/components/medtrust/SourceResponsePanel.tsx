import { CopyButton, Chip, JsonView, Mono, Pill } from "@/components/medtrust/primitives";
import { shortSource } from "@/components/medtrust/IntegratedView";
import type { SourceResponse } from "@/lib/medtrust";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function SourceResponsePanel({ response }: { response: SourceResponse }) {
  const [open, setOpen] = useState(false);
  const ok = response.ok && response.matched_count > 0;

  return (
    <div className="rounded-lg border border-border/70 bg-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full flex-wrap items-center justify-between gap-2 px-3.5 py-3 text-left"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            {shortSource(response.display_name)}
          </span>
          <Mono className="truncate text-muted-foreground">{response.endpoint}</Mono>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone={ok ? "positive" : response.status === 404 ? "neutral" : "warning"}>
            {response.status} {ok ? "· matched" : response.status === 404 ? "· no record" : "· error"}
          </Pill>
          <Pill>{response.transport}</Pill>
          <Mono className="text-muted-foreground">{response.latency_ms}ms</Mono>
          <span className="text-[11px] font-medium text-primary">{open ? "Hide" : "Details"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-border/70 px-3.5 py-3">
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Decomposed predicate</dt>
              <dd className="mt-0.5">
                <Mono>
                  {response.predicate.field} eq '{response.predicate.value}'
                </Mono>
                <span className="ml-1 text-muted-foreground">
                  (canonical key {response.predicate.normalized})
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Source-side resolution</dt>
              <dd className="mt-0.5">
                <Mono>strategy: {response.strategy ?? "n/a"}</Mono>
                <span className="ml-1 text-muted-foreground">
                  · {response.record_count} record(s) · {response.matched_count} matched
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Transport</dt>
              <dd className="mt-0.5 text-muted-foreground">
                <Mono>{response.transport}</Mono> — {response.transport_origin}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Accepted mappings applied</dt>
              <dd className="mt-0.5 flex flex-wrap gap-1">
                {response.mappings_applied.length === 0 ? (
                  <span className="text-muted-foreground">no accepted mapping — source is skipped</span>
                ) : (
                  response.mappings_applied.map((mapping) => <Chip key={mapping}>{mapping}</Chip>)
                )}
              </dd>
            </div>
          </dl>

          {response.url && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Mono className="truncate text-muted-foreground">{response.url}</Mono>
              <CopyButton text={response.url} label="Copy URL" />
            </div>
          )}

          {response.query_attempts.length > 0 && (
            <div className="mt-3 rounded-md border border-warning/30 bg-warning/10 p-2.5 text-[11px] text-warning-foreground">
              <p className="font-semibold uppercase tracking-[0.12em]">Transport fallback attempts</p>
              <ul className="mt-1 space-y-0.5">
                {response.query_attempts.map((attempt) => (
                  <li key={`${attempt.base}-${attempt.error}`}>
                    <Mono>{attempt.base}</Mono> — {attempt.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {response.normalization_notes.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Normalization steps
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {response.normalization_notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Raw API payload (source attribute names)
            </p>
            <JsonView
              value={response.records.length > 0 ? response.records : { records: [], message: "no record for this key" }}
              maxHeight="18rem"
              className={cn("mt-1.5")}
            />
          </div>
        </div>
      )}
    </div>
  );
}
