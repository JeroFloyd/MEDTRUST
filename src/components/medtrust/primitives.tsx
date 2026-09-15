import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

export function Panel({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
  dense = false,
}: {
  eyebrow?: string;
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  dense?: boolean;
}) {
  return (
    <section
      className={cn("rounded-xl border border-border/70 bg-card", dense ? "p-4" : "p-5 sm:p-6", className)}
    >
      {(eyebrow || title || actions) && (
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">{title}</h2>
            )}
            {description && (
              <div className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</div>
            )}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "warning" | "critical" | "accent";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "border-border bg-muted text-muted-foreground",
    positive: "border-success/30 bg-success/10 text-success",
    warning: "border-warning/40 bg-warning/12 text-warning-foreground",
    critical: "border-destructive/30 bg-destructive/10 text-destructive",
    accent: "border-primary/25 bg-primary/10 text-primary",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-[11.5px] tracking-tight", className)}>{children}</span>
  );
}

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-secondary/60 px-1.5 py-0.5 font-mono text-[11px] text-secondary-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

export function JsonView({
  value,
  maxHeight = "20rem",
  className,
}: {
  value: unknown;
  maxHeight?: string;
  className?: string;
}) {
  return (
    <pre
      className={cn(
        "overflow-auto rounded-lg border border-border/70 bg-muted/40 p-3 font-mono text-[11px] leading-5 text-foreground/90",
        className,
      )}
      style={{ maxHeight }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function ScoreBar({ score, className }: { score: number; className?: string }) {
  const pct = Math.max(0, Math.min(1, score)) * 100;
  const tone = score >= 0.85 ? "bg-success" : score >= 0.65 ? "bg-primary" : "bg-warning";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </div>
      <Mono className="tabular-nums text-muted-foreground">{score.toFixed(2)}</Mono>
    </div>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast.success("Copied to clipboard");
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Clipboard is not available in this browser");
        }
      }}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {label}
    </button>
  );
}

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
      <p className="text-sm font-semibold tracking-tight text-foreground">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
      )}
      {children && <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}
