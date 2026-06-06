# 🌋 Liquid AI Edge Boilerplate

A premium, universal edge-inference skeleton optimized for running Liquid Foundation Models (LFM) and other GGUF-based local vision/text models on Apple Silicon macOS. 

This repository serves as a boilerplate for the **Liquid AI Hackathon**, designed to get edge vision and text inference running with full Metal GPU acceleration and Weights & Biases logging in seconds.

---

## ⚡ Key Features

- **Apple Silicon Metal Optimization**: Built specifically for M1/M2/M3/M4 macOS devices using Metal acceleration (`n_gpu_layers=-1` to offload all computations to GPU).
- **Weights & Biases (W&B) Logging**: Integrated system to monitor latency, tokens per second, memory consumption (RSS usage), and prompt performance.
- **Multimodal (Vision + Text) Support**: Support for local vision models (such as LLaVA) via GGUF text files and clip multimodal projectors.
- **Structured Schema Guided Generation**: Ability to pass custom JSON schemas to force structured output from models.
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

### 2. Install Dependencies (Metal GPU Accelerated)
To compile `llama-cpp-python` with Metal GPU support on macOS, execute the following command:

```bash
CMAKE_ARGS="-DGGML_METAL=on" uv pip install llama-cpp-python --no-binary llama-cpp-python --force-reinstall --no-cache-dir
```

All other standard dependencies (like `wandb`, `pillow`, `python-dotenv`, `huggingface_hub`) are already defined in the `pyproject.toml` and installed. You can synchronize them via:
```bash
uv sync
```

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

The core inference script is located at `src/infer_vision.py`. It works for both text-only models and vision models, and optionally supports guided JSON schemas.

> Note: The current Python vision path uses `llama-cpp-python` + `LlamaLlavaChatHandler` and should be treated as **experimental** for Liquid LFM2.5-VL Extract until runtime-verified in your environment. The known-good local validation path so far is external `llama-mtmd-cli` testing.

### 1. Vision Multimodal Inference
Provide the main model, the multimodal projector, the image path, and a prompt:

```bash
uv run src/infer_vision.py \
  --model models/ggml-model-f16.gguf \
  --mmproj models/mmproj-model-f16.gguf \
  --image data/samples/sample_image.jpg \
  --prompt "Describe the colors and structure of this image."
```

### 2. Structured Vision / JSON Schema Guided Generation
Force the model to output a strictly formatted JSON structure (guided generation) by passing a JSON schema string:

```bash
uv run src/infer_vision.py \
  --model models/ggml-model-f16.gguf \
  --mmproj models/mmproj-model-f16.gguf \
  --image data/samples/sample_image.jpg \
  --prompt "Analyze the image." \
  --schema '{"type": "object", "properties": {"primary_color": {"type": "string"}, "objects_detected": {"type": "array", "items": {"type": "string"}}}, "required": ["primary_color", "objects_detected"]}'
```

You can also pass a schema file path:

```bash
uv run src/infer_vision.py \
  --model models/ggml-model-f16.gguf \
  --mmproj models/mmproj-model-f16.gguf \
  --image data/samples/sample_image.jpg \
  --prompt "Extract visible evidence only." \
  --schema-file schemas/base/minimal_evidence.schema.json
```

If both `--schema` and `--schema-file` are provided at once, the script exits with an error.

### 3. Text-only Guided Generation
For a text-only GGUF model:

```bash
uv run src/infer_vision.py \
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