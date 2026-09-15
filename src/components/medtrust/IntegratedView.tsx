import { Chip, Mono, Pill } from "@/components/medtrust/primitives";
import { AGREEMENT_LABEL, type IntegratedField } from "@/lib/medtrust";
import { cn } from "@/lib/utils";
import { ChevronDown, GitMerge, Layers, TriangleAlert } from "lucide-react";
import { useState } from "react";

const SHORT_SOURCE: Record<string, string> = {
  "Manufacturer ERP": "Manufacturer",
  "Distributor Supply Chain": "Distributor",
  "Vendor Point of Sale": "Vendor",
  "Consumer Affairs Complaints": "Consumer Affairs",
  "State Drug Control Registry": "Drug Registry",
};

export function shortSource(displayName: string): string {
  return SHORT_SOURCE[displayName] ?? displayName;
}

function agreementTone(agreement: string): "positive" | "warning" | "neutral" | "accent" {
  if (agreement === "consistent") return "positive";
  if (agreement === "conflict") return "warning";
  if (agreement === "derived_absent") return "accent";
  return "neutral";
}

export function IntegratedView({ fields }: { fields: IntegratedField[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="divide-y divide-border/60">
      {fields.map((field) => {
        const isOpen = open === field.canonical_field;
        const sources = Array.from(
          new Map(field.contributors.map((c) => [c.source_id, c.source_display_name])).entries(),
        );
        const hasValue = field.value !== "";
        return (
          <div key={field.canonical_field} className="py-3.5">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] sm:items-start">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {field.label}
                </p>
              </div>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-[15px] leading-6 text-foreground",
                    field.canonical_field === "medicine_id" && "font-mono text-base font-semibold",
                    !hasValue && "text-muted-foreground",
                  )}
                >
                  {hasValue ? field.value : "—"}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {sources.map(([sourceId, displayName]) => (
                    <span
                      key={sourceId}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/50 px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground"
                    >
                      <span className="size-1.5 rounded-full bg-primary" />
                      {shortSource(displayName)}
                    </span>
                  ))}
                  {field.agreement === "conflict" && (
                    <Pill tone="warning">
                      <TriangleAlert className="size-3" />
                      {field.alternatives.length} differing value
                      {field.alternatives.length > 1 ? "s" : ""}
                    </Pill>
                  )}
                  {field.agreement === "derived_absent" && (
                    <Pill tone="accent">
                      <Layers className="size-3" />
                      from absence of a complaint row
                    </Pill>
                  )}
                  {field.contributors.length > 1 && field.agreement === "consistent" && (
                    <Pill tone="positive">
                      <GitMerge className="size-3" />
                      {field.contributors.length} sources agree
                    </Pill>
                  )}
                  {field.contributors.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : field.canonical_field)}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      {isOpen ? "Hide sources" : "View sources"}
                      <ChevronDown className={cn("size-3 transition-transform", isOpen && "rotate-180")} />
                    </button>
                  )}
                </div>

                {isOpen && (
                  <div className="mt-3 rounded-lg border border-border/70 bg-muted/30 p-3">
                    <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      {AGREEMENT_LABEL[field.agreement] ?? field.agreement}
                    </p>
                    <div className="flex flex-col gap-2">
                      {field.contributors.map((contributor, index) => (
                        <div
                          key={`${contributor.source_id}-${contributor.source_field}-${index}`}
                          className="grid gap-1 rounded-md border border-border/60 bg-card px-2.5 py-2 text-xs sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-foreground">
                              {shortSource(contributor.source_display_name)}
                            </span>
                            <Chip>{contributor.source_field}</Chip>
                          </div>
                          <div className="flex flex-col gap-0.5 text-muted-foreground">
                            <span>
                              raw value:{" "}
                              <Mono className="text-foreground">{contributor.raw_value || "—"}</Mono>
                            </span>
                            <span>
                              used in the unified view:{" "}
                              <Mono className="text-foreground">{contributor.display_value || "—"}</Mono>
                            </span>
                            {contributor.resolved_from && (
                              <span className="text-[11px]">
                                source-local identifier <Mono>{contributor.resolved_from}</Mono> resolved by the
                                source API to the canonical key
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {field.alternatives.length > 0 && (
                      <div className="mt-3 rounded-md border border-warning/30 bg-warning/10 p-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-warning-foreground">
                          Differing values kept in the provenance
                        </p>
                        <ul className="mt-1.5 space-y-1 text-xs text-warning-foreground">
                          {field.alternatives.map((alternative) => (
                            <li key={`${alternative.source_id}-${alternative.value}`}>
                              <Mono>{alternative.value}</Mono>{" "}
                              <span className="text-muted-foreground">
                                from {shortSource(alternative.source_display_name)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
