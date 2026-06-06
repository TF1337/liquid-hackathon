# Advent One Migration Plan (Conservative, Grounded)

## Purpose

This plan reconciles the existing RollupOS `mtmd_cli` prototype with the proposed Advent One architecture.

- Treat Advent One as a migration path, not current implementation reality.
- Preserve the validated local fallback (`src/infer_vision.py` + `--backend mtmd_cli`) until Advent One is empirically validated.
- Keep Stage-1 extraction and Stage-2 aggregation strictly grounded.

## Current baseline to preserve

- Stage 1 extraction path exists and is usable via `llama-mtmd-cli`.
- Grammar-constrained JSON path exists for deterministic structured output.
- Stage 2 deterministic aggregation exists in `src/aggregate.py`.
- Windows compatibility guard exists for Unix-only `resource` import.

This baseline remains the fallback and emergency demo route during Advent One migration.

## Proposed Advent One target (incremental)

- Add Advent One modules under `src/advent_one/` gradually.
- Keep endpoint direction (`/extract`, `/synthesize`, `/trigger`, `/state`, `/facts`, `/graph`) as planned interfaces.
- Keep ESP32/PIR as optional trigger layer only; manual capture/upload remains required fallback.

Do not switch the primary path to `llama-server` until the validation gate in this document is passed.

## Grounded-output rule updates for synthesis

Do **not** emit model-output judgments such as:

- `founder_dependent: true`
- `bottleneck: true`
- “high acquisition risk”
- ROI claims
- “recommended 90-day roadmap”

Use grounded observational outputs instead:

- `observed_approval_references`
- `manual_or_paper_signals`
- `source_fact_ids`
- `workflow_observations_jp`
- `workflow_observations_en`
- `requires_human_review`

Example safer structures:

```python
class WorkflowNode(BaseModel):
    id: str
    label_jp: str
    label_en: str
    role: Optional[str] = None
    node_type: Literal["start", "step", "decision", "external", "end"] = "step"
    observed_signals: list[str] = []
    source_fact_ids: list[str] = []
    requires_human_review: bool = False


class WorkflowGraph(BaseModel):
    nodes: list[WorkflowNode]
    edges: list[WorkflowEdge]
    observed_manual_or_paper_signals: list[str] = []
    approval_reference_count: int = 0
    owner_or_president_mentions: int = 0
    workflow_observations_jp: str = ""
    workflow_observations_en: str = ""
```

These are evidence-grounded observations, not diligence conclusions.

## Validation gate before Advent One becomes primary

Advent One may become the primary demo path only after all checks pass:

1. `llama-server` successfully runs Liquid LFM2.5-VL Extract with image input.
2. YAML schema interface (or equivalent structured interface) returns valid JSON.
3. `/extract` succeeds on at least one real Japanese document.
4. `/synthesize` returns grounded graph outputs without unsupported business judgments.
5. AMD/Vulkan run succeeds on demo hardware, or documented CPU fallback is ready.
6. Weave tracing failure does not crash extraction/synthesis endpoints.
7. `/trigger` remains non-blocking and manual capture/upload still works when ESP32 is offline.

## Safe migration sequence

1. Keep current prototype operational and unchanged as fallback.
2. Add Advent One scaffold modules without deleting legacy paths.
3. Add adapter tests comparing Advent One `/extract` results to known-good mtmd baseline runs.
4. Enforce grounded synthesis schema and block prohibited judgment fields.
5. Promote Advent One to primary only after passing the validation gate.

## Untested / must validate

1. `llama-server` compatibility with Liquid LFM2.5-VL Extract + image input + structured output contract.
2. Real Japanese-document extraction quality under Advent One path.
3. AMD/Vulkan performance and stability on the provided demo PC.
4. ESP32/PIR trigger reliability as optional hardware layer.