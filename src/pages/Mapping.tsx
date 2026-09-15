import { AppShell } from "@/components/AppShell";
import { Chip, Mono, Panel, Pill, ScoreBar } from "@/components/medtrust/primitives";
import { MappingTable } from "@/components/medtrust/MappingTable";
import { shortSource } from "@/components/medtrust/IntegratedView";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Loader2 } from "lucide-react";

const WEIGHTS = [
  { label: "Attribute name similarity", value: "0.50", detail: "registered synonyms, concept tokens, edit distance" },
  { label: "Datatype compatibility", value: "0.20", detail: "profiled source type vs canonical type" },
  { label: "Sample-value compatibility", value: "0.30", detail: "format match + overlap with known canonical values" },
];

export default function Mapping() {
  const canonical = useQuery(api.registry.canonicalSchema);
  const sources = useQuery(api.registry.listSources);

  if (!canonical || !sources) {
    return (
      <AppShell>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading canonical schema and mappings…
        </div>
      </AppShell>
    );
  }

  const accepted = sources.flatMap((source) =>
    source.mappings
      .filter((mapping) => mapping.accepted && mapping.canonical_field)
      .map((mapping) => ({ source, mapping })),
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <Panel
          eyebrow="Rubric 5 · 8"
          title="Canonical schema and source-to-canonical mappings"
          description="The canonical schema is the shared vocabulary of the mediator. Each source column is mapped onto it by the matcher, with the score breakdown kept so the mapping can be audited."
        >
          <div className="grid gap-3 lg:grid-cols-3">
            {WEIGHTS.map((weight) => (
              <div key={weight.label} className="rounded-lg border border-border/70 bg-muted/30 p-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold tracking-tight text-foreground">{weight.label}</p>
                  <Mono className="text-primary">{weight.value}</Mono>
                </div>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{weight.detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg border border-border/70 bg-card p-3.5">
            <Mono className="text-foreground">
              score = 0.50·name + 0.20·datatype + 0.30·samples · accept at ≥ 0.65 · ambiguous if the runner-up is within 0.08
            </Mono>
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
              Deterministic and explainable on purpose: no language model, no training data. Low-confidence columns are
              reported as unmapped and wait for a human decision on the onboarding screen.
            </p>
          </div>
        </Panel>

        <Panel
          eyebrow="Global schema"
          title="Canonical medicine schema"
          description="Fourteen canonical fields assembled from five source systems, each written with different attribute names."
        >
          <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Canonical field</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Meaning</th>
                  <th className="px-3 py-2 font-semibold">Registered synonyms</th>
                </tr>
              </thead>
              <tbody>
                {canonical.map((field) => (
                  <tr key={field.id} className="border-t border-border/60 align-top">
                    <td className="px-3 py-2.5">
                      <Chip className="border-primary/25 bg-primary/10 text-primary">{field.id}</Chip>
                      <p className="mt-1 text-[11px] text-muted-foreground">{field.label}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Pill>{field.datatype}</Pill>
                      {field.pattern && (
                        <Mono className="mt-1 block text-[10.5px] text-muted-foreground">{field.pattern}</Mono>
                      )}
                    </td>
                    <td className="max-w-[22rem] px-3 py-2.5 text-xs leading-5 text-muted-foreground">
                      {field.description}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex max-w-[20rem] flex-wrap gap-1">
                        {field.aliases.slice(0, 10).map((alias) => (
                          <Chip key={alias}>{alias}</Chip>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          eyebrow="Mapping matrix"
          title="Which source attribute feeds which canonical field"
          description="This is the explicit correspondence the mediator applies at query time. A canonical field can be fed by several sources — the merge resolves those overlaps."
        >
          <div className="flex flex-col divide-y divide-border/60">
            {canonical.map((field) => {
              const entries = accepted.filter((entry) => entry.mapping.canonical_field === field.id);
              return (
                <div key={field.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
                  <div>
                    <Chip className="border-primary/25 bg-primary/10 text-primary">{field.id}</Chip>
                    <p className="mt-1 text-[11px] text-muted-foreground">{field.label}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {entries.length === 0 && (
                      <span className="text-xs text-muted-foreground">no source feeds this field yet</span>
                    )}
                    {entries
                      .sort((a, b) => a.source.priority - b.source.priority)
                      .map(({ source, mapping }) => (
                        <div
                          key={`${source.source_id}-${mapping.source_field}`}
                          className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-2.5 py-1.5"
                        >
                          <span className="text-[11px] font-medium text-foreground">
                            {shortSource(source.display_name)}
                          </span>
                          <Chip>{mapping.source_field}</Chip>
                          <ScoreBar score={mapping.score} />
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {sources.map((source) => (
          <Panel
            key={source.source_id}
            eyebrow={`${source.display_name} · ${source.record_count} records`}
            title={`Accepted and rejected state of every ${source.display_name} column`}
            description={`Produced by the matcher when the source was profiled${source.active ? " and accepted by an integrator" : " — still awaiting acceptance"}.`}
            actions={
              <Pill tone={source.active ? "positive" : "warning"}>
                {source.accepted_mappings}/{source.mappings.length} columns used
              </Pill>
            }
          >
            <MappingTable mappings={source.mappings} />
          </Panel>
        ))}
      </div>
    </AppShell>
  );
}
