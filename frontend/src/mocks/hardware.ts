export type TriggerState = "SLEEP" | "AWAKE" | "CAPTURE_READY";

export const triggerTransitions: Record<TriggerState, TriggerState> = {
  SLEEP: "AWAKE",
  AWAKE: "CAPTURE_READY",
  CAPTURE_READY: "SLEEP",
};

export const runtimeDetails = {
  model_path: "~/models/lfm25-vl-450m-extract-clean/LFM2.5-VL-450M-Extract-Q4_0.gguf",
  mmproj_path: "~/models/lfm25-vl-450m-extract-clean/mmproj-LFM2.5-VL-450M-Extract-F16.gguf",
  grammar_file: "~/coldchain.gbnf",
  schema_file: "schemas/base/minimal_evidence.schema.json",
  manual_fallback: true,
  backend: "mtmd_cli" as const,
  cli_path: "~/tools/llama/llama-mtmd-cli",
};