import { AppShell } from "@/components/AppShell";
import { Chip, CopyButton, Mono, Panel, Pill, Stat } from "@/components/medtrust/primitives";
import { SchemaTable } from "@/components/medtrust/SchemaTable";
import { api } from "@/convex/_generated/api";
import { convexSiteUrl } from "@/lib/site-url";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { ExternalLink, Loader2 } from "lucide-react";

export default function Sources() {
  const sources = useQuery(api.registry.listSources);
  const stats = useQuery(api.registry.stats);
  const site = convexSiteUrl();

  if (!sources || !stats) {
    return (
      <AppShell>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading source registry…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <Panel
          eyebrow="Rubric 3 · 4 · 5 · 6 · 7"
          title="Independent source systems and their own schemas"
          description="Each system below is a separate table with its own attribute names and its own API. Nothing is merged into a common table: the mediator is the only component that knows how the attributes correspond."
          actions={
            site ? (
              <>
                <CopyButton text={`${site}/api/sources`} label="Copy API index" />
                <a
                  href={`${site}/api/sources`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <ExternalLink className="size-3.5" />
                  Open /api/sources
                </a>
              </>
            ) : null
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Registered sources" value={stats.registered_sources} hint={`${stats.active_sources} onboarded`} />
            <Stat label="Structured records" value={stats.total_records} hint="across five separate tables" />
            <Stat label="Distinct items" value={stats.distinct_products} hint="canonical identity keys observed" />
            <Stat label="Mediations logged" value={stats.integration_runs} hint="each with plan + trace" />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {Object.entries(stats.tables).map(([table, count]) => (
              <div key={table} className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                <Mono className="text-muted-foreground">{table}</Mono>
                <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-foreground">{count}</p>
              </div>
            ))}
          </div>
        </Panel>

        {sources.map((source) => {
          const endpoints = [
            { label: "schema", path: `${source.api_base}/schema` },
            { label: "items", path: `${source.api_base}/items?limit=5` },
            { label: "item", path: `${source.api_base}/item/{medicine_id}` },
          ];
          return (
            <Panel
              key={source.source_id}
              eyebrow={`Source ${source.priority} · ${source.kind}`}
              title={source.display_name}
              description={source.description}
              actions={
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill tone={source.active ? "positive" : "warning"}>
                    {source.active ? "queried by the mediator" : "pending onboarding"}
                  </Pill>
                  <Pill>{source.storage}</Pill>
                </div>
              }
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Records</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-foreground">
                    {source.record_count}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Attributes</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-foreground">
                    {source.fields.length}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    Mappings accepted
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-foreground">
                    {source.accepted_mappings}/{source.mappings.length}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Schema as stored by this source
                </p>
                <SchemaTable fields={source.fields} mappings={source.mappings} />
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    API endpoints
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {endpoints.map((endpoint) => {
                      const url = site ? `${site}${endpoint.path}` : endpoint.path;
                      return (
                        <div key={endpoint.label} className="flex flex-wrap items-center gap-2">
                          <Mono className="text-foreground">GET {url}</Mono>
                          <CopyButton text={url} label="Copy" />
                          {site && (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-medium text-primary hover:underline"
                            >
                              open
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Notes
                  </p>
                  <p className="text-xs leading-5 text-muted-foreground">{source.notes}</p>
                  {source.unresolved_columns.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">kept out of the integration:</span>
                      {source.unresolved_columns.map((column) => (
                        <Chip key={column} className={cn("border-warning/40 bg-warning/10 text-warning-foreground")}>
                          {column}
                        </Chip>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Maintained by {source.owner}
                    {source.onboarded_at
                      ? ` · onboarded ${new Date(source.onboarded_at).toLocaleDateString()}`
                      : " · not onboarded"}
                  </p>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </AppShell>
  );
}
