import { Chip, Mono, Pill, ScoreBar } from "@/components/medtrust/primitives";
import type { SourceRecord } from "@/lib/medtrust";
import { AlertTriangle } from "lucide-react";

type Mapping = SourceRecord["mappings"][number];

function originTone(origin: string): "neutral" | "positive" | "accent" | "warning" {
  if (origin === "manual") return "accent";
  if (origin === "matcher-accepted") return "positive";
  if (origin === "rejected") return "warning";
  if (origin === "matcher") return "neutral";
  return "warning";
}

export function MappingTable({ mappings }: { mappings: Mapping[] }) {
  return (
    <div className="flex flex-col divide-y divide-border/60">
      {mappings.map((mapping) => (
        <div key={mapping.source_field} className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_auto] sm:items-start">
          <div className="min-w-0">
            <Chip>{mapping.source_field}</Chip>
            {mapping.canonical_field ? (
              <span className="ml-2 text-xs text-muted-foreground">→ {mapping.canonical_field}</span>
            ) : (
              <span className="ml-2 text-xs text-muted-foreground">→ no canonical target</span>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Pill tone={originTone(mapping.origin)}>{mapping.origin}</Pill>
              <Pill tone={mapping.accepted ? "positive" : "warning"}>
                {mapping.accepted ? "accepted" : "not used by the mediator"}
              </Pill>
            </div>
          </div>
          <div className="min-w-0">
            <ScoreBar score={mapping.score} />
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              <Mono className="text-muted-foreground">name {mapping.name_score.toFixed(2)}</Mono>
              <Mono className="text-muted-foreground">datatype {mapping.datatype_score.toFixed(2)}</Mono>
              <Mono className="text-muted-foreground">samples {mapping.sample_score.toFixed(2)}</Mono>
            </div>
          </div>
          <div className="min-w-0 text-xs leading-5 text-muted-foreground">
            <p className="line-clamp-3">{mapping.reasoning}</p>
            {mapping.warnings.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {mapping.warnings.map((warning) => (
                  <li key={warning} className="flex items-start gap-1 text-[11px] text-warning-foreground">
                    <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
