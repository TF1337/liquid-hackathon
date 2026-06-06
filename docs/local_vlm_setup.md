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
- The current Python path in this repo (`llama-cpp-python` + `LlamaLlavaChatHandler`) should be treated as experimental for Liquid LFM2.5-VL Extract until runtime-tested on your target environment.
- Do not treat code inspection as compatibility proof for Liquid LFM2.5-VL; compatibility must be established by runtime test.
- Before demo usage, run the same image/prompt/schema through both paths and compare output validity/stability.

## What remains untested

1. Runtime compatibility test: `llama-cpp-python` + `LlamaLlavaChatHandler` with Liquid LFM2.5-VL Extract (`model` + `mmproj`) must be tested against the same known-good `llama-mtmd-cli` run.
2. Stability checks across repeated runs (valid JSON closure, required keys, bounded arrays).
3. Accuracy checks on real Japanese field documents (current repo does not prove this yet).

## Minimal schema-guided run

```powershell
uv run src/infer_vision.py --model models\your-model.gguf --mmproj models\your-mmproj.gguf --image data\samples\sample_image.jpg --prompt "Extract visible evidence only." --schema-file schemas\base\minimal_evidence.schema.json
```
