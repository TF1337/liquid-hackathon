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

## Prerequisites

- **macOS (Apple Silicon recommended)** — GPU offloading via Metal is enabled by default
- [Homebrew](https://brew.sh) — to install `llama.cpp`
- [uv](https://github.com/astral-sh/uv) — Python package manager
- **Node.js ≥ 20** + npm — for the frontend

Install `llama.cpp` (provides `llama-server`):
```bash
brew install llama.cpp
```

---

## Quick Start

### 1. Backend

```bash
cd backend
```

#### Copy and configure environment variables
```bash
cp .env.example .env
# Edit .env if needed (WANDB_API_KEY, FRONTEND_ORIGIN, etc.)
```

#### Install Python dependencies
```bash
uv sync
```

#### Download the Liquid AI GGUF models

```bash
# Vision extractor (required for /extract)
uv run huggingface-cli download LiquidAI/LFM2.5-VL-450M-Extract-GGUF \
  LFM2.5-VL-450M-Extract-Q4_0.gguf \
  --local-dir models --local-dir-use-symlinks False

uv run huggingface-cli download LiquidAI/LFM2.5-VL-450M-Extract-GGUF \
  mmproj-LFM2.5-VL-450M-Extract-F16.gguf \
  --local-dir models --local-dir-use-symlinks False

# Japanese text synthesizer (optional — fallback to rule-based synthesis if absent)
uv run huggingface-cli download LiquidAI/LFM2.5-1.2B-JP-202606-GGUF \
  LFM2.5-1.2B-JP-202606-Q4_0.gguf \
  --local-dir models --local-dir-use-symlinks False
```

#### Launch the full backend stack
```bash
./scripts/run_servers.sh
```

This script:
1. Starts `llama-server` for the vision model on **port 8001**
2. Starts `llama-server` for the JP text model on **port 8002** *(if model file is present)*
3. Polls health checks until both servers are ready
4. Boots the FastAPI app via `uvicorn` on **port 8000**

> **Minimal mode (no models):** Run the FastAPI app directly — extraction will return 503 and workflow synthesis falls back to the deterministic rule-based engine:
> ```bash
> uv run python -m uvicorn src.advent_one.main:app --host 0.0.0.0 --port 8000
> ```

---

### 2. Frontend

In a separate terminal:

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
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
        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/AMD_Logo.svg/320px-AMD_Logo.svg.png" width="100" alt="AMD" /><br/>
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
        <img src="https://media.licdn.com/dms/image/v2/D560BAQHQiEXSi4FE9g/company-logo_200_200/company-logo_200_200/0/1700467670750/way_equity_partners_logo?e=2147483647&v=beta&t=qkRFGG6K9wHKHfPf8fI_Cs5H-oJVCFHN3FKnuTMxSMY" width="80" alt="WAY Equity Partners" /><br/>
        <sub><b>WAY Equity Partners</b></sub>
      </a><br/>
      <sub>Event co-organizer</sub>
    </td>
  </tr>
</table>