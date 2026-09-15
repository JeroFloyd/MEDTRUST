import { AppShell } from "@/components/AppShell";
import { Chip, Mono, Panel, Pill } from "@/components/medtrust/primitives";
import { convexSiteUrl } from "@/lib/site-url";
import { ExternalLink } from "lucide-react";
import { Link } from "react-router";

const LAYERS = [
  { title: "Web GUI", body: "Verify screen, source registry, mapping console, onboarding and trace replay." },
  { title: "Integration hub (mediator)", body: "Entry point for every request. Canonicalises the identifier and owns the answer." },
  { title: "Query planner / source selector", body: "Decides which sources have an accepted identity mapping and translates the request per source." },
  { title: "Schema mapping layer", body: "Applies accepted source→canonical mappings and normalises each returned value." },
  { title: "Source adapters", body: "HTTP GET against each source API; records transport, status, latency and payload." },
  { title: "Independent source systems", body: "Manufacturer ERP, distributor supply chain, vendor point of sale, Consumer Affairs, state drug registry." },
  { title: "Result normalisation + integration", body: "Entity matching on the canonical key, merge by source priority, conflict retention." },
  { title: "Unified medicine view", body: "One integrated record with per-field provenance and an integration trace." },
];

const SOURCE_ATTRIBUTES = [
  { source: "Manufacturer", attributes: "product_code · product_name · company · batch_no · manufacture_date · expiry_date" },
  { source: "Distributor", attributes: "item_id · medicine · supplier · batch_number · procured_on · vendor_name · quantity" },
  { source: "Vendor", attributes: "barcode · item · seller · batch · received_on · selling_price" },
  { source: "Consumer Affairs", attributes: "product_id · complaint_type · complaint_date · status · remarks" },
  { source: "State drug registry", attributes: "sku · drug_name · maker · lot · license_no" },
];

const RUBRIC = [
  { item: "1 · Scope of work", where: "This page — scope, in/out of scope", how: "Read the scope panel; the project is bounded to structured, synthetic, multi-source integration." },
  { item: "2 · New / innovative aspect", where: "/onboarding", how: "Automatic schema mapping with score breakdowns and low-effort onboarding of an unmodelled source." },
  { item: "3 · Database schema design", where: "/sources", how: "Five independent schemas with deliberately different attribute names and datatypes." },
  { item: "4 · Populated data", where: "/sources · /dashboard", how: "146 synthetic records, seeded patterns incl. missing rows and formatting differences." },
  { item: "5 · Schema matching / mapping (+ APIs)", where: "/mapping · /sources", how: "Accepted mappings with matcher scores, and a source API per system." },
  { item: "6 · Query decomposition / federation", where: "/verify", how: "The decomposition table shows the per-source predicate derived from one identifier." },
  { item: "7 · Communication between sources", where: "/verify · /trace", how: "Real HTTP calls with status, latency, transport and the raw payload per source." },
  { item: "8 · Integrated results + GUI", where: "/verify", how: "One integrated medicine view with source badges, provenance, conflicts and trace." },
];

const ENDPOINTS = [
  { method: "GET", path: "/api/health", note: "service status + storage counts" },
  { method: "GET", path: "/api/sources", note: "index of every source system and its endpoints" },
  { method: "GET", path: "/api/sources/{source_id}/schema", note: "the source's own schema, profiled attributes and identity column" },
  { method: "GET", path: "/api/sources/{source_id}/items?limit=10", note: "raw records with the source's attribute names" },
  { method: "GET", path: "/api/sources/{source_id}/item/{medicine_id}", note: "resolve one record; reports the lookup strategy used" },
];

const DEMO_SCRIPT = [
  "Open MEDTRUST and state the problem: one item id, four to five independent systems, no shared model.",
  "Show /sources: each system has its own table, own attribute names, own API.",
  "Show /mapping: canonical schema, accepted mappings and matcher scores with breakdowns.",
  "Open /onboarding: profile the pending registry (sku / drug_name / maker / lot), accept mappings, onboard it.",
  "Verify MED-10482 on /verify and watch the plan and trace fan out to the source APIs.",
  "Expand a field: raw value per source, which source won, where values differed.",
  "Open the skipped-source note for the not-yet-onboarded registry before activation.",
  "Open /trace: replay the stored run, same steps and same merged view.",
  "Run MED-10233 (missing vendor record + open complaint) and MED-10875 (identifier written four ways).",
  "Run MED-10590 to show harmless conflicts retained in provenance.",
  "Finally /dashboard: run all five demo cases in one click and show the recorded summary table.",
];

export default function Architecture() {
  const site = convexSiteUrl();
  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <Panel
          eyebrow="Rubric 1 · Scope of work"
          title="What this system is, and what it deliberately is not"
          description="Project 2 of CSE656: an information integration system for identifying whether a purchased item is asali or nakali, by integrating its history across independent source systems."
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
              <p className="text-xs font-semibold tracking-tight text-foreground">In scope</p>
              <ul className="mt-2 space-y-1.5 text-xs leading-5 text-muted-foreground">
                <li>• Five independent structured sources, each with its own schema and API.</li>
                <li>• Schema profiling, candidate matching with scores, human acceptance.</li>
                <li>• Mediator with query planning, decomposition, fan-out and error handling.</li>
                <li>• Normalisation, entity matching, merge by source priority, provenance.</li>
                <li>• GUI for verification, sources, mappings, onboarding and trace replay.</li>
                <li>• Synthetic dataset designed to exercise coverage gaps and value conflicts.</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
              <p className="text-xs font-semibold tracking-tight text-foreground">Out of scope (Project A boundaries)</p>
              <ul className="mt-2 space-y-1.5 text-xs leading-5 text-muted-foreground">
                <li>• No machine-learned counterfeit classifier — Part B handles uncertainty reasoning.</li>
                <li>• No real pharmaceutical, government, hospital or pharmacy API and no scraping.</li>
                <li>• No blockchain, no medical advice, no diagnosis, no claims about real medicines.</li>
                <li>• No single master table: sources are never merged into one physical store.</li>
                <li>• No hand-written jointure standing in for the integration layer.</li>
              </ul>
            </div>
          </div>
        </Panel>

        <Panel
          eyebrow="Architecture"
          title="Conceptual layer stack"
          description="Mediation / virtual integration: the unified view does not exist until a request is planned and answered."
        >
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {LAYERS.map((layer, index) => (
              <div key={layer.title} className="rounded-lg border border-border/70 bg-card p-3.5">
                <div className="flex items-center justify-between">
                  <Mono className="text-muted-foreground">{String(index + 1).padStart(2, "0")}</Mono>
                  <Pill>{index < 5 ? "layer" : index < 6 ? "systems" : "result"}</Pill>
                </div>
                <p className="mt-2 text-xs font-semibold tracking-tight text-foreground">{layer.title}</p>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{layer.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-border/70 bg-muted/30 p-4">
            <Mono className="text-foreground">
              USER → WEB GUI → INTEGRATION HUB → QUERY PLANNER → SCHEMA MAPPING → SOURCE APIs → NORMALISATION →
              MATCHING → MERGE → UNIFIED VIEW + PROVENANCE
            </Mono>
          </div>
        </Panel>

        <Panel
          eyebrow="Rubric coverage"
          title="Where each rubric item lives, and how to show it"
          description="The eight evaluation areas of Project A, mapped to screens and artefacts."
        >
          <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Rubric item</th>
                  <th className="px-3 py-2 font-semibold">Where</th>
                  <th className="px-3 py-2 font-semibold">What to look at</th>
                </tr>
              </thead>
              <tbody>
                {RUBRIC.map((row) => (
                  <tr key={row.item} className="border-t border-border/60 align-top">
                    <td className="px-3 py-2.5 text-xs font-medium text-foreground">{row.item}</td>
                    <td className="px-3 py-2.5">
                      <Mono className="text-primary">{row.where}</Mono>
                    </td>
                    <td className="px-3 py-2.5 text-xs leading-5 text-muted-foreground">{row.how}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          eyebrow="Data sources"
          title="Same concepts, different attribute names"
          description="This heterogeneity is the reason schema matching exists: the mediator never assumes a shared vocabulary."
        >
          <div className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/70">
            {SOURCE_ATTRIBUTES.map((row) => (
              <div key={row.source} className="grid gap-1.5 px-3 py-2.5 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
                <p className="text-xs font-semibold tracking-tight text-foreground">{row.source}</p>
                <div className="flex flex-wrap gap-1">
                  {row.attributes.split(" · ").map((attribute) => (
                    <Chip key={attribute}>{attribute}</Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          eyebrow="API reference"
          title="Source API surface"
          description="Each source is independently queryable. The mediator consumes exactly these routes; a TA can curl them without the GUI."
          actions={
            site ? (
              <a
                href={`${site}/api/sources`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <ExternalLink className="size-3.5" />
                Open API index
              </a>
            ) : null
          }
        >
          <div className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/70">
            {ENDPOINTS.map((endpoint) => (
              <div key={endpoint.path} className="grid gap-1.5 px-3 py-2.5 sm:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
                <div className="flex items-center gap-2">
                  <Pill tone="accent">{endpoint.method}</Pill>
                  <Mono className="text-foreground">{endpoint.path}</Mono>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">{endpoint.note}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
            Responses are JSON. A lookup reports the field it used, the strategy (index hit, normalised scan or
            source-local prefix resolution) and the source's own raw attribute names.
          </p>
        </Panel>

        <Panel
          eyebrow="Implementation"
          title="How the components communicate"
          description="Frontend on Vite + React; backend on Convex. The source APIs are Convex HTTP endpoints, and the mediator is a Convex action that calls them over HTTP."
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
              <p className="text-xs font-semibold tracking-tight text-foreground">Request path</p>
              <ol className="mt-2 space-y-1.5 text-xs leading-5 text-muted-foreground">
                <li>1 · The GUI calls the <Mono>verify.verifyMedicine</Mono> action with the identifier.</li>
                <li>2 · The mediator reads the source registry (which sources may answer).</li>
                <li>3 · For each source it issues a real HTTP GET to <Mono>/api/sources/…/item/…</Mono>.</li>
                <li>4 · Convex HTTP actions resolve the record inside that source's own storage.</li>
                <li>5 · The mediator normalises, matches, merges and stores the run record.</li>
                <li>6 · The unified view plus trace returns to the GUI in one response.</li>
              </ol>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
              <p className="text-xs font-semibold tracking-tight text-foreground">Deployment notes</p>
              <ul className="mt-2 space-y-1.5 text-xs leading-5 text-muted-foreground">
                <li>• The static frontend is deployment-friendly (any static host, including Vercel).</li>
                <li>• The backend, source storage and mediation run as a Convex deployment.</li>
                <li>• The site origin for the source APIs is derived from the deployment URL at runtime, so source
                  communication works without hand-configured URLs.</li>
                <li>• If a deployment cannot reach its own HTTP surface, the adapter falls back to invoking the same
                  handler in-process and the trace records the transport honestly.</li>
                <li>• Database and per-source storage stay separate: five tables, no shared warehouse.</li>
              </ul>
            </div>
          </div>
        </Panel>

        <Panel
          eyebrow="Demonstration"
          title="Five-minute demo script"
          description="Eleven steps that touch every rubric item without leaving the application."
        >
          <ol className="grid gap-2 text-xs leading-5 text-muted-foreground sm:grid-cols-2">
            {DEMO_SCRIPT.map((step, index) => (
              <li key={step} className="flex gap-2">
                <Mono className="text-primary">{String(index + 1).padStart(2, "0")}</Mono>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/verify"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-primary-foreground transition-opacity hover:opacity-90"
            >
              Start with a verification
            </Link>
            <Link
              to="/onboarding"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
            >
              Onboarding demo
            </Link>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
