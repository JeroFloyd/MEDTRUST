import { AppShell } from "@/components/AppShell";
import { Chip, CopyButton, Mono, Panel, Pill, ScoreBar, Stat } from "@/components/medtrust/primitives";
import { shortSource } from "@/components/medtrust/IntegratedView";
import { api } from "@/convex/_generated/api";
import { convexSiteUrl } from "@/lib/site-url";
import { DEMO_CASES } from "@/lib/demo-cases";
import { statusMeta, type SourceRecord } from "@/lib/medtrust";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  Database,
  GitMerge,
  Landmark,
  Layers,
  Network,
  Search,
  ShieldCheck,
  Store,
  Truck,
  Workflow,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

const PIPELINE = [
  { icon: Search, title: "User", detail: "enters an item / medicine id" },
  { icon: Layers, title: "Web GUI", detail: "verify screen + technical consoles" },
  { icon: Network, title: "Integration hub", detail: "mediator entry point" },
  { icon: Workflow, title: "Query planner", detail: "source selection + decomposition" },
  { icon: GitMerge, title: "Schema mapping layer", detail: "source attributes → canonical" },
  { icon: Database, title: "Source adapters", detail: "HTTP calls to each source API" },
];

const SOURCE_ICONS: Record<string, typeof Building2> = {
  manufacturer: Building2,
  distributor: Truck,
  vendor: Store,
  consumer_affairs: Landmark,
  registry: Landmark,
  third_party: Landmark,
};

const fadeIn = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.45, ease: "easeOut" as const },
};

export default function Landing() {
  const [value, setValue] = useState("");
  const navigate = useNavigate();
  const stats = useQuery(api.registry.stats);
  const sources = useQuery(api.registry.listSources);
  const latest = useQuery(api.runs.latest);
  const latestDetail = useQuery(
    api.runs.detail,
    latest ? { run_id: latest.run_id } : "skip",
  );
  const site = convexSiteUrl();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const id = value.trim() || "MED-10482";
    navigate(`/verify?id=${encodeURIComponent(id)}`);
  };

  const activeSources = sources?.filter((source) => source.active) ?? [];
  const pendingSources = sources?.filter((source) => !source.active) ?? [];
  const sampleMappings = (sources ?? [])
    .flatMap((source) => source.mappings.map((mapping) => ({ source, mapping })))
    .filter((entry) => entry.mapping.canonical_field && entry.mapping.source_field !== "product_id")
    .sort((a, b) => b.mapping.score - a.mapping.score);

  const latestSteps = (() => {
    const trace = latestDetail?.trace as { steps?: Array<{ seq: number; title: string; phase: string; at_ms: number }> } | null;
    return trace?.steps?.slice(0, 6) ?? [];
  })();

  return (
    <AppShell>
      {/* ---------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card">
        <div className="grid-surface pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="pointer-events-none absolute -right-24 -top-32 size-72 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="relative px-5 py-10 sm:px-10 sm:py-14">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="accent">
              <ShieldCheck className="size-3" />
              CSE656 · Information Integration &amp; Applications
            </Pill>
            <Pill>Project 2 — Identification of Asali / Nakali items</Pill>
          </div>

          <h1 className="mt-5 text-4xl font-bold tracking-tight text-foreground sm:text-6xl">MEDTRUST</h1>
          <p className="mt-2 text-lg font-medium tracking-tight text-primary sm:text-xl">
            Adaptive multi-source medicine integration
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
            Verify an item using information from independent source systems. MEDTRUST fans a single query out to a
            manufacturer ERP, a distributor supply-chain register, a retail point-of-sale system, a Consumer Affairs
            complaint register and a state drug registry — then normalises, matches and merges their answers into one
            provenance-tracked view.
          </p>

          <form onSubmit={submit} className="mt-7 flex w-full max-w-xl flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="Enter Medicine / Product ID — e.g. MED-10482"
                className="h-11 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                aria-label="Medicine or product id"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-xs font-bold uppercase tracking-[0.14em] text-primary-foreground transition-opacity hover:opacity-90"
            >
              Verify medicine
              <ArrowRight className="size-4" />
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Demo cases
            </span>
            {DEMO_CASES.map((demoCase) => (
              <button
                key={demoCase.id}
                type="button"
                onClick={() => navigate(`/verify?id=${encodeURIComponent(demoCase.id)}`)}
                className="rounded-md border border-border bg-card px-2 py-1 font-mono text-[11px] text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                {demoCase.id}
              </button>
            ))}
          </div>

          <p className="mt-4 max-w-2xl text-[11px] leading-5 text-muted-foreground">
            Synthetic academic dataset. No real medicine, pharmacy, manufacturer or government record is used and no
            medical claim is made — “verified / suspicious” wording here describes demo source records only.
          </p>
        </div>
      </section>

      {/* -------------------------------------------------------------- stats */}
      <motion.section {...fadeIn} className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Independent sources"
          value={sources ? `${activeSources.length}/${sources.length}` : "—"}
          hint={`${pendingSources.length} pending onboarding`}
        />
        <Stat
          label="Structured records"
          value={stats?.total_records ?? "—"}
          hint={`across ${Object.keys(stats?.tables ?? {}).length} source tables`}
        />
        <Stat
          label="Distinct items"
          value={stats?.distinct_products ?? "—"}
          hint="joined through the canonical identity key"
        />
        <Stat
          label="Mediations run"
          value={stats?.integration_runs ?? "—"}
          hint="every run stores its plan + trace"
        />
      </motion.section>

      {/* ------------------------------------------------------- architecture */}
      <motion.section {...fadeIn} className="mt-6">
        <Panel
          eyebrow="Architecture"
          title="Mediation, not a central table"
          description="Each source keeps its own schema and its own API. The mediator plans the query, calls the source APIs, and builds the unified view at query time — so nothing is silently joined behind the scenes."
          actions={
            <Link
              to="/architecture"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              Full architecture &amp; scope
              <ArrowRight className="size-3.5" />
            </Link>
          }
        >
          <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-6">
            {PIPELINE.map((stage, index) => (
              <div key={stage.title} className="rounded-xl border border-border/70 bg-muted/30 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <stage.icon className="size-3.5" />
                  </span>
                  <Mono className="text-muted-foreground">{String(index + 1).padStart(2, "0")}</Mono>
                </div>
                <p className="mt-2.5 text-xs font-semibold tracking-tight text-foreground">{stage.title}</p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{stage.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Source systems queried over their own APIs
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(sources ?? []).map((source) => {
                  const Icon = SOURCE_ICONS[source.kind] ?? Database;
                  return (
                    <div key={source.source_id} className="rounded-lg border border-border/70 bg-card p-3">
                      <div className="flex items-center gap-2">
                        <Icon className="size-3.5 text-primary" />
                        <span className="text-xs font-semibold tracking-tight text-foreground">
                          {source.display_name}
                        </span>
                        <Pill tone={source.active ? "positive" : "warning"} className="ml-auto">
                          {source.active ? "queried" : "pending"}
                        </Pill>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {source.fields.slice(0, 5).map((field) => (
                          <Chip key={field.name}>{field.name}</Chip>
                        ))}
                        {source.fields.length > 5 && (
                          <span className="text-[11px] text-muted-foreground">
                            +{source.fields.length - 5} more
                          </span>
                        )}
                      </div>
                      <Mono className="mt-2 block text-muted-foreground">
                        {source.record_count} records · {source.accepted_mappings} mappings accepted
                      </Mono>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Result normalization + integration
              </p>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
                <li>
                  <span className="font-medium text-foreground">Normalise</span> — every returned value is converted
                  to the canonical comparable form (dates to ISO, identifiers case/separator insensitive).
                </li>
                <li>
                  <span className="font-medium text-foreground">Match</span> — records are grouped on the canonical
                  identity, and a source’s own identifier convention is trusted and recorded.
                </li>
                <li>
                  <span className="font-medium text-foreground">Merge</span> — fields are combined by source
                  priority; disagreements stay visible instead of being overwritten.
                </li>
                <li>
                  <span className="font-medium text-foreground">Explain</span> — every field keeps its source, raw
                  value and the API call that produced it.
                </li>
              </ul>
            </div>
          </div>
        </Panel>
      </motion.section>

      {/* --------------------------------------------------- schema matching */}
      <motion.section {...fadeIn} className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Panel
          eyebrow="Innovation"
          title="Automatic schema mapping & low-effort source onboarding"
          description="A new source can arrive with unrelated attribute names. The matcher profiles its columns and scores them against the canonical schema with a transparent, deterministic formula."
          actions={
            <Link
              to="/onboarding"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Try the onboarding demo
            </Link>
          }
        >
          <div className="rounded-lg border border-border/70 bg-muted/30 p-3.5">
            <Mono className="text-foreground">
              score = 0.50 · name similarity + 0.20 · datatype compatibility + 0.30 · sample-value evidence
            </Mono>
          </div>
          <div className="mt-3 flex flex-col divide-y divide-border/60">
            {sampleMappings.slice(0, 6).map(({ source, mapping }) => (
              <div
                key={`${source.source_id}-${mapping.source_field}`}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Chip>
                    {source.source_id}.{mapping.source_field}
                  </Chip>
                  <ArrowRight className="size-3 text-muted-foreground" />
                  <Chip className="border-primary/25 bg-primary/10 text-primary">{mapping.canonical_field}</Chip>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-muted-foreground">{shortSource(source.display_name)}</span>
                  <ScoreBar score={mapping.score} />
                </div>
              </div>
            ))}
            {sampleMappings.length === 0 && (
              <p className="py-3 text-xs text-muted-foreground">Waiting for the dataset to be prepared…</p>
            )}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
            The matcher is allowed to fail: columns with no confident candidate stay unmapped and are reported for a
            human to map, which is what keeps the claim honest.
          </p>
        </Panel>

        <Panel
          eyebrow="Explainability"
          title="Integration trace from the latest run"
          description="Every mediation stores what really happened: which sources were planned, what each API returned, what was normalised, and where conflicts were resolved."
          actions={
            <Link
              to="/trace"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              Open trace
            </Link>
          }
        >
          {latest && latestDetail ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Chip>{latest.medicine_id}</Chip>
                <Pill
                  tone={
                    statusMeta(latest.status).tone === "positive"
                      ? "positive"
                      : statusMeta(latest.status).tone === "critical"
                        ? "critical"
                        : statusMeta(latest.status).tone === "warning"
                          ? "warning"
                          : "neutral"
                  }
                >
                  {statusMeta(latest.status).short}
                </Pill>
                <Mono className="text-muted-foreground">
                  {latest.sources_responded}/{latest.sources_queried} sources · {latest.latency_ms}ms ·{" "}
                  {latest.transport}
                </Mono>
              </div>
              <ol className="flex flex-col gap-2">
                {latestSteps.map((step) => (
                  <li key={`${step.seq}`} className="flex items-start gap-2 text-xs leading-5">
                    <Mono className="mt-0.5 w-12 shrink-0 text-muted-foreground">+{step.at_ms}ms</Mono>
                    <span className="text-foreground">{step.title}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No run yet — verify a medicine to generate the first stored trace.
            </p>
          )}
        </Panel>
      </motion.section>

      {/* -------------------------------------------------------- demo cases */}
      <motion.section {...fadeIn} className="mt-6">
        <Panel
          eyebrow="Seeded demonstration"
          title="Five cases the dataset is built to prove"
          description="Each case exercises a different failure mode of integration: full coverage, missing sources, identifier heterogeneity, harmless value conflicts and coverage gaps."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {DEMO_CASES.map((demoCase) => (
              <Link
                key={demoCase.id}
                to={`/verify?id=${encodeURIComponent(demoCase.id)}`}
                className="group rounded-xl border border-border/70 bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <Chip className="border-primary/25 bg-primary/10 text-primary">{demoCase.id}</Chip>
                  <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mt-2.5 text-sm font-semibold tracking-tight text-foreground">{demoCase.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{demoCase.summary}</p>
                <p className="mt-2 text-[11px] leading-5 text-primary">{demoCase.expectation}</p>
              </Link>
            ))}
          </div>
        </Panel>
      </motion.section>

      {/* ------------------------------------------------------------- CTA */}
      <motion.section {...fadeIn} className="mt-6 rounded-2xl border border-border/70 bg-primary/[0.04] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Every rubric item is one screen away
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              Scope and architecture, the five source schemas, matcher scores, the onboarding demo, live API
              endpoints and stored integration traces. The console additionally runs all five demo cases in one
              click for the 5-minute demonstration.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/verify"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-primary-foreground transition-opacity hover:opacity-90"
            >
              Verify a medicine
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
            >
              Integration console
            </Link>
          </div>
        </div>
        {site && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-2">
            <Mono className="text-muted-foreground">Source API index:</Mono>
            <Mono className="truncate text-foreground">{`${site}/api/sources`}</Mono>
            <CopyButton text={`${site}/api/sources`} label="Copy" />
            <a
              href={`${site}/api/sources`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-medium text-primary hover:underline"
            >
              open in a new tab
            </a>
          </div>
        )}
      </motion.section>
    </AppShell>
  );
}
