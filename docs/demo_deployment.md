# Demo Deployment Notes

## Development vs Demo Platform

- Development can run on team machines (macOS/Metal, Windows/CPU, or Windows/Vulkan).
- Stage-1 multimodal extraction should use the validated `llama-mtmd-cli` path.
- Stage-2 text reasoning can later run through Python/Ollama/local text model/rules, and should not block Stage 1.
- The live hackathon demo must run on the provided AMD Ryzen AI PC using local inference.
- The AMD PC may have llama.cpp + Vulkan preinstalled for LFM/LFM-VL inference.
- Keep one command shape across platforms and change only paths plus `--n-gpu-layers`.
- Local CPU dev default: `--n-gpu-layers 0`.
- AMD/Vulkan demo: test `--n-gpu-layers 99` only after confirming the preinstalled build can load the Liquid Extract GGUF + mmproj.
- Run a full dress rehearsal on the AMD PC in offline/airplane mode before demo session.
- Confirm with organizers whether the AMD AI PC must be returned at Day-1 wrap-up and when it is available again on Day 2.

## Copy-paste Stage-1 extraction commands

Windows CMD:

```cmd
uv run src/infer_vision.py ^
--backend mtmd_cli ^
--mtmd-cli-path "%USERPROFILE%\tools\llama\llama-mtmd-cli.exe" ^
--model "%USERPROFILE%\models\lfm25-vl-450m-extract-clean\LFM2.5-VL-450M-Extract-Q4_0.gguf" ^
--mmproj "%USERPROFILE%\models\lfm25-vl-450m-extract-clean\mmproj-LFM2.5-VL-450M-Extract-F16.gguf" ^
--image "%USERPROFILE%\test.png" ^
--grammar-file "%USERPROFILE%\coldchain.gbnf" ^
--prompt "Extract visible information into the required JSON schema. Use empty strings for fields not visible." ^
--max-tokens 180 ^
--temp 0 ^
--repeat-penalty 1.1 ^
--n-gpu-layers 0 ^
--threads 4
```

macOS/Linux shell:

```bash
uv run src/infer_vision.py \
--backend mtmd_cli \
--mtmd-cli-path "$HOME/tools/llama/llama-mtmd-cli" \
--model "$HOME/models/lfm25-vl-450m-extract-clean/LFM2.5-VL-450M-Extract-Q4_0.gguf" \
--mmproj "$HOME/models/lfm25-vl-450m-extract-clean/mmproj-LFM2.5-VL-450M-Extract-F16.gguf" \
--image "$HOME/test.png" \
--grammar-file "$HOME/coldchain.gbnf" \
--prompt "Extract visible information into the required JSON schema. Use empty strings for fields not visible." \
--max-tokens 180 \
--temp 0 \
--repeat-penalty 1.1 \
--n-gpu-layers 0 \
--threads 4
```

## Day-2 AMD validation checklist

- Confirm PC access schedule with organizers.
- Locate `llama-mtmd-cli` on the AMD PC.
- Confirm the installed build/version supports Liquid Extract GGUF.
- Confirm Vulkan-enabled build is operational.
- Confirm model and mmproj files are present and path-accessible.
- Run CPU fallback first with `--n-gpu-layers 0`.
- Run Vulkan offload test with `--n-gpu-layers 99`.
- Run offline / airplane mode test.
- Capture one successful JSON output artifact.
- Record latency for the demo command.
- Keep CPU fallback command ready in case Vulkan path fails.