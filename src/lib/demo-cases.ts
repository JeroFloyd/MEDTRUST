/** Presentation copy for the five authored demo cases (mirrors convex/data/dataset.ts). */
export interface DemoCase {
  id: string;
  title: string;
  summary: string;
  expectation: string;
}

export const DEMO_CASES: DemoCase[] = [
  {
    id: "MED-10482",
    title: "Case 1 · present in every source",
    summary: "Paracetamol 500mg recorded by the manufacturer, distributor, vendor and the drug registry with consistent identity values.",
    expectation: "4 source APIs answer, the merged batch / supplier / vendor values agree, no complaint on record.",
  },
  {
    id: "MED-10233",
    title: "Case 2 · missing from one source",
    summary: "The retail point-of-sale system never received this batch, and an open counterfeit packaging complaint exists.",
    expectation: "Partial coverage is reported, the open complaint is surfaced, and no vendor record is invented.",
  },
  {
    id: "MED-10875",
    title: "Case 3 · identifier written four ways",
    summary: "MED-10875, MED 10875, med10875-KM and MED10875 — one product, four source conventions.",
    expectation: "Every source still resolves; the trace shows each normalization and the source-local barcode convention.",
  },
  {
    id: "MED-10590",
    title: "Case 4 · harmless inconsistencies",
    summary: "Batch written as B1152, 'b-1152 ' and 'B 1152', plus a resolved labelling complaint.",
    expectation: "Records match on the normalized identity and the differing raw values stay visible in the provenance.",
  },
  {
    id: "MED-10027",
    title: "Case 5 · coverage gap",
    summary: "Distributed and sold, but no manufacturing record exists in the manufacturer source.",
    expectation: "Integration completes with the sources that do hold the product and reports the gap.",
  },
];
