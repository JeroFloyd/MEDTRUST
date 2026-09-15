import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

/* -------------------------------------------------------------------------- */
/*  MEDTRUST — information integration schema                                  */
/* -------------------------------------------------------------------------- */

/**
 * Profiled descriptor of one attribute of a source system schema.
 * Produced by the schema profiler (datatype inference from sample values).
 */
export const sourceFieldValidator = v.object({
  name: v.string(),
  datatype: v.string(), // identifier | text | date | number
  samples: v.array(v.string()),
  nullable: v.boolean(),
});

/**
 * A proposed (and possibly accepted) attribute-to-attribute mapping between a
 * source schema and the canonical medicine schema, with the score breakdown of
 * the matcher so that every proposal is explainable.
 */
export const mappingValidator = v.object({
  source_field: v.string(),
  canonical_field: v.string(), // "" when the matcher found no candidate
  score: v.number(),
  name_score: v.number(),
  datatype_score: v.number(),
  sample_score: v.number(),
  reasoning: v.string(),
  origin: v.string(), // seeded | matcher | manual
  accepted: v.boolean(),
  warnings: v.array(v.string()),
});

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    /* ---------------------------------------------------------------------- */
    /* SOURCE 1 — Manufacturer ERP (independent schema, own attribute names)   */
    /* ---------------------------------------------------------------------- */
    src_manufacturer: defineTable({
      product_code: v.string(),
      product_name: v.string(),
      company: v.string(),
      batch_no: v.string(),
      manufacture_date: v.string(),
      expiry_date: v.string(),
    })
      .index("by_product_code", ["product_code"])
      .index("by_batch_no", ["batch_no"]),

    /* ---------------------------------------------------------------------- */
    /* SOURCE 2 — Distributor / supply-chain system                            */
    /* ---------------------------------------------------------------------- */
    src_distributor: defineTable({
      item_id: v.string(),
      medicine: v.string(),
      supplier: v.string(),
      batch_number: v.string(),
      procured_on: v.string(),
      vendor_name: v.string(),
      quantity: v.number(),
    }).index("by_item_id", ["item_id"]),

    /* ---------------------------------------------------------------------- */
    /* SOURCE 3 — Retail vendor / point-of-sale system                         */
    /* ---------------------------------------------------------------------- */
    src_vendor: defineTable({
      barcode: v.string(),
      item: v.string(),
      seller: v.string(),
      batch: v.string(),
      received_on: v.string(),
      selling_price: v.number(),
    }).index("by_barcode", ["barcode"]),

    /* ---------------------------------------------------------------------- */
    /* SOURCE 4 — Consumer Affairs complaint register                          */
    /* ---------------------------------------------------------------------- */
    src_consumer_affairs: defineTable({
      product_id: v.string(),
      complaint_type: v.string(),
      complaint_date: v.string(),
      status: v.string(),
      remarks: v.string(),
    }).index("by_product_id", ["product_id"]),

    /**
     * Storage for dynamically onboarded sources. A new source arrives with an
     * unknown schema, so its attribute names are kept generic (one JSON blob
     * per record) instead of being normalised into the four fixed schemas.
     */
    src_dynamic: defineTable({
      source_id: v.string(),
      attributes_json: v.string(),
    }).index("by_source_id", ["source_id"]),

    /**
     * The source registry / metadata catalogue. One row per source system,
     * holding its own schema descriptor, its accepted mappings to the canonical
     * schema, and whether the mediator may query it.
     */
    source_registry: defineTable({
      source_id: v.string(),
      display_name: v.string(),
      owner: v.string(),
      kind: v.string(), // manufacturer | distributor | vendor | consumer | registry | erp
      storage: v.string(), // table:<convex table> | dynamic
      description: v.string(),
      api_base: v.string(), // /api/sources/<source_id>
      fields: v.array(sourceFieldValidator),
      mappings: v.array(mappingValidator),
      active: v.boolean(),
      priority: v.number(), // trust order used for conflict resolution
      onboarded_at: v.optional(v.number()),
      notes: v.string(),
    }).index("by_source_id", ["source_id"]),

    /** One row per mediation request — powers the /trace screen. */
    integration_runs: defineTable({
      medicine_id: v.string(),
      normalized_key: v.string(),
      status: v.string(),
      status_label: v.string(),
      sources_queried: v.number(),
      sources_responded: v.number(),
      fields_resolved: v.number(),
      conflicts: v.number(),
      latency_ms: v.number(),
      transport: v.string(),
      triggered_by: v.string(),
      result_json: v.string(),
      trace_json: v.string(),
    }),

    /** Small key/value store used for bootstrap state. */
    system_state: defineTable({
      key: v.string(),
      value: v.string(),
    }).index("by_key", ["key"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
