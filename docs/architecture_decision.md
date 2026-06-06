# Architecture Decision: Separate Extraction from Reasoning

## Decision

- Stage 1 performs grounded evidence extraction from a single image.
- Stage 2 performs reasoning over multiple Stage-1 records (plus optional operator notes).
- Stage-1 outputs must remain extraction-only JSON with no business conclusions.

## Stage Boundaries

### Stage 1 (implemented path in this repository)

- Input: one image and one extraction prompt.
- Output: structured JSON that only reflects visibly present information.
- Allowed: literal fields, line items, unreadable regions.
- Not allowed: bottleneck analysis, ROI, recommendations, risk scoring, or rollout plans.

### Stage 2 (placeholder/interface for future work)

- Input: aggregated Stage-1 records and optional notes.
- Output: workflow-level reasoning (risks, bottlenecks, modernization options, plan).
- Current status: intentionally not implemented as product logic in this repo.

## Why this separation matters

- Prevents single-image hallucinations from being treated as workflow truth.
- Keeps extraction auditable and easier to test against visible evidence.
- Lets the team iterate on vertical strategy later without rewriting core ingestion.

## Schema policy

- Neutral default schema lives under `schemas/base/`.
- Vertical-specific schemas, if needed, should live under `schemas/experimental/`.
- Experimental schemas are optional and must not become the default until the team decides the product direction.

## Model artifact policy

- Model weights and projectors (`.gguf`, `.bin`, `.safetensors`, `.onnx`, `.pt`, `.pth`) must remain local-only and never be committed.
