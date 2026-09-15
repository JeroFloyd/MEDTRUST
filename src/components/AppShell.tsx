import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { BadgeCheck, LayoutDashboard } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <BadgeCheck className="size-4" />
      </span>
      <span className="leading-none">
        <span className="block text-sm font-bold tracking-tight text-foreground">MEDTRUST</span>
        {!compact && (
          <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Multi-source integration
          </span>
        )}
      </span>
    </Link>
  );
}

const NAV = [
  { to: "/verify", label: "Verify" },
  { to: "/sources", label: "Sources" },
  { to: "/mapping", label: "Mapping" },
  { to: "/onboarding", label: "Onboarding" },
  { to: "/trace", label: "Trace" },
  { to: "/architecture", label: "Architecture" },
];

export function AppShell({
  children,
  width = "max-w-6xl",
}: {
  children: ReactNode;
  width?: string;
}) {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className={cn("mx-auto flex w-full flex-col gap-3 px-4 py-3 sm:px-6", width)}>
          <div className="flex items-center justify-between gap-4">
            <Brand />
            <div className="flex items-center gap-2">
              <Link
                to="/verify"
                className="hidden rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent sm:inline-flex"
              >
                Verify a medicine
              </Link>
              <Link
                to={isAuthenticated ? "/dashboard" : "/auth?returnTo=%2Fdashboard"}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <LayoutDashboard className="size-3.5" />
                Console
              </Link>
            </div>
          </div>
          <nav className="-mx-1 flex items-center gap-1 overflow-x-auto pb-0.5">
            {NAV.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className={cn("mx-auto w-full flex-1 px-4 py-6 sm:px-6 sm:py-8", width)}>{children}</main>

      <footer className="border-t border-border/70 bg-muted/30">
        <div className={cn("mx-auto flex w-full flex-col gap-3 px-4 py-6 text-xs text-muted-foreground sm:px-6", width)}>
          <p className="max-w-3xl leading-5">
            <span className="font-semibold text-foreground">MEDTRUST</span> — Project 2 (Identification of Asali /
            Nakali Items), CSE656 Information Integration and Applications, IIIT Delhi. Synthetic academic dataset
            only: no real medicine, pharmacy, manufacturer or government record is used, and no medical claim is
            made anywhere in this system.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/sources" className="hover:text-foreground">
              Source systems
            </Link>
            <Link to="/mapping" className="hover:text-foreground">
              Schema mapping
            </Link>
            <Link to="/onboarding" className="hover:text-foreground">
              Source onboarding
            </Link>
            <Link to="/trace" className="hover:text-foreground">
              Integration traces
            </Link>
            <Link to="/architecture" className="hover:text-foreground">
              Architecture &amp; scope
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
