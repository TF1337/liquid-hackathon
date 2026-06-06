# RollupOS Implementation Plan (Corrected)

## Scope of this plan

- This plan describes implementation sequencing and responsibilities.
- It keeps ESP32/PIR in the appliance concept while making core extraction independent of hardware trigger readiness.
- It avoids product-vertical lock-in and avoids Stage-2 business recommendation overreach.

## Guiding constraints

- Core Stage-1 demo path must prioritize the validated `llama-mtmd-cli` multimodal route.
- Existing Python `llama-cpp-python` + `LlamaLlavaChatHandler` path remains experimental unless runtime-validated.
- All critical paths must be configurable via flags/env vars (no hard-coded absolute paths, no hard-coded GPU-layer assumptions).
- `/trigger` is state-only hardware integration; inference stays in `/extract`.
- Manual capture/upload remains available even when ESP32/PIR is unavailable.

## Phase plan

### Phase 1 — Core local extraction backend (highest priority)

Objective: establish the demo-critical extraction pipeline first.

- Implement `/extract` using validated `mtmd_cli` backend that shells out to `llama-mtmd-cli`.
- Pass configurable parameters:
  - `--backend mtmd_cli`
  - `--mtmd-cli-path`
  - `--model`
  - `--mmproj`
  - `--image`
  - `--grammar-file`
  - `--max-tokens`
  - `--temp`
  - `--repeat-penalty`
  - `--n-gpu-layers`
  - `--threads`
- Keep output deterministic with grammar-constrained JSON (`--grammar-file`) for demo runs.
- Keep local CPU fallback ready (`--n-gpu-layers 0`).
- Treat AMD/Vulkan offload (`--n-gpu-layers 99`) as opt-in only after on-device validation.

### Phase 2 — Manual capture/upload + frontend evidence display

Objective: ensure a complete demo path that does not depend on hardware trigger.

- Add/complete manual image upload and manual webcam capture flows.
- Route both manual paths to `/extract`.
- Render Stage-1 extracted JSON in the frontend as evidence records.
- Ensure the core demo remains functional if ESP32/PIR is disconnected.

### Phase 3 — Grounded process reconstruction (Stage 2 aggregation)

Objective: aggregate evidence records into observable workflow patterns without ungrounded advice.

- Aggregate multiple Stage-1 records plus optional operator notes.
- Build outputs around observed, grounded signals only:
  - process reconstruction
  - counts of repeated manual/paper steps
  - missing-documentation signals
  - observed workflow patterns
- Avoid recommendation language unless explicitly traceable to extracted evidence.

### Phase 4 — ESP32/PIR hardware trigger integration (optional layer)

Objective: integrate appliance wake/capture behavior without coupling trigger path to inference internals.

- Plan `/trigger` endpoint accepting simple POST events from ESP32.
- `/trigger` updates hardware state only, for example:
  - `hardware_status = "SLEEP" | "AWAKE" | "CAPTURE_READY"`
  - `capture_ready = true/false`
- Frontend displays Hardware Status: `SLEEP / AWAKE / CAPTURE_READY`.
- Optional auto-capture may start from trigger state, but inference still runs only via `/extract`.
- Manual capture button remains always available as fallback.

### Phase 5 — Physical demo polish and reliability

Objective: finalize operational readiness on the provided AMD Ryzen AI PC.

- Run full dress rehearsal on target demo hardware.
- Validate offline operation path.
- Log latency and throughput using W&B Weave.
- Keep CPU fallback command prepared for live contingency.

## Claim and messaging corrections

- Replace absolute claim “Cloud APIs are a legal violation” with:
  - “Cloud APIs may be unacceptable under NDA, client confidentiality, and data-governance constraints.”
- Replace unmeasured latency claims (for example “sub-second latency”) with:
  - “Latency and throughput are measured via W&B Weave.”

## Untested / must validate before demo-critical sign-off

1. LFM2.5-VL extraction quality on real Japanese field documents.
2. AMD demo PC Vulkan behavior with `--n-gpu-layers 99`.
3. ESP32/PIR trigger integration reliability (optional layer, not core dependency).
4. Existing Python LLaVA-style handler compatibility for Liquid LFM2.5-VL (experimental/unverified).

## Non-goals for this phase

- No product-specific scoring engines (digitization score, ROI scoring, 90-day roadmap automation).
- No requirement that ESP32/PIR be present for the core extraction demo.
- No movement of VLM inference into `/trigger`.