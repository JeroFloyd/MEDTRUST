/**
 * GLOBAL / CANONICAL SCHEMA
 * ---------------------------------------------------------------------------
 * MEDTRUST integrates independent source systems that each use their own
 * attribute names for the same real-world concept:
 *
 *   manufacturer.product_code | distributor.item_id
 *   vendor.barcode            | consumer.product_id   ->  medicine_id
 *
 * This module is the shared vocabulary of the mediator: the canonical fields
 * every source is mapped onto, and the value normalisers that make values from
 * different source systems comparable (e.g. "MED 10875", "med10875" and
 * "MED10875" all normalise to MED10875).
 */

export type CanonicalFieldId =
  | "medicine_id"
  | "medicine_name"
  | "manufacturer"
  | "batch_number"
  | "manufacture_date"
  | "expiry_date"
  | "supplier"
  | "procurement_date"
  | "vendor"
  | "price"
  | "complaint_type"
  | "complaint_date"
  | "complaint_status"
  | "complaint_remarks";

export type Datatype = "identifier" | "text" | "date" | "number";

export interface CanonicalFieldDef {
  id: CanonicalFieldId;
  label: string;
  datatype: Datatype;
  description: string;
  /** literally-registered attribute names (normalised) that are exact synonyms */
  aliases: string[];
  /** concept tokens used for token-level name similarity of unknown names */
  concept_tokens: string[];
  /** expected raw value format, when one exists */
  pattern?: string;
  order: number;
}

export const CANONICAL_FIELDS: CanonicalFieldDef[] = [
  {
    id: "medicine_id",
    label: "Medicine ID",
    datatype: "identifier",
    description:
      "Canonical product identity. The join key that lets records from different sources be matched to the same medicine.",
    aliases: [
      "medicineid",
      "medicine",
      "itemid",
      "productcode",
      "productid",
      "itemcode",
      "drugid",
      "barcode",
      "sku",
      "gtin",
      "ean",
      "upc",
      "id",
      "code",
      "ref",
    ],
    concept_tokens: ["identity", "item"],
    pattern: "^[A-Za-z]{2,5}[-_ ]?\\d{4,8}$",
    order: 1,
  },
  {
    id: "medicine_name",
    label: "Medicine Name",
    datatype: "text",
    description: "Human readable product description as printed on the pack.",
    aliases: [
      "medicinename",
      "drugname",
      "productname",
      "itemname",
      "item",
      "medicine",
      "drug",
      "product",
      "name",
      "title",
      "description",
    ],
    concept_tokens: ["naming", "item"],
    order: 2,
  },
  {
    id: "manufacturer",
    label: "Manufacturer",
    datatype: "text",
    description: "Company that manufactured the batch.",
    aliases: [
      "manufacturer",
      "company",
      "companyname",
      "maker",
      "mfr",
      "firm",
      "producer",
      "brand",
      "labeler",
      "manufacturedby",
      "oem",
    ],
    concept_tokens: ["maker"],
    order: 3,
  },
  {
    id: "batch_number",
    label: "Batch Number",
    datatype: "identifier",
    description: "Production lot / batch identifier shared by supply-chain records.",
    aliases: [
      "batchnumber",
      "batchno",
      "batch",
      "lot",
      "lotno",
      "lotnumber",
      "lotcode",
      "batchcode",
      "batchnum",
      "consignment",
    ],
    concept_tokens: ["batch"],
    pattern: "^(B|LOT|BT)[- ]?\\d{3,6}$",
    order: 4,
  },
  {
    id: "manufacture_date",
    label: "Manufacture Date",
    datatype: "date",
    description: "Date the batch was produced.",
    aliases: [
      "manufacturedate",
      "manufacturedon",
      "mfgdate",
      "mfg",
      "manufactured",
      "productiondate",
      "madeon",
      "producedon",
    ],
    concept_tokens: ["manufacture", "date"],
    order: 5,
  },
  {
    id: "expiry_date",
    label: "Expiry Date",
    datatype: "date",
    description: "Last date the batch may be dispensed.",
    aliases: [
      "expirydate",
      "expiry",
      "expdate",
      "expireson",
      "expirationdate",
      "expiration",
      "bestbefore",
      "use_before",
      "shelflifeend",
      "exp",
    ],
    concept_tokens: ["expiry", "date"],
    order: 6,
  },
  {
    id: "supplier",
    label: "Supplier / Distributor",
    datatype: "text",
    description: "Distribution business that supplied the stock to the vendor.",
    aliases: [
      "supplier",
      "suppliername",
      "distributor",
      "distributorname",
      "stockist",
      "wholesaler",
      "sourcedfrom",
      "procuredfrom",
      "suppliedby",
    ],
    concept_tokens: ["supplier"],
    order: 7,
  },
  {
    id: "procurement_date",
    label: "Procurement Date",
    datatype: "date",
    description:
      "Date the stock moved into the next stage of the chain (distributor procurement or vendor receipt).",
    aliases: [
      "procurementdate",
      "procuredon",
      "procureddate",
      "purchasedate",
      "purchasedon",
      "acquiredon",
      "receivedon",
      "received",
      "suppliedon",
    ],
    concept_tokens: ["date"],
    order: 8,
  },
  {
    id: "vendor",
    label: "Vendor",
    datatype: "text",
    description: "Retail seller / chemist that dispenses the item.",
    aliases: [
      "vendor",
      "vendorname",
      "seller",
      "sellername",
      "retailer",
      "chemist",
      "pharmacy",
      "outlet",
      "shop",
      "dispensedby",
      "soldby",
    ],
    concept_tokens: ["vendor"],
    order: 9,
  },
  {
    id: "price",
    label: "Price",
    datatype: "number",
    description: "Selling price recorded at the point of sale.",
    aliases: [
      "price",
      "sellingprice",
      "mrp",
      "rate",
      "unitprice",
      "cost",
      "amount",
      "value",
      "sp",
    ],
    concept_tokens: ["price"],
    order: 10,
  },
  {
    id: "complaint_type",
    label: "Complaint Type",
    datatype: "text",
    description: "Category of the counterfeit / quality complaint filed at the counter.",
    aliases: ["complainttype", "complaintcategory", "complaint", "category", "issue", "issuetype"],
    concept_tokens: ["status", "item"],
    order: 11,
  },
  {
    id: "complaint_date",
    label: "Complaint Date",
    datatype: "date",
    description: "Date the complaint was registered by Consumer Affairs.",
    aliases: ["complaintdate", "filedon", "reportedon", "reportdate", "complaintday"],
    concept_tokens: ["status", "date"],
    order: 12,
  },
  {
    id: "complaint_status",
    label: "Complaint Status",
    datatype: "text",
    description:
      "Counterfeit / quality complaint state from the Consumer Affairs register.",
    aliases: [
      "complaintstatus",
      "casestatus",
      "reportstatus",
      "status",
      "complaintstate",
    ],
    concept_tokens: ["status"],
    order: 13,
  },
  {
    id: "complaint_remarks",
    label: "Complaint Remarks",
    datatype: "text",
    description: "Free-text findings recorded in the complaint register.",
    aliases: ["remarks", "remark", "comments", "comment", "notes", "note", "observation", "summary"],
    concept_tokens: ["status"],
    order: 14,
  },
];

export const CANONICAL_FIELD_MAP: Record<string, CanonicalFieldDef> = Object.fromEntries(
  CANONICAL_FIELDS.map((f) => [f.id, f]),
);

export const NO_COMPLAINT_LABEL = "No complaints on record";

/* -------------------------------------------------------------------------- */
/* Concept groups — used by the matcher for token level name similarity        */
/* -------------------------------------------------------------------------- */

export const CONCEPT_GROUPS: Record<string, string[]> = {
  identity: ["id", "identifier", "code", "sku", "barcode", "gtin", "ean", "upc", "ref", "key", "num", "number", "no"],
  naming: ["name", "title", "label", "description", "desc", "nm"],
  item: ["medicine", "med", "drug", "product", "item", "commodity", "formulation"],
  batch: ["batch", "lot", "consignment", "series"],
  date: ["date", "on", "dt", "day", "when", "timestamp"],
  maker: ["manufacturer", "maker", "company", "firm", "producer", "brand", "mfr", "oem"],
  supplier: ["supplier", "distributor", "stockist", "wholesaler", "partner", "sourced"],
  vendor: ["vendor", "seller", "retailer", "chemist", "pharmacy", "outlet", "shop", "dispenser"],
  price: ["price", "mrp", "rate", "cost", "amount", "value", "sp"],
  expiry: ["expiry", "expiration", "expire", "expires", "exp", "shelf", "before"],
  manufacture: ["manufacture", "manufactured", "mfg", "production", "produced", "made"],
  status: ["status", "state", "complaint", "report", "case", "resolution"],
};

const SHORT_TOKENS = new Set(["id", "no", "nm", "dt", "sp", "upc", "ean"]);

/* -------------------------------------------------------------------------- */
/* Value normalisation                                                        */
/* -------------------------------------------------------------------------- */

const LEGAL_SUFFIXES = [
  "pvt",
  "private",
  "ltd",
  "limited",
  "inc",
  "llp",
  "co",
  "company",
  "corp",
  "corporation",
  "and",
];

/** Lowercase, remove every separator: "MED 10875" -> "med10875". */
export function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normaliseOrganisation(value: string): string {
  const tokens = value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !LEGAL_SUFFIXES.includes(t));
  return tokens.join("");
}

/** Case / separator insensitive product identity: MED-10482 -> MED10482 */
export function normaliseIdentifier(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** Same product regardless of "500mg" vs "500 mg" or trailing "Tab." noise. */
export function normaliseProductName(value: string): string {
  return compact(
    value
      .toLowerCase()
      .replace(/\b(tablet|tabs|tab|capsule|cap|syrup|injection|inj)\b\.?/g, " ")
      .replace(/\./g, " "),
  );
}

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

/**
 * Tolerant date parser for the heterogeneous formats found across sources:
 * 2026-06-12, 12/06/2026, 12-06-2026, 12 Jun 2026, 12 jun 26.
 * Returns an ISO date (YYYY-MM-DD) or null when the value is not a date.
 */
export function parseFlexibleDate(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));

  m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(raw);
  if (m) {
    const year = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    return iso(year, Number(m[2]), Number(m[1]));
  }

  m = /^(\d{1,2})[\s-]+([A-Za-z]{3,9})[\s\-,]+(\d{2,4})$/.exec(raw);
  if (m) {
    const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
    const year = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    if (month > 0) return iso(year, month, Number(m[1]));
  }

  m = /^([A-Za-z]{3,9})[\s-]+(\d{1,2})[\s,\-]+(\d{2,4})$/.exec(raw);
  if (m) {
    const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    const year = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    if (month > 0) return iso(year, month, Number(m[2]));
  }

  m = /^(\d{4})(\d{2})(\d{2})$/.exec(raw);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));

  return null;
}

function iso(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseNumber(value: string | number): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = value.replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Normalise a raw source value into the canonical comparable form for a field.
 * This is the function that makes CASE 3/CASE 4 work: values written
 * differently in different source systems collapse onto the same key.
 */
export function normaliseValue(field: string, raw: unknown): string {
  const value = raw === null || raw === undefined ? "" : String(raw).trim();
  if (!value) return "";
  switch (field) {
    case "medicine_id":
    case "batch_number":
      return normaliseIdentifier(value);
    case "medicine_name":
      return normaliseProductName(value);
    case "manufacturer":
    case "supplier":
    case "vendor":
      return normaliseOrganisation(value);
    case "manufacture_date":
    case "expiry_date":
    case "procurement_date":
    case "complaint_date":
      return parseFlexibleDate(value) ?? compact(value);
    case "price": {
      const n = parseNumber(value);
      return n === null ? compact(value) : n.toFixed(2);
    }
    case "complaint_status":
    case "complaint_type":
      return value.toLowerCase().replace(/\s+/g, " ").trim();
    default:
      return compact(value);
  }
}

/** Canonical display form of a value, used by the GUI and the run records. */
export function formatDisplayValue(field: string, raw: unknown): string {
  const value = raw === null || raw === undefined ? "" : String(raw).trim();
  if (!value) return "";
  if (field === "price") {
    const n = parseNumber(value);
    return n === null ? value : `₹${n.toFixed(2)}`;
  }
  if (field === "manufacture_date" || field === "expiry_date" || field === "procurement_date" || field === "complaint_date") {
    const parsed = parseFlexibleDate(value);
    if (!parsed) return value;
    const [y, m, d] = parsed.split("-");
    const month = MONTHS[Number(m) - 1];
    const label = month.charAt(0).toUpperCase() + month.slice(1);
    return `${Number(d)} ${label} ${y}`;
  }
  if (field === "complaint_status" || field === "complaint_type") {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  return value;
}

export function fieldLabel(field: string): string {
  return CANONICAL_FIELD_MAP[field]?.label ?? field;
}

export function normaliseKey(input: string): string {
  return normaliseIdentifier(input);
}

/**
 * Product identity with a source-local outlet suffix removed:
 * a retail barcode such as MED10482KM still belongs to product MED10482.
 */
export function canonicalProductKey(value: string): string {
  const normalized = normaliseIdentifier(value);
  return /^MED\d{4,6}[A-Z]{2}$/.test(normalized) ? normalized.slice(0, -2) : normalized;
}
