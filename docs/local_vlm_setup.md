# Local VLM Setup (Edge / On-Device)

## Scope

This repository is designed for local inference experiments without committing model artifacts.

## Expected local model files

You should provide local paths for:

- main model file (for example, a `.gguf` model)
- multimodal projector file (for example, an `mmproj` `.gguf` file)

Do not commit these files.

## Recommended local placement

- Put local model artifacts under `models/` (gitignored).
- Pass paths explicitly via CLI flags (`--model`, `--mmproj`).

## Non-commit policy for weights

- Never commit model artifacts: `.gguf`, `.bin`, `.safetensors`, `.onnx`, `.pt`, `.pth`.
- Keep secrets in local `.env` files only.

## Runtime path notes

- `llama-mtmd-cli` has been locally validated externally for Liquid LFM2.5-VL Extract + `mmproj` + grammar-constrained JSON.
- For the hackathon demo on AMD Ryzen AI PC, prefer `--backend mtmd_cli` as the Stage-1 extraction path.
- The current Python path in this repo (`llama-cpp-python` + `LlamaLlavaChatHandler`) should be treated as experimental for Liquid LFM2.5-VL Extract until runtime-tested on your target environment.
- Do not treat code inspection as compatibility proof for Liquid LFM2.5-VL; compatibility must be established by runtime test.
- Before demo usage, run the same image/prompt/grammar through both paths and compare output validity/stability.

## Structured output source of truth

- `--grammar-file` is the structured-output control for `--backend mtmd_cli`.
- `--schema` / `--schema-file` remain available for the experimental Python backend.
- To avoid schema/grammar drift during demo prep, treat the mtmd `.gbnf` grammar as the primary structured-output contract for Stage 1.

## Performance/offload notes

- Start with `--n-gpu-layers 0` for local CPU-compatible tests.
- On validated AMD/Vulkan demo machines, test `--n-gpu-layers 99` (or another validated value) only after confirming model loading succeeds.

## What remains untested

1. Runtime compatibility test: `llama-cpp-python` + `LlamaLlavaChatHandler` with Liquid LFM2.5-VL Extract (`model` + `mmproj`) must be tested against the same known-good `llama-mtmd-cli` run.
2. Stability checks across repeated runs (valid JSON closure, required keys, bounded arrays).
3. Accuracy checks on real Japanese field documents (current repo does not prove this yet).

## Minimal schema-guided run

```powershell
uv run src/infer_vision.py --model models\your-model.gguf --mmproj models\your-mmproj.gguf --image data\samples\sample_image.jpg --prompt "Extract visible evidence only." --schema-file schemas\base\minimal_evidence.schema.json
```

## Minimal mtmd grammar-constrained run

```powershell
uv run src/infer_vision.py --backend mtmd_cli --mtmd-cli-path "$env:USERPROFILE\tools\llama\llama-mtmd-cli.exe" --model "$env:USERPROFILE\models\lfm25-vl-450m-extract-clean\LFM2.5-VL-450M-Extract-Q4_0.gguf" --mmproj "$env:USERPROFILE\models\lfm25-vl-450m-extract-clean\mmproj-LFM2.5-VL-450M-Extract-F16.gguf" --image "$env:USERPROFILE\test.png" --grammar-file "$env:USERPROFILE\coldchain.gbnf" --prompt "Extract visible information into the required JSON schema. Use empty strings for fields not visible." --max-tokens 180 --temp 0 --repeat-penalty 1.1 --n-gpu-layers 0 --threads 4
```
