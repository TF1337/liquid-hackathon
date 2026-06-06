# RollupOS Project Specifications

## 1) Product Intent

RollupOS is an on-device acquisition modernization copilot for under-digitized Japanese SMEs.

- Demo target scenario: a fake acquisition target such as **Sakura Logistics**.
- Input evidence examples: invoices, receipts, SOPs, handwritten notes, whiteboards, workflow diagrams, warehouse boards, delivery slips, and temperature logs.
- Core promise: local edge processing for privacy, offline operation, and controllable structured extraction.

This specification keeps the product vertical-flexible and does not hard-code a final industry vertical as the default.

## 2) System Components

### 2.1 Inference appliance (core)

- **AMD Ryzen AI PC** is the primary local inference appliance for the demo.
- Stage-1 extraction runtime path is the validated **`llama-mtmd-cli`** flow with:
  - Liquid LFM2.5-VL Extract GGUF
  - matching `mmproj`
  - image input
  - `--grammar-file` for deterministic structured JSON

### 2.2 Hardware trigger layer (optional)

- **ESP32/PIR** remains part of the intended physical appliance concept.
- It is an **optional, non-blocking trigger layer** around the core extraction pipeline.
- ESP32/PIR is **not required** for the core demo to function.
- **Manual capture/upload is always required as fallback**, regardless of hardware trigger availability.

## 3) Architecture and Stage Boundaries

## 3.1 Stage 1: Grounded evidence extraction

- Input: one image.
- Output: strict JSON containing only visibly present facts.
- Not allowed in Stage 1:
  - bottleneck inference
  - founder-dependency inference
  - ROI estimation
  - recommendations
  - 90-day roadmap generation

## 3.2 Stage 2: Aggregation over extracted records

- Input: multiple Stage-1 extraction records plus optional operator notes.
- Output focus:
  - process reconstruction
  - counts and repeated manual/paper steps
  - missing-documentation signals
  - observed workflow patterns
- Avoid ungrounded “AI recommends modernization” language unless explicitly derived from evidence.

## 4) Corrected Data Flow

1. Manual upload/capture **or** ESP32/PIR wake event starts the interaction.
2. If hardware path is used, `/trigger` updates hardware state only.
3. Camera/upload provides an image to `/extract`.
4. `/extract` runs `llama-mtmd-cli` with model + `mmproj` + grammar.
5. Stage-1 output is strict JSON.
6. Stage 2 aggregates multiple extracted records.
7. Frontend renders extracted evidence and observed workflow graph.

## 5) Endpoint Responsibilities

### `/extract` (core)

- Owns VLM inference.
- Planned implementation path: validated `mtmd_cli` backend.

### `/trigger` (hardware integration layer)

- Accepts simple trigger events (for example from ESP32).
- Updates hardware status only (e.g., `SLEEP`, `AWAKE`, `CAPTURE_READY`).
- Must **not** run VLM inference.
- May optionally initiate capture flow, which still goes through `/extract`.

## 6) Product Story Constraints and Claims

- Keep RollupOS naming and local edge/privacy story.
- Keep Next.js / React Flow frontend direction.
- Keep FastAPI backend direction.
- Keep W&B Weave tracing direction.
- Statement for compliance-sensitive settings:
  - “Cloud APIs may be unacceptable under NDA, client confidentiality, and data-governance constraints.”
- Latency claim policy:
  - Do not promise fixed latency numbers before measurement.
  - Latency and throughput are measured via W&B Weave.

## 7) Untested / Must Validate

1. LFM2.5-VL extraction quality on real Japanese documents is not yet validated.
2. AMD/Vulkan `--n-gpu-layers 99` behavior is not yet validated on the demo PC.
3. ESP32/PIR trigger flow is planned as a hardware layer and is not required for core extraction.
4. Existing Python LLaVA-style handler path remains experimental/unverified for Liquid LFM2.5-VL.