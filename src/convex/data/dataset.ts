/**
 * SYNTHETIC DATASET
 * ---------------------------------------------------------------------------
 * Every record in this system is generated demo data for the CSE656 project.
 * No real medicine, company, pharmacy or government record is used, and no
 * medical claim is made anywhere in this project.
 *
 * The four source systems are populated independently, each with its own
 * attribute names, value formats and coverage gaps. Five cases are authored
 * explicitly so a TA can reproduce them:
 *
 *   CASE 1  MED-10482  present in every source, consistent values
 *   CASE 2  MED-10233  missing from the vendor source, open complaint
 *   CASE 3  MED-10875  identifier written differently in every source
 *   CASE 4  MED-10590  values that differ harmlessly (batch, price-like noise)
 *   CASE 5  MED-10027  coverage gap: no manufacturer record at all
 */

export interface ManufacturerRow {
  product_code: string;
  product_name: string;
  company: string;
  batch_no: string;
  manufacture_date: string;
  expiry_date: string;
}

export interface DistributorRow {
  item_id: string;
  medicine: string;
  supplier: string;
  batch_number: string;
  procured_on: string;
  vendor_name: string;
  quantity: number;
}

export interface VendorRow {
  barcode: string;
  item: string;
  seller: string;
  batch: string;
  received_on: string;
  selling_price: number;
}

export interface ConsumerAffairsRow {
  product_id: string;
  complaint_type: string;
  complaint_date: string;
  status: string;
  remarks: string;
}

/** Fifth source: a state drug-control registry with a completely different schema. */
export interface CentralRegistryRow {
  sku: string;
  drug_name: string;
  maker: string;
  lot: string;
  license_no: string;
}

export interface Dataset {
  manufacturer: ManufacturerRow[];
  distributor: DistributorRow[];
  vendor: VendorRow[];
  consumer: ConsumerAffairsRow[];
  central_registry: CentralRegistryRow[];
}

export interface DemoCase {
  id: string;
  title: string;
  description: string;
  expectation: string;
  seed_notes: string;
}

export const DEMO_CASES: DemoCase[] = [
  {
    id: "MED-10482",
    title: "Case 1 — present in every source",
    description:
      "Paracetamol 500mg recorded by the manufacturer, distributor, vendor and the registry with consistent identity values.",
    expectation: "All participating sources answer and the merged batch / supplier / vendor values agree.",
    seed_notes: "No Consumer Affairs complaint on record for this product.",
  },
  {
    id: "MED-10233",
    title: "Case 2 — missing from one source",
    description:
      "The vendor point-of-sale system has no barcode for this product, while an open counterfeit packaging complaint exists.",
    expectation: "Mediator reports partial coverage and the open complaint, without inventing a vendor record.",
    seed_notes: "Consumer Affairs status is still 'Under investigation'.",
  },
  {
    id: "MED-10875",
    title: "Case 3 — same medicine, different identifier formats",
    description:
      "Written as MED-10875, MED 10875, med10875-KM and MED10875 across the four sources.",
    expectation: "Every source still resolves, and the trace shows each source's own normalisation step.",
    seed_notes: "Vendor barcode carries a retail outlet suffix.",
  },
  {
    id: "MED-10590",
    title: "Case 4 — harmless value inconsistencies",
    description:
      "Batch written as B1152, 'b-1152 ' and 'B 1152'; the vendor pack description adds a dosage-form word.",
    expectation: "Records match on the normalised identity and the differing raw values stay visible in provenance.",
    seed_notes: "A resolved labelling complaint exists in Consumer Affairs.",
  },
  {
    id: "MED-10027",
    title: "Case 5 — coverage gap",
    description: "Sold and distributed, but the manufacturer source has no production record for it.",
    expectation: "Integration succeeds with the sources that do hold the product and reports the gap.",
    seed_notes: "Distributor and vendor records only.",
  },
];

/* -------------------------------------------------------------------------- */
/* Deterministic generators                                                   */
/* -------------------------------------------------------------------------- */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: T[], seed: number): T {
  const r = mulberry32(seed)();
  return items[Math.floor(r * items.length) % items.length];
}

const COMPANIES = [
  "Kaveri Pharma Ltd",
  "Sunveda Biotech Pvt Ltd",
  "Aravalli Life Sciences Ltd",
  "Trident Healthcare Pvt Ltd",
  "Blueleaf Remedies Ltd",
  "Deccan Formulations Pvt Ltd",
  "Northline Pharma Ltd",
  "Vasudha Mediscience Ltd",
];

const DISTRIBUTORS = [
  "XYZ Distributors",
  "Medilink Supply Chain Pvt Ltd",
  "Aarogya Wholesale Traders",
  "Sanjeevani Distributors",
  "Sparsh Medical Agencies",
];

const VENDORS = [
  "Kumar Medicals",
  "Sharma Chemist",
  "Wellness Pharmacy",
  "Jeevan Medical Store",
  "Apna Medicos",
  "CarePoint Chemist",
  "Nirmal Medicals",
  "Sehat Pharmacy",
];

const VENDOR_SUFFIX: Record<string, string> = {
  "Kumar Medicals": "KM",
  "Sharma Chemist": "SC",
  "Wellness Pharmacy": "WP",
  "Jeevan Medical Store": "JM",
  "Apna Medicos": "AM",
  "CarePoint Chemist": "CC",
  "Nirmal Medicals": "NM",
  "Sehat Pharmacy": "SP",
};

const MOLECULES: Array<{ name: string; strengths: string[] }> = [
  { name: "Paracetamol", strengths: ["500mg", "650mg"] },
  { name: "Amoxicillin", strengths: ["250mg", "500mg"] },
  { name: "Metformin", strengths: ["500mg", "850mg"] },
  { name: "Azithromycin", strengths: ["250mg", "500mg"] },
  { name: "Cetirizine", strengths: ["5mg", "10mg"] },
  { name: "Pantoprazole", strengths: ["20mg", "40mg"] },
  { name: "Ambroxol", strengths: ["30mg"] },
  { name: "Ondansetron", strengths: ["4mg", "8mg"] },
  { name: "Levothyroxine", strengths: ["25mcg", "50mcg"] },
  { name: "Montelukast", strengths: ["5mg", "10mg"] },
  { name: "Cefixime", strengths: ["100mg", "200mg"] },
  { name: "Ibuprofen", strengths: ["200mg", "400mg"] },
  { name: "Ranitidine", strengths: ["150mg"] },
  { name: "Amlodipine", strengths: ["2.5mg", "5mg"] },
  { name: "Losartan", strengths: ["25mg", "50mg"] },
  { name: "Doxycycline", strengths: ["100mg"] },
  { name: "Fluconazole", strengths: ["150mg"] },
  { name: "Vitamin D3", strengths: ["60000IU"] },
  { name: "Ferrous Ascorbate", strengths: ["100mg"] },
  { name: "Salbutamol", strengths: ["2mg", "4mg"] },
  { name: "Telmisartan", strengths: ["20mg", "40mg"] },
  { name: "Ciprofloxacin", strengths: ["250mg", "500mg"] },
  { name: "Domperidone", strengths: ["10mg"] },
];

const COMPLAINT_TYPES = [
  "Suspected counterfeit packaging",
  "Batch number not readable",
  "Seal tampered at retail counter",
  "Label mismatch at retail counter",
  "Colour variation in tablets",
  "Expiry printed over an older date",
];

/* -------------------------------------------------------------------------- */
/* Date helpers                                                               */
/* -------------------------------------------------------------------------- */

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 2026-06-18 -> 18/06/2026 (distributor back-office format) */
function toDayMonthYear(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** 2026-06-19 -> 19 Jun 2026 (vendor point-of-sale format) */
function toDayMonYear(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

/* -------------------------------------------------------------------------- */
/* Authored demo cases                                                        */
/* -------------------------------------------------------------------------- */

interface CatalogueItem {
  id: string;
  name: string;
  company: string;
  batch: string;
  manufactured: string;
  expiry: string;
}

function demoCatalogue(): CatalogueItem[] {
  return [
    {
      id: "MED-10482",
      name: "Paracetamol 500mg",
      company: "Kaveri Pharma Ltd",
      batch: "B1042",
      manufactured: "2026-06-12",
      expiry: "2028-06-12",
    },
    {
      id: "MED-10233",
      name: "Azithromycin 250mg",
      company: "Sunveda Biotech Pvt Ltd",
      batch: "B1088",
      manufactured: "2026-03-04",
      expiry: "2028-03-04",
    },
    {
      id: "MED-10875",
      name: "Amoxicillin 500mg",
      company: "Aravalli Life Sciences Ltd",
      batch: "B1246",
      manufactured: "2026-02-18",
      expiry: "2028-02-18",
    },
    {
      id: "MED-10590",
      name: "Metformin 500mg",
      company: "Trident Healthcare Pvt Ltd",
      batch: "B1152",
      manufactured: "2026-04-09",
      expiry: "2027-11-30",
    },
    {
      id: "MED-10027",
      name: "Pantoprazole 40mg",
      company: "Blueleaf Remedies Ltd",
      batch: "B1013",
      manufactured: "2026-01-22",
      expiry: "2028-01-22",
    },
  ];
}

/** 39 generated catalogue entries on top of the 5 authored cases. */
function generatedCatalogue(): CatalogueItem[] {
  const items: CatalogueItem[] = [];
  const used = new Set(demoCatalogue().map((c) => c.id));
  let molecule = 0;
  let strength = 0;
  let sequence = 10001;

  while (items.length < 39) {
    sequence += 1;
    const id = `MED-${sequence}`;
    if (used.has(id)) continue;
    used.add(id);

    const entry = MOLECULES[molecule % MOLECULES.length];
    const strengthValue = entry.strengths[strength % entry.strengths.length];
    molecule += 1;
    strength += 1;

    const manufactured = addDays("2026-01-06", items.length * 6 + (sequence % 7));
    items.push({
      id,
      name: `${entry.name} ${strengthValue}`,
      company: pick(COMPANIES, sequence * 7 + 1),
      batch: `B${1000 + (sequence % 900) + items.length}`,
      manufactured,
      expiry: addDays(manufactured, 730),
    });
  }
  return items;
}

/* -------------------------------------------------------------------------- */
/* Source population                                                          */
/* -------------------------------------------------------------------------- */

export function buildDataset(): Dataset {
  const catalogue = [...demoCatalogue(), ...generatedCatalogue()];
  const idOf = new Map(catalogue.map((c) => [c.id, c]));

  const manufacturer: ManufacturerRow[] = [];
  const distributor: DistributorRow[] = [];
  const vendor: VendorRow[] = [];
  const consumer: ConsumerAffairsRow[] = [];
  const registry: CentralRegistryRow[] = [];

  catalogue.forEach((item, index) => {
    const isCase = (id: string) => item.id === id;
    const distributorName = pick(DISTRIBUTORS, index * 13 + 3);
    const vendorName = index === 0 ? "Kumar Medicals" : pick(VENDORS, index * 17 + 5);
    const procuredOn = addDays(item.manufactured, 6 + (index % 4));
    const receivedOn = addDays(procuredOn, 1 + (index % 3));
    const price = 12 + ((index * 37) % 460) + (index % 4) * 0.5;

    /* ---------------------------- Manufacturer ---------------------------- */
    // MED-10027 is the authored coverage gap: no manufacturing record at all.
    if (!isCase("MED-10027")) {
      manufacturer.push({
        product_code: item.id,
        product_name: item.name,
        company: item.company,
        batch_no: item.batch,
        manufacture_date: item.manufactured,
        expiry_date: item.expiry,
      });
    }

    /* ------------------------------ Distributor --------------------------- */
    // Coverage gap: a few products are not carried by the studied distributor.
    // The authored demo cases stay in the chain so their integration story holds.
    const authoredCase = isCase("MED-10482") || isCase("MED-10875") || isCase("MED-10590");
    if (authoredCase || index % 9 !== 3) {
      const item_id = isCase("MED-10875") ? "MED 10875" : item.id;
      const batch_number = isCase("MED-10590") ? "b-1152 " : item.batch;
      distributor.push({
        item_id,
        medicine: item.name,
        supplier: distributorName,
        batch_number,
        procured_on: toDayMonthYear(procuredOn),
        vendor_name: vendorName,
        quantity: 240 + ((index * 61) % 2400),
      });
    }

    /* --------------------------------- Vendor ----------------------------- */
    // CASE 2: the vendor never received MED-10233. Every 8th product is missing too.
    const vendorHasRow = !isCase("MED-10233") && index % 8 !== 5;
    if (vendorHasRow) {
      const suffix = index % 3 === 0 && !isCase("MED-10482") ? `-${VENDOR_SUFFIX[vendorName] ?? "V1"}` : "";
      const barcode = isCase("MED-10875")
        ? "med10875-KM"
        : isCase("MED-10590")
          ? "MED 10590"
          : `${item.id}${suffix}`;
      const itemName = isCase("MED-10590") ? `${item.name} Tablets` : item.name;
      vendor.push({
        barcode,
        item: itemName,
        seller: vendorName,
        batch: isCase("MED-10590") ? "B 1152" : item.batch,
        received_on: toDayMonYear(receivedOn),
        selling_price: Math.round((price + (index % 3) * 1.25) * 100) / 100,
      });
    }

    /* ---------------------------- Consumer Affairs ------------------------ */
    // Complaints are intentionally sparse: most products have a clean record.
    const complaintSeed = index > 4 && index % 7 === 0;
    if (complaintSeed || isCase("MED-10233") || isCase("MED-10590")) {
      const isOpenCase = isCase("MED-10233");
      const status = isOpenCase
        ? "Under investigation"
        : pick(["Resolved", "Closed", "Open"], index * 29 + 11);
      const complaint_type = isCase("MED-10233")
        ? "Suspected counterfeit packaging"
        : isCase("MED-10590")
          ? "Label mismatch at retail counter"
          : pick(COMPLAINT_TYPES, index * 23 + 7);
      consumer.push({
        product_id: isCase("MED-10875") ? "MED10875" : item.id,
        complaint_type,
        complaint_date: addDays(receivedOn, 12 + (index % 10)),
        status,
        remarks: isOpenCase
          ? "Consumer report filed at the district counter; sample forwarded to the state testing laboratory (synthetic demo record)."
          : "Complaint verified and closed by the district consumer affairs desk (synthetic demo record).",
      });
    }

    /* ----------------------- Central drug registry (S5) ------------------- */
    // The registry only covers part of the catalogue and uses unrelated names.
    const registryHasRow = index % 3 === 0 || isCase("MED-10482") || isCase("MED-10233") || isCase("MED-10875");
    if (registryHasRow) {
      const sku = index % 6 === 0 && !isCase("MED-10482") ? item.id.replace("MED-", "") : item.id;
      const drug_name = isCase("MED-10482") ? "Paracetamol 500 mg" : item.name;
      const maker =
        item.company === "Kaveri Pharma Ltd"
          ? "Kaveri Pharma Limited"
          : item.company === "Aravalli Life Sciences Ltd"
            ? "Aravalli Life Sciences Pvt. Ltd."
            : item.company;
      registry.push({
        sku,
        drug_name,
        maker,
        lot: isCase("MED-10590") ? "LOT-1152" : item.batch,
        license_no: `DL-${item.company.slice(0, 2).toUpperCase()}-2026-${1200 + (index % 780)}`,
      });
    }
  });

  // Guard against accidental duplication of authored rows.
  const dedupe = <T, K extends keyof T>(rows: T[], key: K) => {
    const seen = new Set<string>();
    return rows.filter((row) => {
      const value = String(row[key]);
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  };

  return {
    manufacturer: dedupe(manufacturer, "product_code"),
    distributor: dedupe(distributor, "item_id"),
    vendor: dedupe(vendor, "barcode"),
    consumer: dedupe(consumer, "product_id"),
    central_registry: dedupe(registry, "sku"),
  };
}

export function catalogueSize(): number {
  return demoCatalogue().length + generatedCatalogue().length;
}

/* -------------------------------------------------------------------------- */
/* Known values — sample evidence used by the matcher                         */
/* -------------------------------------------------------------------------- */

export function buildKnownValues(dataset: Dataset): Record<string, string[]> {
  const datasetValues: Record<string, string[]> = {
    medicine_id: [
      ...dataset.manufacturer.map((r) => r.product_code),
      ...dataset.distributor.map((r) => r.item_id),
      ...dataset.vendor.map((r) => r.barcode),
      ...dataset.consumer.map((r) => r.product_id),
    ],
    medicine_name: [
      ...dataset.manufacturer.map((r) => r.product_name),
      ...dataset.distributor.map((r) => r.medicine),
      ...dataset.vendor.map((r) => r.item),
    ],
    manufacturer: dataset.manufacturer.map((r) => r.company),
    batch_number: [
      ...dataset.manufacturer.map((r) => r.batch_no),
      ...dataset.distributor.map((r) => r.batch_number),
      ...dataset.vendor.map((r) => r.batch),
    ],
    manufacture_date: dataset.manufacturer.map((r) => r.manufacture_date),
    expiry_date: dataset.manufacturer.map((r) => r.expiry_date),
    supplier: dataset.distributor.map((r) => r.supplier),
    procurement_date: [
      ...dataset.distributor.map((r) => r.procured_on),
      ...dataset.vendor.map((r) => r.received_on),
    ],
    vendor: dataset.vendor.map((r) => r.seller),
    price: dataset.vendor.map((r) => String(r.selling_price)),
    complaint_status: [
      ...dataset.consumer.map((r) => r.status),
      "No complaints on record",
    ],
  };
  return datasetValues;
}
