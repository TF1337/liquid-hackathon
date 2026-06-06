import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { RuntimeDetailsDrawer } from "@/components/runtime-details-drawer";
import { DataSourceBadge } from "@/components/data-source-badge";
import { useDataSource } from "@/lib/advent-one/source";

const NAV = [
  { to: "/", label: "Overview" },
  { to: "/capture", label: "Capture" },
  { to: "/evidence", label: "Evidence" },
  { to: "/workflow", label: "Workflow" },
] as const;

function StatusPills() {
  return (
    <div className="flex items-center gap-2">
      {["Local only", "Offline-ready", "AMD Ryzen AI PC"].map((label) => (
        <span
          key={label}
          className="px-2.5 py-1 rounded-full border border-white/10 text-[10px] font-mono uppercase tracking-wider text-white/40"
        >
          {label}
        </span>
      ))}
      <span className="px-2.5 py-1 rounded-full border border-brand-teal/30 text-[10px] font-mono uppercase tracking-wider text-brand-teal">
        mtmd_cli
      </span>
      <DataSourceBadge />
    </div>
  );
}

function Sidebar({ onOpenRuntime }: { onOpenRuntime: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <aside className="w-[240px] flex-shrink-0 bg-background border-r border-white/5 flex flex-col">
      <div className="p-6">
        <div className="text-xs font-medium tracking-widest text-white/30 uppercase mb-8">
          System
        </div>
        <nav className="space-y-1">
          {NAV.map((item) => {
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group flex items-center gap-3 py-2 text-sm transition-colors duration-200",
                  active
                    ? "text-brand-orange font-medium"
                    : "text-white/40 hover:text-white/80",
                )}
              >
                <span
                  className={cn(
                    "size-1 rounded-full transition-colors",
                    active ? "bg-brand-orange" : "bg-white/10 group-hover:bg-brand-orange/60",
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto border-t border-white/5 p-6">
        <button
          onClick={onOpenRuntime}
          className="flex items-center gap-2 text-[10px] font-mono tracking-tight text-white/30 uppercase hover:text-white/70 transition-colors cursor-pointer"
        >
          <span className="size-1.5 rounded-full bg-brand-teal animate-pulse" />
          Runtime Details
        </button>
      </div>
    </aside>
  );
}

function Header() {
  const { mode } = useDataSource();
  return (
    <header className="h-16 flex-shrink-0 border-b border-white/5 flex items-center justify-between px-8 bg-background">
      <div className="flex items-center gap-4">
        <h1 className="font-display text-xl font-medium tracking-tight">Advent One</h1>
        <span className="text-white/10">·</span>
        <span className="text-[10px] font-mono uppercase tracking-widest text-white/30">
          Precision Console
        </span>
        <span className="text-white/10">·</span>
        <div className="text-sm text-white/50">
          Target: <span className="text-white/80">Sakura Logistics</span>
        </div>
        {mode === "live" && (
          <span className="text-[10px] font-mono uppercase tracking-widest text-brand-teal/70">
            · connected
          </span>
        )}
      </div>
      <StatusPills />
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [runtimeOpen, setRuntimeOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-background text-foreground font-sans antialiased">
      <Sidebar onOpenRuntime={() => setRuntimeOpen(true)} />
      <div className="flex-1 flex flex-col min-w-0 bg-panel">
        <Header />
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </div>
      <RuntimeDetailsDrawer open={runtimeOpen} onOpenChange={setRuntimeOpen} />
    </div>
  );
}