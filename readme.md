# 🌋 Liquid AI Edge Boilerplate

Cross-platform edge-inference skeleton for local Liquid Foundation Models (LFM) and GGUF-based multimodal/text workflows.

This repository is built for the **Liquid AI Hackathon** and keeps Stage-1 extraction reusable across evolving product directions.

---

## ⚡ Key Features

- **Validated Liquid VLM Demo Path**: `llama-mtmd-cli` backend for Stage-1 multimodal extraction with Liquid LFM2.5-VL Extract + `mmproj`.
- **Weights & Biases (W&B) Logging**: Integrated system to monitor latency, tokens per second, memory consumption (RSS usage), and prompt performance.
- **Multimodal + Text Support**: Keeps existing `llama-cpp-python` path and adds `mtmd_cli` backend path.
- **Deterministic Structured Output Option**: `--grammar-file` support for `mtmd_cli` path and schema support for Python path.
- **Environment Management with UV**: Utilizes astral's ultra-fast python package manager `uv` to ensure consistency and speed.

---

## 🚀 Environment Setup

### 1. Initialize & Activate Virtual Environment
Use `uv` to activate and run in the local virtual environment:

```bash
# Verify uv is installed
uv --version

# Activate the virtual environment
source .venv/bin/activate
```

### 2. Install Dependencies
Sync dependencies:

```bash
uv sync
```

Optional: if you use the experimental Python vision path on macOS with Metal, compile `llama-cpp-python` with Metal support:

```bash
CMAKE_ARGS="-DGGML_METAL=on" uv pip install llama-cpp-python --no-binary llama-cpp-python --force-reinstall --no-cache-dir
```

For AMD/Windows demo path, prefer `--backend mtmd_cli` and your installed `llama-mtmd-cli` binary.

### 3. Environment Variables Config
Create a copy of `.env.example` as `.env` and fill in your API keys:

```bash
cp .env.example .env
```
Open `.env` and configure:
```env
WANDB_API_KEY=your_weights_and_biases_key_here
HF_TOKEN=your_hugging_face_token_here
```

---

## 📦 Directory Structure

```text
├── data/
│   └── samples/              # Store placeholder images/text/audio samples for testing
│       └── sample_image.jpg  # Generated RGB sample image
├── models/                   # GITIGNORED: Place all local downloaded GGUF files here
├── src/
│   ├── utils/
│   │   └── logger.py         # Weights & Biases + system resource monitoring wrapper
│   └── infer_vision.py       # Boilerplate local vision and text inference script
├── .env                      # Local secret API credentials
├── .env.example              # Template for API credentials
├── .gitignore                # Git ignore configuration
├── pyproject.toml            # Project definition & dependencies list
└── README.md                 # Project guide
```

---

## 📥 Download Sample Models

Use the `huggingface-cli` to download sample GGUF models directly into your `models/` directory.

### Example 1: Download a LLaVA-1.5 Vision/Multimodal Model
Vision models typically require both a text model file (`.gguf`) and a clip projector file (`.gguf` or similar):

```bash
# Download the main LLaVA-1.5-7B GGUF Model
uv run huggingface-cli download mys/ggml_llava-v1.5-7b --local-dir models --include "*ggml-model-f16.gguf"

# Download the corresponding CLIP Projector
uv run huggingface-cli download mys/ggml_llava-v1.5-7b --local-dir models --include "*mmproj-model-f16.gguf"
```

### Example 2: Download a standard Text-only LFM / Llama GGUF
```bash
# Download a lightweight text model
uv run huggingface-cli download TheBloke/Llama-2-7B-Chat-GGUF llama-2-7b-chat.Q4_K_M.gguf --local-dir models --local-dir-use-symlinks False
```

---

## 🏃 Running Inference

The core inference script is located at `src/infer_vision.py`.

> Notes:
> - `--backend mtmd_cli` is the validated Liquid LFM2.5-VL multimodal path and recommended for AMD demo runs.
> - `--backend python_llama_cpp` (with `LlamaLlavaChatHandler`) remains experimental for Liquid LFM2.5-VL until runtime-tested on target hardware.
> - `--schema` / `--schema-file` apply to the Python backend.
> - `--grammar-file` applies to `mtmd_cli` and is recommended for deterministic structured JSON output.

### 1. Validated Stage-1 Multimodal Extraction (`mtmd_cli` backend)

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

For AMD/Vulkan demo machines, after validation, you can try `--n-gpu-layers 99`. Keep a CPU fallback command (`--n-gpu-layers 0`) ready.

### 2. Existing Python Path (experimental for Liquid VL)

```bash
uv run src/infer_vision.py \
  --backend python_llama_cpp \
  --model models/ggml-model-f16.gguf \
  --mmproj models/mmproj-model-f16.gguf \
  --image data/samples/sample_image.jpg \
  --prompt "Describe the colors and structure of this image."
```

### 3. Python Backend Structured JSON Schema Guidance

```bash
uv run src/infer_vision.py \
  --backend python_llama_cpp \
  --model models/ggml-model-f16.gguf \
  --mmproj models/mmproj-model-f16.gguf \
  --image data/samples/sample_image.jpg \
  --prompt "Analyze the image." \
  --schema '{"type": "object", "properties": {"primary_color": {"type": "string"}, "objects_detected": {"type": "array", "items": {"type": "string"}}}, "required": ["primary_color", "objects_detected"]}'
```

You can also pass a schema file path:

```bash
uv run src/infer_vision.py \
  --backend python_llama_cpp \
  --model models/ggml-model-f16.gguf \
  --mmproj models/mmproj-model-f16.gguf \
  --image data/samples/sample_image.jpg \
  --prompt "Extract visible evidence only." \
  --schema-file schemas/base/minimal_evidence.schema.json
```

If both `--schema` and `--schema-file` are provided at once, the script exits with an error.

### 4. Text-only Guided Generation
For a text-only GGUF model:

```bash
uv run src/infer_vision.py \
  --backend python_llama_cpp \
  --model models/llama-2-7b-chat.Q4_K_M.gguf \
  --prompt "Generate a name and tagline for a startup building Apple Silicon AI developer tools." \
  --schema '{"type": "object", "properties": {"startup_name": {"type": "string"}, "tagline": {"type": "string"}}, "required": ["startup_name", "tagline"]}'
```

---

## 📊 Logging & Metrics

During execution, metrics are logged locally to the terminal and forwarded to Weights & Biases (if `WANDB_API_KEY` is provided in `.env`). The logger tracks:
- **`inference_latency_sec`**: Total duration of model evaluation.
- **`tokens_per_second`**: Token generation throughput.
- **`max_rss_mb`**: Maximum Resident Set Size (memory consumption) of the process on macOS.
- **System context** (platform, processor type, Python version, model configuration parameters).