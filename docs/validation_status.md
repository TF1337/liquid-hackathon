# Validation Status (Stage D)

- Date/time (local): 2026-06-06 23:27
- Machine: local development workstation
- OS: Windows
- Backend path tested: Advent One FastAPI scaffold (`src/advent_one/main.py`) on `http://localhost:8005`
- Fallback path status: preserved (`src/infer_vision.py --backend mtmd_cli`)

## Commands run

- `uv sync` (failed: `uv` not installed in this environment)
- `python -m py_compile src\advent_one\__init__.py src\advent_one\schemas.py src\advent_one\extract_schemas.py src\advent_one\llm_client.py src\advent_one\main.py`
- `python -c "from src.advent_one.main import app; print('app import ok'); from src.advent_one.schemas import ExtractedFact, WorkflowGraph; print('schemas ok')"`
- `python -m uvicorn src.advent_one.main:app --host 0.0.0.0 --port 8005`
- `curl http://localhost:8005/health`
- `curl http://localhost:8005/state`
- `Invoke-RestMethod -Uri "http://localhost:8005/trigger" -Method Post -ContentType "application/json" -Body '{"source":"manual-test"}'`
- `$env:BACKEND_URL="http://localhost:8005"; python scripts\smoke_test.py data\samples\sample_image.jpg`
- `curl -Method Post http://localhost:8005/synthesize`

## Results

- `/health`: **PASS**
  - Returned `status: ok`
  - Returned `vl_server: false`, `jp_server: false` without crash when model servers are offline
- `/state`: **PASS**
  - Returned valid `IngestionState`
- `/trigger`: **PASS**
  - Updated status to `AWAKE`
  - Set `last_trigger_at`
  - No inference side effects observed
- `/extract`: **NOT PROVEN (model path unavailable in this run)**
  - With VL server offline, now returns **503** with explicit guidance to start VL server or use `mtmd_cli` fallback
  - This replaced previous opaque 500 behavior
- `/synthesize`: **PARTIAL PASS**
  - Returns valid grounded `WorkflowGraph` shape with empty/default values when no facts are present
  - No forbidden business-judgment fields observed in API response shape
- Smoke test script: **PASS for diagnostics hardening / FAIL expected on extract without VL server**
  - Now prints HTTP status, URL, and response body on failure

## Model/runtime validation status

- Real VL llama-server tested with Liquid VL model + image input: **NOT TESTED in this environment**
- Real Japanese document extraction tested: **NOT TESTED in this environment**
- AMD/Vulkan run tested: **NOT TESTED in this environment**
- Weave online instrumentation tested: **NOT TESTED**
- Weave unavailable resilience: **PASS** (app starts and endpoints run without Weave dependency blocking)
- ESP32 hardware path tested: **NOT TESTED** (only `/trigger` software endpoint behavior validated)

## Known blockers

- `uv` command unavailable in this local environment.
- No running VL llama-server with configured Liquid model/mmproj during this validation pass.
- Port `8000` was occupied by another process; validation proceeded on `8005`.

## Acceptance gate classification

- **B. Backend scaffold works, model path unproven**
  - FastAPI app and resilience behavior work.
  - Real local model-server extraction path is still unproven in this run.

## Next empirical step (required)

1. Start VL llama-server with the intended Liquid VL model.
2. Re-run smoke test against that server with one real Japanese document image.
3. Confirm `/extract` returns valid `ExtractedFact` and `/synthesize` returns grounded graph output after at least 3 extracted facts.
4. Compare Advent One `/extract` output against known-good `mtmd_cli` extraction on the same tuple (model/image/prompt/structured contract).