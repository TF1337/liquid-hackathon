import type {
  ExtractResponse,
  ExtractedFact,
  HealthResponse,
  IngestionState,
  SchemaName,
  SynthesizeResponse,
  WorkflowGraph,
} from "./types";

export function getAdventOneUrl(): string {
  const raw =
    (import.meta.env.VITE_ADVENT_ONE_URL as string | undefined) ||
    "http://localhost:8000";
  return raw.replace(/\/+$/, "");
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body && typeof body.detail === "string") detail = body.detail;
    } catch {
      /* ignore */
    }
    const err = new Error(detail) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const res = await fetch(`${getAdventOneUrl()}/health`, { signal });
  return jsonOrThrow<HealthResponse>(res);
}

export async function getState(signal?: AbortSignal): Promise<IngestionState> {
  const res = await fetch(`${getAdventOneUrl()}/state`, { signal });
  return jsonOrThrow<IngestionState>(res);
}

export async function postTrigger(): Promise<IngestionState> {
  const res = await fetch(`${getAdventOneUrl()}/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "frontend-manual" }),
  });
  return jsonOrThrow<IngestionState>(res);
}

export async function postExtract(args: {
  file: File | Blob;
  filename?: string;
  schema: SchemaName;
}): Promise<ExtractResponse> {
  const form = new FormData();
  form.append("file", args.file, args.filename ?? "capture.jpg");
  const url = `${getAdventOneUrl()}/extract?schema=${encodeURIComponent(args.schema)}`;
  const res = await fetch(url, { method: "POST", body: form });
  return jsonOrThrow<ExtractResponse>(res);
}

export async function postSynthesize(): Promise<SynthesizeResponse> {
  const res = await fetch(`${getAdventOneUrl()}/synthesize`, { method: "POST" });
  return jsonOrThrow<SynthesizeResponse>(res);
}

export async function getFacts(signal?: AbortSignal): Promise<ExtractedFact[]> {
  const res = await fetch(`${getAdventOneUrl()}/facts`, { signal });
  return jsonOrThrow<ExtractedFact[]>(res);
}

export async function getGraph(signal?: AbortSignal): Promise<WorkflowGraph | null> {
  const res = await fetch(`${getAdventOneUrl()}/graph`, { signal });
  if (res.status === 204) return null;
  if (!res.ok) return jsonOrThrow<WorkflowGraph>(res);
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as WorkflowGraph;
  } catch {
    return null;
  }
}