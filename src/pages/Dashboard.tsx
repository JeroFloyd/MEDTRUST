import { Brand } from "@/components/AppShell";
import { Chip, Mono, Panel, Pill, Stat } from "@/components/medtrust/primitives";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { TONE_CLASSES, formatDateTime, statusMeta, type RunSummary } from "@/lib/medtrust";
import { convexSiteUrl } from "@/lib/site-url";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import { Activity, Database, Loader2, LogOut, Play, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

const NAV = [
  { to: "/dashboard", label: "Console" },
  { to: "/verify", label: "Verify" },
  { to: "/sources", label: "Sources" },
  { to: "/mapping", label: "Mapping" },
  { to: "/onboarding", label: "Onboarding" },
  { to: "/trace", label: "Trace" },
  { to: "/architecture", label: "Architecture" },
];

interface BulkResult {
  medicine_id: string;
  title: string;
  status: string;
  sources_responded: number;
  sources_queried: number;
  fields_resolved: number;
  conflicts: number;
  latency_ms: number;
  run_id: string | null;
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const stats = useQuery(api.registry.stats);
  const sources = useQuery(api.registry.listSources);
  const runs = useQuery(api.runs.history, { limit: 8 });
  const bootstrap = useAction(api.seed.bootstrapDataset);
  const verifyDemoCases = useAction(api.verify.verifyDemoCases);
  const resetOnboarding = useMutation(api.registry.resetOnboarding);
  const [busy, setBusy] = useState<string | null>(null);
  const [bulk, setBulk] = useState<BulkResult[] | null>(null);
  const site = convexSiteUrl();

  const runBulk = async () => {
    setBusy("bulk");
    try {
      const results = (await verifyDemoCases({ site_base: site })) as BulkResult[];
      setBulk(results);
      toast.success("Ran all five demo cases through the mediator");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk run failed");
    } finally {
      setBusy(null);
    }
  };

  const reseed = async (force: boolean) => {
    setBusy("seed");
    try {
      const result = await bootstrap({ force });
      toast.success(force ? "Demo dataset re-seeded" : "Dataset verified as present");
      if (result.inserted) {
        console.info("MEDTRUST seed result", result.inserted);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Seeding failed");
    } finally {
      setBusy(null);
    }
  };

  const resetRegistry = async () => {
    setBusy("reset");
    try {
      await resetOnboarding({ source_id: "state_drug_registry" });
      toast.success("Fifth source reset — onboarding can be demonstrated again");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reset failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Brand />
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:block">{user?.email ?? "guest session"}</span>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                navigate("/");
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6 lg:hidden">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium",
                pathname === item.to
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-accent/60",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 flex flex-col gap-4">
            <nav className="flex flex-col gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    pathname === item.to
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="rounded-xl border border-border/70 bg-card p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Signed in
              </p>
              <p className="mt-1 break-all text-xs text-foreground">{user?.email ?? "anonymous session"}</p>
              <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                The public screens work without an account; this console keeps the demo controls and the run history
                behind sign-in.
              </p>
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-col gap-5">
          <Panel
            eyebrow="Integration console"
            title="Run the whole integration demo from one place"
            description="Re-seed the synthetic dataset, replay every authored demo case through the mediator, and inspect what the source APIs returned."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={runBulk}
                  disabled={busy === "bulk"}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {busy === "bulk" ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                  Run all 5 demo cases
                </button>
                <button
                  type="button"
                  onClick={() => void reseed(true)}
                  disabled={busy === "seed"}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-60"
                >
                  {busy === "seed" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                  Re-seed dataset
                </button>
                <button
                  type="button"
                  onClick={resetRegistry}
                  disabled={busy === "reset"}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-60"
                >
                  {busy === "reset" ? <Loader2 className="size-3.5 animate-spin" /> : <Database className="size-3.5" />}
                  Reset 5th source
                </button>
              </div>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label="Sources"
                value={sources ? `${sources.filter((s) => s.active).length}/${sources.length}` : "—"}
                hint="onboarded / registered"
              />
              <Stat label="Records" value={stats?.total_records ?? "—"} hint="five separate tables" />
              <Stat label="Distinct items" value={stats?.distinct_products ?? "—"} hint="canonical keys" />
              <Stat label="Runs stored" value={stats?.integration_runs ?? "—"} hint="replayable traces" />
            </div>
          </Panel>

          {bulk && (
            <Panel
              eyebrow="Bulk demonstration"
              title="All five demo cases mediated"
              description="Each row was produced by a real mediation request; open the trace screen to replay any of them."
            >
              <div className="overflow-x-auto rounded-lg border border-border/70">
                <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                  <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Item</th>
                      <th className="px-3 py-2 font-semibold">Case</th>
                      <th className="px-3 py-2 font-semibold">Outcome</th>
                      <th className="px-3 py-2 font-semibold">Sources</th>
                      <th className="px-3 py-2 font-semibold">Fields</th>
                      <th className="px-3 py-2 font-semibold">Conflicts</th>
                      <th className="px-3 py-2 font-semibold">Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulk.map((row) => {
                      const meta = statusMeta(row.status);
                      return (
                        <tr key={row.medicine_id} className="border-t border-border/60">
                          <td className="px-3 py-2.5">
                            <Link to={`/verify?id=${row.medicine_id}`} className="font-mono text-xs text-primary hover:underline">
                              {row.medicine_id}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground">{row.title}</td>
                          <td className="px-3 py-2.5">
                            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", TONE_CLASSES[meta.tone])}>
                              {meta.short}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <Mono>
                              {row.sources_responded}/{row.sources_queried}
                            </Mono>
                          </td>
                          <td className="px-3 py-2.5">
                            <Mono>{row.fields_resolved}</Mono>
                          </td>
                          <td className="px-3 py-2.5">
                            <Mono>{row.conflicts}</Mono>
                          </td>
                          <td className="px-3 py-2.5">
                            <Mono>{row.latency_ms}ms</Mono>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel eyebrow="Source systems" title="Registry status" dense>
              <div className="flex flex-col divide-y divide-border/60">
                {(sources ?? []).map((source) => (
                  <div key={source.source_id} className="flex flex-wrap items-center gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold tracking-tight text-foreground">{source.display_name}</p>
                      <Mono className="text-muted-foreground">
                        {source.storage} · {source.record_count} records · {source.accepted_mappings}/
                        {source.mappings.length} columns mapped
                      </Mono>
                    </div>
                    <Pill tone={source.active ? "positive" : "warning"} className="ml-auto">
                      {source.active ? "queried" : "pending"}
                    </Pill>
                  </div>
                ))}
                {!sources && (
                  <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Loading registry…
                  </div>
                )}
              </div>
            </Panel>

            <Panel eyebrow="History" title="Recent mediations" dense>
              <div className="flex flex-col divide-y divide-border/60">
                {(runs ?? []).map((run: RunSummary) => {
                  const meta = statusMeta(run.status);
                  return (
                    <Link
                      key={run.run_id}
                      to="/trace"
                      className="flex flex-wrap items-center gap-2 py-2.5 transition-colors hover:bg-accent/40"
                    >
                      <Chip>{run.medicine_id}</Chip>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", TONE_CLASSES[meta.tone])}>
                        {meta.short}
                      </span>
                      <Mono className="text-muted-foreground">
                        {run.sources_responded}/{run.sources_queried} · {run.latency_ms}ms · {run.transport}
                      </Mono>
                      <span className="ml-auto text-[10.5px] text-muted-foreground">
                        {formatDateTime(run.created_at)}
                      </span>
                    </Link>
                  );
                })}
                {runs && runs.length === 0 && (
                  <p className="py-3 text-xs text-muted-foreground">
                    No mediations yet — run a verification or the bulk demo above.
                  </p>
                )}
              </div>
            </Panel>
          </div>

          <Panel eyebrow="Environment" title="How the console reaches the backend">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/70 bg-muted/30 p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Source API origin
                </p>
                <Mono className="mt-1 block break-all text-foreground">{site ?? "unavailable in this browser"}</Mono>
                <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                  Derived from the deployment URL and passed to the mediator, so source communication happens over
                  real HTTP. Every run records the transport it actually used.
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/30 p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Storage tables
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {Object.entries(stats?.tables ?? {}).map(([table, count]) => (
                    <Chip key={table}>
                      {table}={count}
                    </Chip>
                  ))}
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-[11px] leading-5 text-muted-foreground">
                  <Activity className="size-3.5" />
                  Five independent tables plus the registry — never one merged warehouse.
                </p>
              </div>
            </div>
          </Panel>
        </main>
      </div>
    </div>
  );
}
