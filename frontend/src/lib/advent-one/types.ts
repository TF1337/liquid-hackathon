// Backend TS mirrors of src/advent_one/schemas.py

export type BackendDocumentType =
  | "receipt"
  | "invoice"
  | "fax"
  | "whiteboard"
  | "sticky_note"
  | "memo"
  | "delivery_slip"
  | "form"
  | "other";

export type ExtractedFact = {
  id?: string | null;
  document_type: BackendDocumentType;
  actors: string[];
  actions: string;
  date: string | null;
  amount: string | null;
  counterparties: string[];
  summary_jp: string;
  captured_at?: string | null;
};

export type WorkflowNode = {
  id: string;
  label_jp: string;
  label_en: string;
  role?: string | null;
  node_type: "start" | "step" | "decision" | "external" | "end";
  bottleneck: boolean;
  founder_dependent: boolean;
  source_fact_ids: string[];
};

export type WorkflowEdge = {
  source: string;
  target: string;
  label?: string | null;
};

export type WorkflowGraph = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  bottleneck_summary_jp: string;
  bottleneck_summary_en: string;
};

export type IngestionStatus = "SLEEP" | "AWAKE" | "PROCESSING" | "READY";

export type IngestionState = {
  status: IngestionStatus;
  last_trigger_at: string | null;
  captured_count: number;
};

export type HealthResponse = {
  status: string;
  vl_server: boolean;
  jp_server: boolean;
  ingestion_status: IngestionStatus;
  captured_count: number;
};

export type ExtractResponse = {
  fact: ExtractedFact;
  latency_ms: number;
  weave_trace_url?: string;
};

export type SynthesizeResponse = {
  graph: WorkflowGraph;
  latency_ms: number;
  facts_synthesized: number;
  weave_trace_url?: string;
};

export type SchemaName = "sakura_logistics" | "government_letter";

export type AppDataSource = "mock" | "live" | "auto";
export type AppDataMode = "mock" | "live";
export type AppDataBadge = "mock" | "live" | "auto-live" | "auto-mock-fallback";