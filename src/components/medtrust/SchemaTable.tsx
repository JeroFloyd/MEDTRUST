import { Chip, Pill } from "@/components/medtrust/primitives";
import type { SourceRecord } from "@/lib/medtrust";

type Field = SourceRecord["fields"][number];

export function SchemaTable({ fields, mappings }: { fields: Field[]; mappings?: SourceRecord["mappings"] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/70">
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-semibold">Attribute (as stored by the source)</th>
            <th className="px-3 py-2 font-semibold">Profiled type</th>
            <th className="px-3 py-2 font-semibold">Sample values</th>
            <th className="px-3 py-2 font-semibold">Canonical target</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => {
            const mapping = mappings?.find((m) => m.source_field === field.name);
            return (
              <tr key={field.name} className="border-t border-border/60 align-top">
                <td className="px-3 py-2.5">
                  <Chip>{field.name}</Chip>
                  {field.nullable && (
                    <span className="mt-1 block text-[11px] text-muted-foreground">nullable</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <Pill>{field.datatype}</Pill>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {field.samples.slice(0, 3).map((sample, index) => (
                      <span
                        key={`${field.name}-${index}`}
                        className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                      >
                        {sample.length > 32 ? `${sample.slice(0, 32)}…` : sample}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {mapping?.canonical_field ? (
                    <div className="flex flex-col gap-1">
                      <Chip className="border-primary/25 bg-primary/10 text-primary">
                        {mapping.canonical_field}
                      </Chip>
                      <span className="text-[11px] text-muted-foreground">
                        score {mapping.score.toFixed(2)} · {mapping.accepted ? "accepted" : "not accepted"}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      {mapping ? "unmapped" : "—"}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
