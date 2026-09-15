import { api } from "@/convex/_generated/api";
import { useAction, useQuery } from "convex/react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The demo dataset lives in the Convex deployment. On a fresh deployment the
 * first visitor triggers the bootstrap action (five independent source tables +
 * the source registry) and sees a short preparation screen.
 */
export function DatasetGate({ children }: { children: ReactNode }) {
  const status = useQuery(api.registry.status);
  const bootstrap = useAction(api.seed.bootstrapDataset);
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!status || status.seeded || started.current) return;
    started.current = true;
    bootstrap({})
      .catch((err: unknown) => {
        started.current = false;
        setError(err instanceof Error ? err.message : "Failed to prepare the demo dataset");
      });
  }, [status, bootstrap]);

  if (status === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status.seeded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-md rounded-xl border border-border/70 bg-card p-6 text-center">
          {error ? (
            <>
              <AlertTriangle className="mx-auto size-5 text-destructive" />
              <p className="mt-3 text-sm font-semibold tracking-tight">Dataset preparation failed</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{error}</p>
            </>
          ) : (
            <>
              <Loader2 className="mx-auto size-5 animate-spin text-primary" />
              <p className="mt-3 text-sm font-semibold tracking-tight">Preparing the demo dataset</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Populating the five independent source systems and profiling their schemas with the matcher.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
