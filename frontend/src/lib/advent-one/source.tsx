import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getHealth } from "./client";
import type { AppDataBadge, AppDataMode, AppDataSource } from "./types";

type Ctx = {
  configured: AppDataSource;
  mode: AppDataMode;
  badge: AppDataBadge;
  /** User clicked "Switch to mock demo" — pins the session to mock. */
  forceMock: () => void;
  /** User clicked "Try live again" — re-probes /health. */
  retryLive: () => void;
  probing: boolean;
};

const DataSourceContext = createContext<Ctx | null>(null);

function readConfigured(): AppDataSource {
  const raw = (import.meta.env.VITE_DATA_SOURCE as string | undefined)?.toLowerCase();
  if (raw === "mock" || raw === "live" || raw === "auto") return raw;
  return "auto";
}

export function DataSourceProvider({ children }: { children: ReactNode }) {
  const configured = readConfigured();
  const [overrideMock, setOverrideMock] = useState(false);
  const [autoLive, setAutoLive] = useState<boolean | null>(
    configured === "auto" ? null : null,
  );
  const [probing, setProbing] = useState(configured === "auto");
  const [probeNonce, setProbeNonce] = useState(0);

  useEffect(() => {
    if (configured !== "auto") return;
    let cancelled = false;
    setProbing(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2000);
    getHealth(controller.signal)
      .then(() => {
        if (!cancelled) setAutoLive(true);
      })
      .catch(() => {
        if (!cancelled) setAutoLive(false);
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (!cancelled) setProbing(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [configured, probeNonce]);

  const mode: AppDataMode = useMemo(() => {
    if (overrideMock) return "mock";
    if (configured === "mock") return "mock";
    if (configured === "live") return "live";
    return autoLive ? "live" : "mock";
  }, [configured, autoLive, overrideMock]);

  const badge: AppDataBadge = useMemo(() => {
    if (overrideMock) return "mock";
    if (configured === "mock") return "mock";
    if (configured === "live") return "live";
    return autoLive ? "auto-live" : "auto-mock-fallback";
  }, [configured, autoLive, overrideMock]);

  const forceMock = useCallback(() => setOverrideMock(true), []);
  const retryLive = useCallback(() => {
    setOverrideMock(false);
    setProbeNonce((n) => n + 1);
  }, []);

  const value: Ctx = { configured, mode, badge, forceMock, retryLive, probing };

  return <DataSourceContext.Provider value={value}>{children}</DataSourceContext.Provider>;
}

export function useDataSource(): Ctx {
  const ctx = useContext(DataSourceContext);
  if (!ctx) {
    // Render-safe fallback during SSR / tests
    return {
      configured: "mock",
      mode: "mock",
      badge: "mock",
      forceMock: () => {},
      retryLive: () => {},
      probing: false,
    };
  }
  return ctx;
}

export const BADGE_LABEL: Record<AppDataBadge, string> = {
  mock: "Mock demo",
  live: "Live backend",
  "auto-live": "Auto: live",
  "auto-mock-fallback": "Auto: mock fallback",
};