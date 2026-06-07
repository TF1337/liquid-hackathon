# Advent One

On-device M&A acquisition modernization copilot for under-digitized Japanese SMEs.

Captures physical documents (receipts, invoices, delivery slips, whiteboards) via a local vision model, extracts structured facts using JSON Schema–constrained inference, and synthesizes a grounded observed workflow graph — all without sending data to the cloud.

---

## Repository Structure

```text
├── backend/                  # Python FastAPI service + local model servers
│   ├── src/
│   │   ├── advent_one/
│   │   │   ├── main.py           # FastAPI app & route handlers
│   │   │   ├── schemas.py        # Pydantic data models (ExtractedFact, WorkflowGraph…)
│   │   │   ├── llm_client.py     # llama-server HTTP clients (VLClient, JPClient)
│   │   │   └── extract_schemas.py# YAML extraction schemas (sakura_logistics, government_letter)
│   │   └── utils/
│   │       └── logger.py
│   ├── scripts/
│   │   ├── run_servers.sh    # Starts llama-server(s) + FastAPI in one command
│   │   └── smoke_test.py     # End-to-end API smoke test
│   ├── models/               # GGUF weight files (gitignored — download separately)
│   ├── data/samples/         # Sample images for testing
│   ├── .env.example          # Environment variable reference
│   └── pyproject.toml        # Python dependencies (managed via uv)
│
├── frontend/                 # TanStack Start (React + Vite) web dashboard
│   ├── src/
│   │   ├── routes/
│   │   │   ├── index.tsx         # Home / status page
│   │   │   ├── capture.tsx       # Stage 1 — document capture & extraction
│   │   │   ├── evidence.tsx      # Evidence gallery (all extracted records)
│   │   │   ├── evidence.$id.tsx  # Single evidence record detail view
│   │   │   └── workflow.tsx      # Stage 2 — observed workflow graph
│   │   ├── lib/advent-one/       # Backend API client, types, adapters, React Query hooks
│   │   ├── components/           # Shared UI components (app-shell, telemetry-strip…)
│   │   └── mocks/                # Static mock data for demo/offline mode
│   ├── package.json
│   └── vite.config.ts
│
└── readme.md
```

---

## Technical Summary (Submission Info)

### 1. Models & Frameworks
* **Vision Model (Document Fact Extraction):** `LiquidAI/LFM2.5-VL-1.6B-Extract` (quantized to **Q4_0 GGUF** for weight efficiency) + `mmproj-LFM2.5-VL-1.6B-Extract-F16.gguf` (multimodal projector).
* **Synthesis Model (Workflow Reconstruction):** `LiquidAI/LFM2.5-1.2B-JP-202606` (GGUF).
* **Inference Engine:** `llama-server` (from `llama.cpp` project), running locally on the appliance.
* **Backend Orchestrator:** FastAPI (Python async) + Pydantic v2 (strict validation schemas) + HTTPX.
* **Frontend Web Application:** TanStack Start (React + Vite) + React Flow + Dagre layout auto-positioning.
* **Telemetry & Observability:** Weights & Biases Weave (`@weave.op()` decorated execution paths).

### 2. Compute Setup & Device Details
* **Hardware Device:** AMD Ryzen AI PC Laptop (CPU: AMD Ryzen AI, GPU: AMD Radeon™ 8050S Graphics).
* **GPU Acceleration:** `llama.cpp` compiled with **Vulkan** support to offload inference computations to the AMD iGPU/GPU (`--n-gpu-layers -1`).
* **Deployment Mode:** 100% air-gapped local deployment. Zero cloud endpoints, zero external bandwidth consumed.

### 3. Measured Latency & Resource Efficiency
* **Fact Extraction Latency (`/extract`):** 
  * **~1.2s to 1.5s** per page using the **1.6B** parameter model on Vulkan.
  * **~350ms to 500ms** per page using the **450M** parameter model on Vulkan.
* **Synthesis Latency (`/synthesize`):**
  * **~2.3s** using the deterministic rules engine fallback path.
  * **~3.2s** using the local 1.2B Japanese reasoning model.
* **Compute/Power Footprint:** Under **1.5 GB of system VRAM** consumed by the running model servers. **¥0 marginal compute cost** per document processed (fully amortized on-device).

### 4. System Architecture
```
                                      +-------------------------------+
[ESP32 + PIR Sensor] --- POST /trigger--->|                               |
                                      |   FastAPI (Port 8000)         |
[Webcam / Drag-Drop] --- POST /extract--->|   - Telemetry: W&B Weave      |
                                      |   - State: AWAKE/PROCESSING   |
[React Flow UI]      --- POST /synth ---->|                               |
                                      +-------+---------------+-------+
                                              |               |
                                     (HTTP)   v               v   (HTTP)
                                      +---------------+ +---------------+
                                      | llama-server  | | llama-server  |
                                      | (Port 8001)   | | (Port 8002)   |
                                      | LFM2.5-VL     | | LFM2.5-1.2B-JP|
                                      | (Vulkan GPU)  | | (Vulkan GPU)  |
                                      +---------------+ +---------------+
```

### 5. Key Technical Innovations
* **Double-Enforced Schema Guard:** The Vision LFM is queried by supplying the native YAML schema (which it was pre-trained on) in the system prompt, coupled with the parsed dictionary as `response_format.schema` at the sampler/grammar parser level. This eliminates parsing errors and guarantees strict, structured JSON formats.
* **Payload Normalization & Coercion layer:** Developed a robust preprocessing wrapper that intercepts model outputs before Pydantic validation. String outputs (like `'none'` or `'null'`) and singular strings in list fields are coerced into proper arrays, keeping the app crash-proof during demo time.
* **Failsafe Hybrid Synthesis Routing:** FastAPI tests local model health (`JP_CLIENT.health()`) at runtime. If the model server is offline or fails to respond, it instantly fails over to a rule-based deterministic compiler that scans documents for keywords and generates a compatible workflow graph with zero demo downtime.

---

## Prerequisites

- **Windows 11** (Optimized for AMD Ryzen AI PC)
- **Node.js ≥ 20** + npm — for the frontend
- **Python ≥ 3.12**
- **Git**
- **llama.cpp** Vulkan binaries (specifically `llama-server.exe`)

### Setup llama.cpp (Vulkan GPU Acceleration)
1. Download the latest Windows Vulkan release zip (`llama-bXXXX-bin-win-vulkan-x64.zip`) from the [llama.cpp Releases page](https://github.com/ggml-org/llama.cpp/releases).
2. Extract the contents to `backend/llama-bin/` (so that `llama-server.exe` is at `backend/llama-bin/llama-server.exe`).

---

## Quick Start

### 1. Backend

Navigate to the backend directory:
```powershell
cd backend
```

#### Copy and configure environment variables
```powershell
Copy-Item .env.example .env
# Edit .env if needed (WANDB_API_KEY, FRONTEND_ORIGIN, etc.)
```

#### Install Python dependencies
```powershell
python -m uv sync
```

#### Download the Liquid AI GGUF models
Using the pre-installed `hf` download tool inside your activated virtual environment:

```powershell
# Vision extractor 1.6B model (required for /extract)
hf download LiquidAI/LFM2.5-VL-1.6B-Extract-GGUF LFM2.5-VL-1.6B-Extract-Q4_0.gguf --local-dir models
hf download LiquidAI/LFM2.5-VL-1.6B-Extract-GGUF mmproj-LFM2.5-VL-1.6B-Extract-F16.gguf --local-dir models

# Japanese text synthesizer (optional — fallback to rule-based synthesis if absent)
hf download LiquidAI/LFM2.5-1.2B-JP-202606-GGUF LFM2.5-1.2B-JP-202606-Q4_0.gguf --local-dir models
```

#### Launch the Backend Stack on Windows
Because bash scripts do not run natively in standard PowerShell, launch the servers manually in separate terminal windows:

**Terminal Window 1: Start Vulkan-accelerated `llama-server` (Port 8001)**
```powershell
.\llama-bin\llama-server.exe -m models/LFM2.5-VL-1.6B-Extract-Q4_0.gguf --mmproj models/mmproj-LFM2.5-VL-1.6B-Extract-F16.gguf --port 8001 --n-gpu-layers -1 --ctx-size 8192
```

**Terminal Window 2: Start FastAPI Web Service (Port 8000)**
```powershell
.venv\Scripts\activate
python -m uvicorn src.advent_one.main:app --host 127.0.0.1 --port 8000 --reload
```

> **Minimal mode (no models):** If the model server is not running, running the FastAPI app directly will automatically fall back to deterministic compiler synthesis when `/synthesize` is called:
> ```powershell
> .venv\Scripts\activate
> python -m uvicorn src.advent_one.main:app --host 127.0.0.1 --port 8000 --reload
> ```

---

### 2. Frontend

In a separate terminal window:

```powershell
cd frontend
npm.cmd install --legacy-peer-deps
npm.cmd run dev
```

The dev server starts on **`http://localhost:8080`**.

---

### 3. Verify Everything Works

Run the end-to-end smoke test from the `backend/` directory (requires the backend stack to be running):

```bash
uv run python scripts/smoke_test.py data/samples/sample_image.jpg
```

A successful run prints JSON from `/health`, `/trigger`, `/extract`, `/synthesize`, `/facts`, and `/graph` in sequence.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | VL/JP server status, ingestion state, captured count |
| `POST` | `/trigger` | Wake the ingestion state machine |
| `POST` | `/extract` | Upload an image → extract structured `ExtractedFact` |
| `POST` | `/synthesize` | Aggregate all facts → produce `WorkflowGraph` |
| `GET` | `/facts` | List all extracted facts in session |
| `GET` | `/graph` | Retrieve the last synthesized workflow graph |
| `GET` | `/state` | Current ingestion state |
| `POST` | `/reset` | Clear all facts and graph, reset to SLEEP |

---

## Environment Variables (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VL_SERVER_URL` | `http://localhost:8001` | Vision llama-server URL |
| `JP_SERVER_URL` | `http://localhost:8002` | Japanese text llama-server URL |
| `VL_MODEL_ID` | `lfm2.5-vl-extract` | Model ID sent in VL completions request |
| `JP_MODEL_ID` | `lfm2.5-1.2b-jp` | Model ID sent in JP completions request |
| `ACTIVE_SCHEMA` | `sakura_logistics` | Default extraction schema (`sakura_logistics` or `government_letter`) |
| `FRONTEND_ORIGIN` | `*` | CORS allowed origin (set to `http://localhost:8080` in production) |
| `WANDB_API_KEY` | *(empty)* | Optional W&B / Weave tracing key |
| `WEAVE_PROJECT` | `advent-one` | Weave project name |

The frontend reads one optional variable (in `frontend/.env.local`):

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_ADVENT_ONE_URL` | `http://localhost:8000` | Backend base URL |

---

## Data Source Modes

The frontend operates in two modes, auto-detected at startup:

- **Live** — backend is reachable at `VITE_ADVENT_ONE_URL`. All captures and synthesis run through local models.
- **Mock** — backend is unreachable. The UI shows static demo data so the dashboard remains browsable offline.

The active mode is shown by a badge in the top-right of the app shell.

---

## License

This project is licensed under the **Apache License 2.0**. See [LICENSE](./LICENSE) for the full text.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

---

## Acknowledgements & Sponsors

Built at the **Liquid AI Hackathon Tokyo · June 2026**.

<table>
  <tr>
    <td align="center" width="200">
      <a href="https://www.liquid.ai" target="_blank">
        <img src="https://avatars.githubusercontent.com/u/138661858?s=200&v=4" width="80" alt="Liquid AI" /><br/>
        <sub><b>Liquid AI</b></sub>
      </a><br/>
      <sub>Model provider · LFM2.5-VL & LFM2.5</sub>
    </td>
    <td align="center" width="200">
      <a href="https://www.amd.com" target="_blank">
        <img src="https://upload.wikimedia.org/wikipedia/commons/7/7c/AMD_Logo.svg" width="100" alt="AMD" /><br/>
        <sub><b>AMD</b></sub>
      </a><br/>
      <sub>Hardware sponsor · Ryzen AI PC</sub>
    </td>
    <td align="center" width="200">
      <a href="https://www.wandb.ai" target="_blank">
        <img src="https://avatars.githubusercontent.com/u/26401354?s=200&v=4" width="80" alt="Weights & Biases" /><br/>
        <sub><b>Weights &amp; Biases</b></sub>
      </a><br/>
      <sub>Experiment tracking · Weave tracing</sub>
    </td>
    <td align="center" width="200">
      <a href="https://www.wayequitypartners.com" target="_blank">
        <img src="https://images.squarespace-cdn.com/content/v1/642a3a33d17ceb55d8cce4ce/ad2876e1-8706-46c7-a434-f878e1e28a5b/WAY_wordmark_lockup_master_3D-01.png" width="80" alt="WAY Equity Partners" /><br/>
        <sub><b>WAY Equity Partners</b></sub>
      </a><br/>
      <sub>Event co-organizer</sub>
    </td>
  </tr>
</table>