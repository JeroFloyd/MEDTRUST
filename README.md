# MEDTRUST — Adaptive Multi-Source Medicine Integration

**Project 2 · Identification of Asali or Nakali Items**
Course: **CSE656 Information Integration and Applications (IIA)**, IIIT Delhi
Target: **Project A — Traditional Data Integration**

A user is about to purchase a medicine and wants an *integrated* view of that item's history: whether the
record looks genuine or suspicious, when it was procured, who supplied and distributed it, what the retail
system recorded, and whether Consumer Affairs has an open complaint.

MEDTRUST answers that question by mediating across **five independent source systems**, each with its own
schema and its own API. The unified view does not exist anywhere in storage: it is planned, decomposed,
fetched, normalised, matched and merged at query time, and every field keeps the source it came from.

> **Synthetic data only.** No real medicine, manufacturer, distributor, chemist, government register or
> pharmaceutical API is used. No medical claim or diagnosis is made. A small amount of neutral terminology
> (e.g. "Paracetamol 500mg") is used purely as a label in demo records.

---

## 1. Scope of work (rubric 1)

In scope:

* Five independent structured sources with deliberately different attribute names and datatypes.
* Schema profiling, candidate matching with explainable scores, human acceptance, and onboarding of a source
  whose schema was never modelled in advance.
* A mediator with query planning, source selection, per-source query decomposition, fan-out over HTTP,
  error handling, result normalisation, entity matching, merge by source priority, provenance and tracing.
* A GUI that demonstrates all of it: verification, source registry, mapping console, onboarding, trace replay.

Out of scope for Project A (deliberately):

* Machine-learned counterfeit detection / uncertainty scoring (that is the Project B stage).
* Real pharmaceutical, hospital, pharmacy, government or scraping-based data sources.
* Blockchain, medical advice, diagnosis, or claims about real medicines.
* Any single merged master table standing in for the integration layer.

---

## 2. Architecture (rubric 6, 7)

```
                  USER
                    │  (medicine / product id)
                    ▼
                 WEB GUI                     src/pages/Verify.tsx
                    │  verify.verifyMedicine (Convex action)
                    ▼
        INTEGRATION HUB / MEDIATOR           src/convex/integration/mediator.ts
                    │
                    ▼
     QUERY PLANNER / SOURCE SELECTOR         active sources with an accepted identity mapping
                    │
                    ▼
          SCHEMA MAPPING LAYER              src/convex/integration/schemaMatching.ts + registry mappings
                    │
                    ▼
            SOURCE ADAPTERS                 src/convex/integration/adapters.ts
                    │  real HTTP GET
                    ▼
 ┌──────────────┬──────────────┬──────────────┬─────────────────┬──────────────────────┐
 │ Manufacturer │ Distributor  │ Vendor POS   │ Consumer Affairs│ State drug registry  │
 │ src_manufac- │ src_distrib- │ src_vendor   │ src_consumer_   │ src_dynamic          │
 │ turer        │ utor         │              │ affairs         │ (dynamic onboarding) │
 └──────────────┴──────────────┴──────────────┴─────────────────┴──────────────────────┘
                    │  /api/sources/<id>/item/<key>  (Convex HTTP actions)
                    ▼
        RESULT NORMALISATION + INTEGRATION
                    ▼
   UNIFIED MEDICINE VIEW + SOURCE PROVENANCE  +  INTEGRATION TRACE
```

The mediator never reads a source table: it calls each source's HTTP API. Records return with the source's
**own** attribute names (`product_code`, `item_id`, `barcode`, `product_id`, `sku`), and the mediator is the
only component that maps them onto the canonical schema.

### Transport honesty

* Primary transport is a real HTTP `GET` to `<deployment site origin>/api/sources/...`.
* The site origin is resolved from `CONVEX_SITE_URL`, from `CONVEX_CLOUD_URL` (`.convex.cloud` →
  `.convex.site`), or from the browser (`VITE_CONVEX_URL`), in that order.
* If a deployment cannot reach its own HTTP surface, the adapter invokes the **same handler** in-process and
  the trace records `transport: in-process` plus the failed attempts. Nothing is faked; the trace shows which
  transport produced each response.

---

## 3. Independent source systems (rubric 3, 4)

| # | Source | Storage table | Own schema (attribute names as stored) | Priority |
|---|--------|---------------|----------------------------------------|----------|
| 1 | Manufacturer ERP | `src_manufacturer` | `product_code`, `product_name`, `company`, `batch_no`, `manufacture_date`, `expiry_date` | 1 |
| 2 | Distributor Supply Chain | `src_distributor` | `item_id`, `medicine`, `supplier`, `batch_number`, `procured_on`, `vendor_name`, `quantity` | 2 |
| 3 | Vendor Point of Sale | `src_vendor` | `barcode`, `item`, `seller`, `batch`, `received_on`, `selling_price` | 3 |
| 4 | Consumer Affairs Complaints | `src_consumer_affairs` | `product_id`, `complaint_type`, `complaint_date`, `status`, `remarks` | 4 |
| 5 | State Drug Control Registry | `src_dynamic` | `sku`, `drug_name`, `maker`, `lot`, `license_no` | 5 |

Seeded volume: **44 distinct items**, **146 records**

| Table | Records |
|---|---|
| `src_manufacturer` | 43 |
| `src_distributor` | 40 |
| `src_vendor` | 38 |
| `src_consumer_affairs` | 8 |
| `src_dynamic` | 17 |

The dataset is generated by `src/convex/data/dataset.ts` (deterministic; no randomness between runs) and is
intentionally imperfect:

* rows missing from a source (coverage gaps),
* identifiers written as `MED-10875`, `MED 10875`, `med10875-KM`, `MED10875`,
* batch values as `B1152`, `b-1152 `, `B 1152`,
* dates in three formats (`2026-06-12`, `18/06/2026`, `19 Jun 2026`),
* vendor barcodes that embed a retail outlet suffix,
* a sparse complaint register where the absence of a row means "no complaint".

---

## 4. Automatic schema mapping (rubric 2 — the innovation)

`src/convex/integration/schemaMatching.ts` implements a deterministic, explainable matcher:

```
score = 0.50 · attribute-name similarity
      + 0.20 · datatype compatibility
      + 0.30 · sample-value compatibility
```

* **Name similarity** — registered synonyms (an explicit alias catalogue per canonical field), concept-token
  overlap, and edit distance. Generic synonyms such as `id` or `item` score lower than specific ones such as
  `product_code` or `barcode`, because they really are less certain.
* **Datatype compatibility** — a table over the profiled source type (`identifier`, `text`, `date`, `number`)
  versus the canonical type; type conflicts are surfaced as warnings.
* **Sample-value compatibility** — date parse rate, numeric detection, identifier format matching and overlap
  with canonical values actually observed in the dataset.

Acceptance threshold `0.65`; a runner-up within `0.08` marks the proposal *ambiguous*. The matcher is allowed
to fail: columns with no confident candidate stay out of the integration and are reported for a human, which
is what keeps the claim realistic instead of "it understands any database".

Every accepted mapping stores its score breakdown, its origin (`matcher`, `matcher-accepted`, `manual`,
`rejected`) and its reasoning string, all visible on `/mapping`.

---

## 5. Mediator behaviour (rubric 6, 7, 8)

`src/convex/integration/mediator.ts` performs, per request:

1. **Canonicalise** the identifier (`MED 10875` → `MED10875`).
2. **Select sources** from the registry: only sources that are onboarded *and* have an accepted `medicine_id`
   mapping are queried; everyone else is recorded as skipped with a reason.
3. **Decompose** into one predicate per source using that source's own identity column
   (`product_code eq 'MED-10482'`, `barcode eq '…'`, …).
4. **Fan out** in parallel over real HTTP, logging status, latency, bytes, transport and payload per source.
5. **Normalise** every returned value through the accepted mappings (dates → ISO, identifiers case/separator
   insensitive, organisations without legal suffixes, prices numeric).
6. **Match** records on the canonical identity. When a source resolves its own identifier convention
   (retail barcode with an outlet suffix), that resolution is trusted *and* recorded.
7. **Merge** field by field: highest-priority source wins, agreements are counted, disagreements are retained
   as alternatives instead of being silently overwritten.
8. **Store** the run (plan + trace + integrated result) in `integration_runs` for `/trace`.
9. **Respond** with a status:
   * `verified` — 3+ sources held a matching record and no open complaint;
   * `suspicious` — an open / under-investigation complaint exists in the demo register;
   * `partial` — fewer than 3 sources held a record (coverage gaps reported);
   * `not_found` — no source returned a record.

Failure handling: a source that errors or times out is reported in the trace and excluded from the merge; the
request still returns an integrated result built from the sources that answered.

---

## 6. Source APIs (rubric 5)

Registered in `src/convex/http.ts`, implemented in `src/convex/sources/api.ts`.

```
GET /api/health                                  service status + storage counts
GET /api/sources                                 index of every source system
GET /api/sources/<source_id>/schema              the source's own schema + identity column
GET /api/sources/<source_id>/items?limit=10      raw records (source attribute names)
GET /api/sources/<source_id>/item/<medicine_id>  resolve one record
```

`source_id` is one of `manufacturer`, `distributor`, `vendor`, `consumer_affairs`, `state_drug_registry`, or
any source registered at runtime through the onboarding screen.

A lookup reports how the source answered:

```json
{
  "query": {
    "lookup_field": "barcode",
    "lookup_value": "med10875-KM",
    "lookup_normalized": "MED10875KM",
    "strategy": "normalized_scan"   // index | normalized_scan | prefix_scan | miss
  },
  "records": [ { "barcode": "med10875-KM", "...": "..." } ]
}
```

Strategies: `index` (raw index hit), `normalized_scan` (case/separator-insensitive scan), `prefix_scan`
(source-local identifier carries a suffix), `miss` (404 with an explanation).

---

## 7. Screens

| Route | Purpose | Rubric |
|---|---|---|
| `/` | Landing page: problem, architecture, live mapping scores, latest trace, demo cases | 1, 2, 8 |
| `/verify` | Integrated medicine view, provenance, query plan, integration trace, raw source payloads | 6, 7, 8 |
| `/sources` | The five independent systems, their schemas, record counts and live API endpoints | 3, 4, 5 |
| `/mapping` | Canonical schema, matcher formula, mapping matrix, per-column accepted/rejected state | 5 |
| `/onboarding` | Profile a pending source, accept/reject/override proposals, register a pasted schema, onboard it | 2 |
| `/trace` | Stored run history with full replay of the plan, calls, normalisation and merged view | 6, 7 |
| `/architecture` | Scope of work, layer stack, rubric map, API reference, deployment notes, demo script | 1 |
| `/dashboard` | Authenticated console: re-seed the dataset, run all five demo cases, registry and run status | — |
| `/auth` | Email OTP / guest sign-in (Convex Auth); protected routes use `RequireAuth` | — |

The public demonstration screens work without an account; only the console requires sign-in.

---

## 8. Demo cases in the seeded data

| Case | Identifier | What it proves |
|---|---|---|
| 1 | `MED-10482` | Present in all sources with consistent values (plus the registry once onboarded) |
| 2 | `MED-10233` | Missing from the vendor POS, and an open counterfeit-packaging complaint exists |
| 3 | `MED-10875` | Identifier written four different ways; every source still resolves |
| 4 | `MED-10590` | Harmless inconsistencies (batch formatting, dosage-form wording) matched on the normalised key |
| 5 | `MED-10027` | Coverage gap: distributed and sold, but no manufacturing record |

A sixth synthetic medicine ID that exists nowhere returns `not_found` with the skipped-source reasoning.

**Demo script (≈5 minutes)** — also listed on `/architecture`:

1. Open MEDTRUST and state the problem: one item, five independent systems, no shared model.
2. `/sources`: five separate tables, five attribute vocabularies, five APIs.
3. `/mapping`: canonical schema, accepted mappings, matcher scores and breakdowns.
4. `/onboarding`: profile the pending registry (`sku` / `drug_name` / `maker` / `lot`), accept the proposals,
   onboard it.
5. `/verify` with `MED-10482`: watch the plan, the per-source predicates and the trace.
6. Expand a field to show the raw value per source, the winner and the retained disagreements.
7. Point out the skipped source note before activation (and its absence afterwards).
8. `/trace`: replay the stored run.
9. Run `MED-10233` (missing record + open complaint) and `MED-10875` (identifier heterogeneity).
10. Run `MED-10590` to show conflicts kept in provenance.
11. `/dashboard`: run all five demo cases in one click and show the summary table.

---

## 9. Running it locally

The project runs on **Bun** with a **Vite + React 19 + Tailwind v4 + shadcn/ui** frontend and a **Convex**
backend (source storage, source APIs, mediator, run history).

```bash
bun install

# 1. Convex dev deployment (generates src/convex/_generated and serves the source APIs)
bunx convex dev --once       # one-shot codegen
bunx convex dev              # long-running dev watcher

# 2. Frontend dev server
bun run dev                  # Vite on http://localhost:5173

# typecheck
bun tsc -b --noEmit
```

Environment:

| Variable | Where | Purpose |
|---|---|---|
| `VITE_CONVEX_URL` | frontend (`.env`) | Convex deployment URL; the site origin for the source APIs is derived from it (`.convex.cloud` → `.convex.site`) |
| `CONVEX_SITE_URL` / `CONVEX_CLOUD_URL` | Convex deployment | alternative way for the mediator to resolve the source API origin |
| `SITE_URL` | Convex deployment | required by Convex Auth |

The first page load seeds the dataset automatically (`seed.bootstrapDataset`, idempotent). Use the console's
**Re-seed dataset** button to rebuild it, or call it directly:

```bash
bunx convex run seed:bootstrapDataset '{"force":true}'
bunx convex run verify:verifyMedicine '{"medicine_id":"MED-10482"}'
bunx convex run verify:verifyDemoCases '{}'
```

### Inspecting the source APIs without the GUI

```bash
curl <site-url>/api/health
curl <site-url>/api/sources
curl <site-url>/api/sources/manufacturer/schema
curl <site-url>/api/sources/manufacturer/item/MED-10482
curl "<site-url>/api/sources/vendor/items?limit=5"
```

### Deployment notes

* The frontend is a static Vite build and deploys to any static host, including Vercel. Set `VITE_CONVEX_URL`
  in the host's environment variables.
* The backend — source storage, source APIs, mediator and run history — is a Convex deployment, which is what
  keeps the source APIs and the mediator as real backend components rather than mock data.
* The database is not collapsed for deployment convenience: the five source tables exist independently and are
  only ever reached through their APIs.

---

## 10. Code map

```
src/convex/
  schema.ts                      5 independent source tables, source_registry, integration_runs
  data/dataset.ts                deterministic synthetic dataset + authored demo cases + known values
  integration/canonical.ts       canonical schema, synonyms, value normalisation + display formatting
  integration/schemaMatching.ts  profiler + matcher (name / datatype / sample scores, thresholds)
  integration/adapters.ts        source API adapter: HTTP transport, in-process fallback, call logging
  integration/mediator.ts        integration hub: planning, fan-out, normalisation, matching, merge, trace
  sources/readers.ts             per-source storage access (index / normalised scan / prefix resolution)
  sources/api.ts                 source API implementation (schema, items, item)
  http.ts                        HTTP route registration for the source APIs
  registry.ts                    source registry queries + onboarding mutations
  seed.ts                        dataset seeding + registry bootstrap
  verify.ts                      public actions (single verification, bulk demo cases)
  runs.ts                        stored run history, replay queries

src/pages/                       Landing, Verify, Sources, Mapping, Onboarding, Trace, Architecture, Dashboard, Auth
src/components/medtrust/         provenance grid, trace timeline, schema/mapping tables, API response panel
src/components/DatasetGate.tsx   prepares the demo dataset on first load
```

---

## 11. Project A rubric checklist

1. **Scope of work** — `/architecture` (in-scope / out-of-scope panels).
2. **New / innovative aspect** — automatic schema mapping and low-effort onboarding, `/onboarding` + matcher.
3. **Database schema design** — five independent schemas on `/sources`, `src/convex/schema.ts`.
4. **Populated data** — 146 synthetic records seeded by `src/convex/data/dataset.ts`, counts on `/sources`.
5. **Schema matching / mapping + APIs** — mapping matrix and scores on `/mapping`, live APIs documented on
   `/sources` and `/architecture`.
6. **Query decomposition / federation** — decomposition table and source-selection table on `/verify`.
7. **Communication between data sources** — per-source API calls with status, latency, transport and raw
   payload on `/verify`, replayed on `/trace`.
8. **Integrated results + GUI** — one integrated medicine view with per-field provenance and conflict handling
   on `/verify`.
