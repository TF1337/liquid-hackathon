# Advent One

On-device M&A acquisition modernization copilot for under-digitized Japanese SMEs. 
This repository is split into a modular backend and frontend architecture.

---

## Repository Structure

```text
├── backend/            # Python FastAPI service, model servers, and CLI utilities
│   ├── src/            # Backend API routes, Pydantic schemas, and client wrappers
│   ├── scripts/        # Orchestration (run_servers.sh) and verification (smoke_test.py) scripts
│   ├── models/         # Directory to hold local GGUF weights (gitignored)
│   ├── data/           # Sample datasets and documents
│   └── pyproject.toml  # Python project definitions (uv)
│
├── frontend/           # TanStack Start client web dashboard
│   ├── src/            # React components, pages (file-based routes), and assets
│   ├── package.json    # Frontend script definitions and dependencies (npm)
│   └── vite.config.ts  # Vite bundler configurations
│
└── README.md           # Root guide
```

---

## Quick Start Guide

### 1. Set Up and Run the Backend

Navigate to the `backend/` directory:
```bash
cd backend
```

#### Download the Liquid AI Models (GGUFs)
Download the vision extractor and text synthesis models using the Hugging Face CLI:
```bash
# Vision Extractor
uv run huggingface-cli download LiquidAI/LFM2.5-VL-450M-Extract-GGUF LFM2.5-VL-450M-Extract-Q4_0.gguf --local-dir models --local-dir-use-symlinks False
uv run huggingface-cli download LiquidAI/LFM2.5-VL-450M-Extract-GGUF mmproj-LFM2.5-VL-450M-Extract-F16.gguf --local-dir models --local-dir-use-symlinks False

# Japanese Text Synthesis
uv run huggingface-cli download LiquidAI/LFM2.5-1.2B-JP-202606-GGUF LFM2.5-1.2B-JP-202606-Q4_0.gguf --local-dir models --local-dir-use-symlinks False
```

#### Launch the Backend Stack
Run the server orchestrator script. This script automatically starts the local `llama-server` instances on ports `8001` and `8002`, waits for them to initialize, and then boots the FastAPI application on port `8000`:
```bash
./scripts/run_servers.sh
```

*(Alternatively, to run the FastAPI backend alone using the deterministic fallback without booting model servers, run: `uv run uvicorn src.advent_one.main:app --host 0.0.0.0 --port 8000`)*.

---

### 2. Set Up and Run the Frontend

In a new terminal window, navigate to the `frontend/` directory:
```bash
cd frontend
```

#### Install Dependencies
```bash
npm install --legacy-peer-deps
```

#### Start the Dev Server
Launch the local web server on port `8080`:
```bash
npm run dev
```

---

### 3. Verification

Once both the backend and frontend are running, open your browser to **`http://localhost:8080/`**. 

*   The frontend will automatically probe `http://localhost:8000/health`. 
*   Once connected, the status badge in the UI will display **Live backend**, and all document extractions and workflow synthesis requests will run through your local models.