# Advent One — Implementation Plan (Agent Spec)

> Hand this entire file to your coding agent. It's self-contained: architecture, file-by-file responsibilities, API contract, dev timeline, demo plan, submission checklist, and the gotchas that will eat hours if you skip them. No prior conversation context needed.

---

## 0. TL;DR

**Advent One** is an air-gapped, on-device M&A acquisition modernization copilot for WAY Equity Partners. It observes physical documents in a freshly-acquired Japanese SME (receipts, faxes, sticky notes, whiteboards, delivery slips), extracts structured data on-device, and reconstructs the undocumented operational workflow — flagging founder-dependent bottlenecks. **No data leaves the appliance.**

**Track:** 1 (LFM Application). Optional Track 2 hedge: fine-tune Extract on Japanese SME documents and submit base-vs-finetune evals; declare track at the 13:30 submission deadline on Day 2.

**Stack:**
- **Vision:** `LiquidAI/LFM2.5-VL-450M-Extract` (GGUF, image + schema → flat JSON). Use the 450M, not the 1.6B — faster on the Mac for dev, fits the Ryzen iGPU comfortably tomorrow. The 1.6B is the upgrade path only if the assigned Ryzen SKU is Strix Halo class.
- **Reasoning:** `LiquidAI/LFM2.5-1.2B-JP-202606` (GGUF, JP text synthesis)
- **Runtime:** `llama-server` (from llama.cpp). Metal on Mac for tonight; Vulkan on Ryzen tomorrow — preinstalled on the venue PC. **Same code both places; only env vars change.**
- **Backend:** FastAPI + Pydantic v2 + httpx (async)
- **Observability:** Weights & Biases Weave (`@weave.op()`)
- **Frontend:** Next.js + Tailwind + Shadcn UI + **React Flow** (generate via Lovable, wire to the API contract in §5). React Flow is non-negotiable — the bottleneck-node-glowing-red moment is the demo punchline.
- **Hardware trigger:** ESP32 + PIR motion sensor (HC-SR501)

**Six things to get right** (skip these and lose hours):

1. **Do NOT embed `llama-cpp-python`.** Run `llama-server` as a separate process and hit its OpenAI-compatible HTTP API. The venue Ryzen PC ships with it preinstalled. The Mac runs the same binary via Homebrew (`brew install llama.cpp`). Identical code on both.
2. **Pass the schema BOTH ways: native YAML in system prompt AND as a parsed JSON schema in `response_format.schema`.** The Extract model is *trained* on the YAML-in-system-prompt format — that's the natural interface. But at 450M params it occasionally hallucinates structure under load, so we also pass the parsed schema to llama-server's grammar engine via `response_format` as belt-and-braces. Use both.
3. **The llama.cpp parameter is `repeat_penalty`, NOT `repetition_penalty`.** OpenAI / HF naming silently fails — the model loops. Canonical sampling: `temperature=0.3, min_p=0.15, repeat_penalty=1.05`. No `top_p`, no `top_k`, no greedy.
4. **You return the AI PC at 16:10 on Day 1.** All Day-1-night work is on your MacBook. The HTTP-client design makes this free — same code, swap `VL_SERVER_URL` / `JP_SERVER_URL`.
5. **Deterministic synthesis fallback.** If the JP `llama-server` is unreachable (model not downloaded, OOM, etc.), `/synthesize` must still return a usable `WorkflowGraph` built by rule-based aggregation over the captured facts. The LFM path is the headline; the fallback is the safety net.
6. **Apply the chat template — always use `/v1/chat/completions`, never `/completions`.** Switching to raw completions skips the chat template and output collapses.

---

## 1. Architecture

```
                                              ┌──────────────────────────────┐
ESP32 + PIR ──POST /trigger──────────────────▶│                              │
                                              │                              │
Webcam capture ──POST /extract (image)───────▶│      FastAPI (port 8000)     │
                                              │      advent_one.main         │
Next.js UI ──poll /state, /facts, /graph─────▶│      @weave.op() decorated   │
                                              │                              │
                                              └───┬────────────────┬─────────┘
                                                  │                │
                                                  ▼                ▼
                            ┌──────────────────────────┐  ┌──────────────────────────┐
                            │  llama-server :8001       │  │  llama-server :8002       │
                            │  LFM2.5-VL-450M-Extract   │  │  LFM2.5-1.2B-JP-202606    │
                            │  Mac: Metal / Ryzen: Vulkan│  │  Mac: Metal / Ryzen: Vulkan│
                            └──────────────────────────┘  └──────────────────────────┘
                                                     │
                                                     ▼
                                              W&B Weave dashboard
                                              (latency + traces — projected during demo)
```

**Data flow:**
1. PIR detects motion → `POST /trigger` → state becomes `AWAKE`
2. Analyst places a document under the webcam (or Next.js drag-drops a captured frame)
3. UI calls `POST /extract` with the image → backend calls VL server with the YAML schema (system) + image (user) + parsed-dict schema (response_format) → returns `ExtractedFact` JSON → appended to in-memory list
4. After ≥3 documents, UI calls `POST /synthesize` → backend tries the JP model; on failure falls back to deterministic rule-based aggregation → returns `WorkflowGraph` with nodes + edges + bottleneck summary
5. UI renders the graph with React Flow; founder-dependent / bottleneck nodes glow red

---

## 2. Critical technical decisions

### 2.1. HTTP to `llama-server`, not embedded `llama-cpp-python`

- Run two `llama-server` processes side-by-side: VL on `:8001`, JP text on `:8002`.
- FastAPI is a thin async orchestrator that POSTs JSON to those servers.
- **Mac dev (tonight):** `brew install llama.cpp` — Metal backend. Models in `./models/`.
- **Ryzen demo (tomorrow):** `llama-server` is preinstalled with Vulkan backend. Models go in the same relative path. Zero code change.

### 2.2. Extraction call payload — the exact shape

For each `POST /extract`, the backend sends this to the VL server:

```jsonc
// POST /v1/chat/completions to VL server
{
  "model": "lfm2.5-vl-extract",
  "messages": [
    { "role": "system", "content": "<full YAML schema text>" },
    { "role": "user", "content": [
      { "type": "text", "text": "Extract per the schema." },
      { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." } }
    ]}
  ],
  "response_format": {
    "type": "json_object",
    "schema": { /* the YAML parsed into a dict via yaml.safe_load() */ }
  },
  "temperature": 0.3,
  "min_p": 0.15,
  "repeat_penalty": 1.05
}
```

**Both** the YAML-in-system-prompt **and** the parsed-dict-as-response_format are present. The YAML is what the model was trained on (the natural Extract interface); the response_format is the sampler-level safety net.

### 2.3. Synthesis call payload (JP text model)

```jsonc
// POST /v1/chat/completions to JP server
{
  "model": "lfm2.5-1.2b-jp",
  "messages": [
    { "role": "system", "content": "<operations-analyst prompt from §4.6>" },
    { "role": "user",   "content": "FACTS:\n<JSON array of ExtractedFact>" }
  ],
  "response_format": { "type": "json_object" },
  "temperature": 0.3,
  "min_p": 0.15,
  "repeat_penalty": 1.05,
  "max_tokens": 2048
}
```

### 2.4. Day-1-night portability

- Day 1 night: develop on MacBook. `llama-server` runs natively on Apple Silicon via Metal.
- Day 2: same code, models in the same relative path, only the assigned hardware differs.
- **Verification step the first 30 min on the Ryzen PC:** download both GGUFs to its local disk, start `llama-server` on the right ports, run `scripts/smoke_test.py` against a real Sakura Logistics document before assuming portability.

### 2.5. In-memory state, no database

Module-level globals in `main.py`: a list of captured `ExtractedFact`, an `IngestionState`, the last `WorkflowGraph`. `/reset` clears them. No SQLite. Hackathon scope.

### 2.6. Frontend integration via polling, not WebSockets

UI polls `/state` every 500 ms and `/graph` after the user presses "Synthesize". Simple, robust, no socket plumbing in 48 hours.

---

## 3. File tree

```
advent-one/
├── README.md                        # quick start (how to run tonight on Mac)
├── pyproject.toml                   # uv project; deps in §4.1
├── .env.example
├── .gitignore
├── backend/
│   └── src/advent_one/
│       ├── __init__.py
│       ├── schemas.py               # Pydantic — ExtractedFact, WorkflowGraph, …
│       ├── extract_schemas.py       # YAML schema strings for Extract
│       ├── llm_client.py            # async HTTP clients for both llama-servers
│       └── main.py                  # FastAPI app + Weave + endpoints + synthesis
├── esp32/
│   └── pir_trigger.py               # MicroPython on the ESP32
└── scripts/
    ├── run_servers.sh               # launches both llama-server + FastAPI
    └── smoke_test.py                # end-to-end cURL-equivalent test
```

Frontend lives in a separate Lovable project; it only needs the API contract in §5.

---

## 4. File-by-file specs

### 4.1. `pyproject.toml`
- Python ≥ 3.11
- Deps: `fastapi`, `uvicorn[standard]`, `httpx`, `pydantic>=2.9`, `python-multipart`, `wandb`, `weave`, `pyyaml`, `python-dotenv`
- **NOT** `llama-cpp-python` (we hit `llama-server` over HTTP)
- Dev deps: `ruff`, `pytest`

### 4.2. `.env.example`
```
WANDB_API_KEY=
WANDB_PROJECT=advent-one
WEAVE_PROJECT=advent-one
VL_SERVER_URL=http://localhost:8001
JP_SERVER_URL=http://localhost:8002
HOST=0.0.0.0
PORT=8000
FRONTEND_ORIGIN=*
VL_MODEL_ID=lfm2.5-vl-extract
JP_MODEL_ID=lfm2.5-1.2b-jp
ACTIVE_SCHEMA=sakura_logistics
```

### 4.3. `src/advent_one/schemas.py`
Pydantic v2 models. Field names in `ExtractedFact` MUST exactly match keys in the YAML schemas in §4.4.

```python
class ExtractedFact(BaseModel):
    document_type: Literal["receipt","invoice","fax","whiteboard","sticky_note",
                           "memo","delivery_slip","form","other"] = "other"
    actors: list[str] = []
    actions: str = ""
    date: Optional[str] = None
    amount: Optional[str] = None
    counterparties: list[str] = []
    summary_jp: str = ""
    id: Optional[str] = None
    captured_at: Optional[datetime] = None

class WorkflowNode(BaseModel):
    id: str
    label_jp: str
    label_en: str
    role: Optional[str] = None
    node_type: Literal["start","step","decision","external","end"] = "step"
    bottleneck: bool = False
    founder_dependent: bool = False
    source_fact_ids: list[str] = []

class WorkflowEdge(BaseModel):
    source: str
    target: str
    label: Optional[str] = None

class WorkflowGraph(BaseModel):
    nodes: list[WorkflowNode]
    edges: list[WorkflowEdge]
    bottleneck_summary_jp: str = ""
    bottleneck_summary_en: str = ""

class IngestionState(BaseModel):
    status: Literal["SLEEP","AWAKE","PROCESSING","READY"] = "SLEEP"
    last_trigger_at: Optional[datetime] = None
    captured_count: int = 0

class TriggerEvent(BaseModel):
    source: str = "esp32-pir"
    triggered_at: Optional[datetime] = None
```

### 4.4. `src/advent_one/extract_schemas.py`

Plain Python strings. The Sakura Logistics demo schema:

```yaml
document_type: type of document. one of: receipt, invoice, fax, whiteboard, sticky_note, memo, delivery_slip, form, other
actors: list of people, roles, or job titles mentioned (examples: 社長, 担当者, 顧客, 山田部長). Empty list if none.
actions: one-sentence Japanese description of what business action this document represents
date: visible date if present in YYYY-MM-DD format. null if absent.
amount: monetary value or quantity if present, as a string. null if absent.
counterparties: list of external companies, vendors, customers, or banks mentioned. Empty list if none.
summary_jp: brief 1-2 sentence plain-Japanese summary of the document
```

Also include a `GOVERNMENT_LETTER_SCHEMA` and a `get_schema(name)` lookup so the demo can pivot schemas without code change.

### 4.5. `src/advent_one/llm_client.py`

Two classes: `VLClient` and `JPClient`. Both async, both use `httpx.AsyncClient`. Both read URLs from env with sensible defaults.

`VLClient.extract(image_bytes, yaml_schema_str) -> dict`:
1. Base64-encode the JPEG, embed as `data:image/jpeg;base64,...`
2. `yaml.safe_load(yaml_schema_str)` → schema dict
3. POST to `{base}/v1/chat/completions` with the payload from §2.2:
   - system message = the raw YAML string (the model was trained on this)
   - user message = `[{"type":"text",...}, {"type":"image_url",...}]`
   - `response_format = {"type":"json_object","schema": <dict>}` (sampler-level safety net)
   - Canonical sampling
4. Parse `choices[0].message.content` as JSON; tolerate stray prose by locating the first `{...}` block.

`JPClient.chat(messages, force_json=False, max_tokens=2048) -> str` and `chat_json(messages) -> dict`:
- standard chat completions, optionally with `response_format={"type":"json_object"}`
- same canonical sampling

Both classes expose `async health() -> bool` hitting `{base}/health`.

Module-level constant:
```python
CANONICAL_SAMPLING = {
    "temperature": 0.3,
    "min_p": 0.15,
    "repeat_penalty": 1.05,   # NOT repetition_penalty — llama.cpp's parameter name
}
```

### 4.6. `src/advent_one/main.py`

FastAPI app. Lifespan handler initializes Weave (wrapped in `try/except` so the app runs without W&B) + the two clients.

**Endpoints (verbatim contract — the frontend depends on these):**

| Method | Path           | Body / Params                          | Returns |
|--------|----------------|----------------------------------------|---------|
| GET    | `/health`      | —                                      | `{status, vl_server: bool, jp_server: bool, ingestion_status, captured_count}` |
| POST   | `/trigger`     | `TriggerEvent` (optional)              | `IngestionState` |
| POST   | `/extract`     | multipart `file` (image), `?schema=`   | `{fact: ExtractedFact, latency_ms: float, weave_trace_url?: str}` |
| POST   | `/synthesize`  | —                                      | `{graph: WorkflowGraph, latency_ms: float, facts_synthesized: int, source: "lfm" \| "deterministic"}` |
| GET    | `/state`       | —                                      | `IngestionState` |
| GET    | `/facts`       | —                                      | `list[ExtractedFact]` |
| GET    | `/graph`       | —                                      | `WorkflowGraph` or `null` |
| POST   | `/reset`       | —                                      | `{status: "reset"}` |

**Weave instrumentation:**
- `weave.init(os.getenv("WEAVE_PROJECT", "advent-one"))` in lifespan, wrapped in try/except
- `@weave.op()` on `extract_document(image_bytes, schema_name)` and `synthesize_workflow(facts)` — Weave records inputs, outputs, latency automatically
- `@weave.op()` on `_deterministic_synthesis(facts)` too — even the fallback path should be traced

**Synthesis logic (`synthesize_workflow`):**

```python
async def synthesize_workflow(facts: list[ExtractedFact]) -> tuple[WorkflowGraph, str]:
    """Returns (graph, source) where source is "lfm" or "deterministic"."""
    if not facts:
        return WorkflowGraph(nodes=[], edges=[]), "deterministic"

    # Try LFM path first
    if await jp_client.health():
        try:
            graph = await _llm_synthesis(facts)
            return graph, "lfm"
        except Exception as e:
            logger.warning("LFM synthesis failed, falling back: %s", e)

    # Deterministic fallback
    return _deterministic_synthesis(facts), "deterministic"
```

**LFM synthesis prompt (`_llm_synthesis`):** system message casts the model as an operations analyst reconstructing a Japanese SME's workflow; specifies the exact JSON output shape (mirrors `WorkflowGraph`); instructs to set `founder_dependent=true` and `bottleneck=true` on any step requiring 社長/オーナー personally; "return ONLY the JSON object."

**Deterministic fallback (`_deterministic_synthesis`):**
- One `WorkflowNode` per fact, in capture order
- Scans `actors` + `summary_jp` for `社長`, `オーナー`, `owner`, `president` → sets `bottleneck=True` and `founder_dependent=True`
- Generates sequential edges between consecutive nodes
- Hardcodes a generic but coherent bottleneck summary in JP and EN that references the flagged nodes (e.g., "全ての注文が社長の承認を必要とするためボトルネックが発生している" if any node is flagged)

This is the **safety net for demo time** — the demo cannot crash because the JP model OOM'd.

**CORS:** open to `FRONTEND_ORIGIN` env (default `*` for hackathon).

### 4.7. `esp32/pir_trigger.py`

MicroPython. PIR `OUT` → GPIO 13 (configurable). On rising edge with ≥3 s debounce, POST `{"source":"esp32-pir"}` to `{BACKEND_URL}/trigger`. Blink the onboard LED on each trigger. Wifi creds + backend URL at the top with `# EDIT THESE` markers.

### 4.8. `scripts/run_servers.sh`

Bash. Launches:
1. `llama-server --model ./models/LFM2.5-VL-450M-Extract-Q4_0.gguf --port 8001 --n-gpu-layers -1 --ctx-size 8192` (background, logs to `logs/vl_server.log`)
2. `llama-server --model ./models/LFM2.5-1.2B-JP-202606-Q4_0.gguf --port 8002 --n-gpu-layers -1 --ctx-size 8192` (background) — only if the model file exists, else skip and log a warning so the deterministic fallback path is exercised
3. Wait for `/health` on each running server (60 s timeout, 1 s interval)
4. `uv run uvicorn advent_one.main:app --host 0.0.0.0 --port 8000 --reload`
5. Trap EXIT/INT/TERM to kill both llama-server PIDs

### 4.9. `scripts/smoke_test.py`

Standalone Python. Takes an image path as arg. Hits `/health`, `/trigger`, `/extract` (with the image), `/synthesize` in order. Prints JSON at each step. Fails loudly if anything's wrong. **Must report whether `/synthesize` used `"lfm"` or `"deterministic"` source.**

---

## 5. Frontend integration contract (give this to Lovable)

**Polling:**
- `GET /state` every 500 ms — drives the "Hardware Status" pill (SLEEP / AWAKE / PROCESSING / READY)
- `GET /facts` after every extraction (or on `state.captured_count` change) — drives the "Captured Documents" feed
- `GET /graph` after pressing the "Synthesize" button — drives React Flow

**Document upload:**
- Drop zone or webcam capture → `POST /extract` with multipart form field `file`
- Response: `{fact, latency_ms}` — display `fact.summary_jp` on the card and add to the feed

**React Flow shape conversion:**
```ts
import dagre from 'dagre';

const nodes = graph.nodes.map(n => ({
  id: n.id,
  data: { label: n.label_jp, role: n.role, sub: n.label_en },
  position: { x: 0, y: 0 },  // dagre auto-layout
  style: n.bottleneck ? { borderColor: '#dc2626', boxShadow: '0 0 18px #dc2626' } : undefined,
  type: n.node_type === 'external' ? 'input' : n.node_type === 'end' ? 'output' : 'default',
}));
const edges = graph.edges.map((e, i) => ({
  id: `e${i}`, source: e.source, target: e.target, label: e.label
}));
```
Use `dagre` or `elkjs` for auto-layout — never hand-position.

**Header:**
- Title "Advent One | Target: Sakura Logistics"
- Status pill bound to `state.status` (colors: gray/yellow/blue/green)
- Small badge bottom-right showing `/synthesize`'s `source` field — `LFM` (green) or `RULE-BASED` (gray). Honest signaling.

**Synthesize button:** disabled when `captured_count < 3`.

---

## 6. Tonight (MacBook Air) — Day-0 setup

Goal by bed: smoke test green on Mac with a real document. The Ryzen PC tomorrow is then a 30-minute reproduction step.

```bash
# 1. Install llama.cpp with Metal
brew install llama.cpp

# 2. Project setup
git init advent-one && cd advent-one
# (have your agent generate the file tree from §3-§4)
uv sync

# 3. Download models (only the VL is mandatory for tonight)
mkdir -p models
huggingface-cli download LiquidAI/LFM2.5-VL-450M-Extract-GGUF \
  LFM2.5-VL-450M-Extract-Q4_0.gguf --local-dir ./models
# (download the JP model too if you have bandwidth — it enables the LFM synthesis path)
huggingface-cli download LiquidAI/LFM2.5-1.2B-JP-202606-GGUF \
  LFM2.5-1.2B-JP-202606-Q4_0.gguf --local-dir ./models

# 4. Env
cp .env.example .env
# fill in WANDB_API_KEY

# 5. Launch
./scripts/run_servers.sh

# 6. Smoke test (in another terminal)
uv run python scripts/smoke_test.py data/samples/test_doc.jpg
```

Smoke test must end with `🟢 end-to-end pipeline OK` and report `source: "lfm"` for /synthesize. If the JP model isn't downloaded, the source will be `"deterministic"` — that's still a pass; the LFM path is verified tomorrow.

**Also tonight:**
- Draft the 5 Sakura Logistics documents on paper (see §8). Photograph them on the Mac webcam — this is your demo fixture set.
- Confirm wifi creds + your laptop's LAN IP for the ESP32 script (`pir_trigger.py` line 14).
- Push to GitHub (public repo — required at submission).

---

## 7. Day 1 — Saturday (venue opens 9:00, kickoff 9:30)

**You return the AI PC at 16:10. Plan around that.**

| Time | Phase | Outcome |
|------|-------|---------|
| 09:00–09:30 | Arrival, welcome | Get assigned AI PC, confirm SKU class, verify `llama-server` is preinstalled |
| 09:30–10:15 | Kickoff + use-case discovery + technical kickoff | Take notes; meet Teo Narboneta Zosa and Kohsei Matsutani (Liquid AI MTS) |
| 10:15–10:30 | Team formation | Lock with Freek + #3 |
| 10:30–11:00 | Akihabara dash | One person stays + sets up the Ryzen PC; one person grabs the BOM from §Shopping list. Hibiya line, 5–7 min each way. |
| 11:00–12:30 | Phase 1 — reproduce on Ryzen | Clone the repo on the AI PC. Download both GGUFs. `./scripts/run_servers.sh`. `smoke_test.py`. **End state: same green output as Mac last night.** |
| 12:30–13:30 | Lunch + ESP32 flash | Flash `pir_trigger.py` to the ESP32 over the lunch hour; verify `POST /trigger` fires from a hand wave |
| 13:30–16:00 | Phase 2 — Synthesis polish + UI v0 | Verify LFM synthesis returns a richer graph than the deterministic fallback. Have Lovable generate the Next.js shell + React Flow. Wire `/state` polling, `/extract` upload, `/graph` render. **End state: 3-document → graph loop works end-to-end on the Ryzen PC.** |
| 16:00–16:10 | Wrap | `git push`. **Return the AI PC.** |
| evening | Phase 3 — Polish + demo prep (on MacBook) | Refine the synthesis prompt. Demo dry-run on Mac. Draft the deck (in opposite language of presentation per event guide). Cut the 60–90s demo video. |

## 8. Day 2 — Sunday

| Time | Phase | Outcome |
|------|-------|---------|
| 09:00–11:00 | Final polish on the Ryzen PC | Two full demo dry-runs. Verify Weave dashboard populates. Tighten the deck. |
| 11:00–13:00 | Demo prep + submission assembly | Build the Sakura Logistics desk diorama. Test the PIR trigger live. Open the Weave dashboard for the projector. Assemble the encrypted demo-assets ZIP (§9). |
| 13:00–13:30 | **Submission deadline** | Submit. Password DM'd to `@liquid-yan` on Discord. |
| 14:00–16:00 | Demo session | 5 min live. |

---

## 9. Demo plan — "Sakura Logistics"

**Fictional target:** Sakura Logistics K.K. — a 30-year-old family-run delivery company in Saitama. Owner-CEO 田中社長 (68) is approaching retirement. WAY is evaluating it as a rollup target.

**The 5 hand-drafted documents** (draft tonight):
1. **Customer order fax** from 山田商事 — handwritten quantity, no PO number
2. **Sticky note** attached to the fax: `社長確認待ち`
3. **Whiteboard photo** — today's delivery routes, dry-erase marker
4. **Fuel receipt** from ENEOS — 8,500円, today's date
5. **Handwritten delivery slip** — driver signature, customer signature, no digital copy

Expected synthesis output (rough):
- **Nodes:** Customer (external) → Fax received (担当者) → **Approval (社長, bottleneck, founder_dependent)** → Whiteboard scheduling (担当者) → Driver dispatch → Delivery → Receipt collection
- **Bottleneck summary (JP):** 「全ての注文が社長の口頭承認を必要とするため、ボトルネックは社長の在席に依存している」
- **Bottleneck summary (EN):** "Every order requires the founder's verbal approval; the entire operation halts when he's out."

**Stage flow (5 minutes):**
1. **0:00–0:30** — Title slide. "WAY's diligence pipeline is bottlenecked by 30-year-old paper. Cloud AI is legally forbidden under NDAs. We built the air-gapped appliance."
2. **0:30–1:00** — Diorama. Wave hand over PIR. "Hardware Status: SLEEP → AWAKE." Resource Efficiency rubric: hit.
3. **1:00–3:30** — Place documents one at a time. Each extracts in ~1–2 s. Cards stream in. Captured count climbs. After document 5, hit "Synthesize."
4. **3:30–4:30** — React Flow paints in. 社長 node glows red. Read the bottleneck summary in Japanese.
5. **4:30–5:00** — Switch tab to W&B Weave dashboard. Show the trace tree, latency. Final slide: "First customer: WAY Equity Partners. ¥0 marginal compute per document. Zero bytes leave the appliance."

---

## 10. Submission checklist (per event guide)

**Common to both tracks:**
- [ ] 2–4 slide deck (Japanese problem, why LFM, approach, results). Deck in opposite language of presentation.
- [ ] 5-min live demo on the assigned Ryzen AI PC
- [ ] Tagline (1–2 lines) + public repo link
- [ ] Encrypted demo-assets folder named `ADVENTONE_Track1_HackTheLiquidWAY_DemoAssets`. Password DM'd to `@liquid-yan` on Discord. Contents:
  - 60–90 s demo video
  - High-res screenshots
  - Team photos + bios
  - `README.txt` with file descriptions and demo setup steps
- [ ] Technical summary: models used, runtime (`llama.cpp + Vulkan`), measured latency, memory/power footprint, architecture diagram

**Track 1 specific:**
- [ ] Working app demoed live on the Ryzen AI PC
- [ ] On-device details: model identifiers, runtime, measured latency + memory + power
- [ ] W&B Weave traces visible (strongly encouraged — bake into the demo)

---

## 11. Gotchas

1. **Sampling.** `temperature=0.3, min_p=0.15, repeat_penalty=1.05`. **`repeat_penalty`, not `repetition_penalty`** — the latter is silently ignored by llama.cpp and you get the `"TokTokTok"` doom loop.
2. **Chat template.** Always `/v1/chat/completions`, never `/completions`.
3. **AMD `n-gpu-layers`.** On the Ryzen Vulkan build, `-1` (all) is the default. If you hit OOM on the VL model, drop to 24, then halve.
4. **VL context length.** Default `--ctx-size 8192` is enough for one document at a time, which is all Extract supports.
5. **Image format.** Send JPEG, not PNG, in the `image_url` data URI. Smaller, faster.
6. **Schema-Pydantic drift.** Field names in the YAML schema MUST equal field names in `ExtractedFact`. If you add a field to one, add it to the other.
7. **Multi-image.** Extract is single-image only. Don't try to send a list of images in one call — that's what the JP synthesis step is for.
8. **Weave init failure.** Wrap in try/except. Venue wifi may flake.
9. **CORS.** Set `FRONTEND_ORIGIN=*` for demo. Tighten later.
10. **HuggingFace bandwidth at the venue.** Download both GGUFs tonight on hotel wifi. Don't trust venue wifi for ~1 GB on Saturday morning.
11. **AI PC return at 16:10 Day 1.** `git push` before you hand it back.
12. **`uv run uvicorn`, not bare `uvicorn`.** Bare `uvicorn` on macOS with Anaconda installed resolves to Anaconda's Python and bypasses the venv. `uv run` keeps you inside.

---

## 12. Acceptance criteria

### Phase 1 (Mac, tonight) — done when:
- `uv sync` succeeds
- `./scripts/run_servers.sh` starts the VL `llama-server` and FastAPI without errors
- `curl http://localhost:8000/health` returns `{"status":"ok","vl_server":true,...}`
- `python scripts/smoke_test.py data/samples/test.jpg` runs all 4 steps green

### Phase 1 (Ryzen, tomorrow morning) — done when:
- Same smoke test passes on the Ryzen AI PC with same code
- `/extract` latency on a Sakura Logistics document is under 3 seconds

### Phase 2 — done when:
- `POST /extract` on a Sakura Logistics fake document returns a sensible `ExtractedFact` (correct `document_type`, populated `actors`/`actions`, plausible `summary_jp`)
- `POST /synthesize` on 3+ facts returns a `WorkflowGraph` with ≥3 nodes and at least one node with `bottleneck=true`; `source: "lfm"` when JP server is up
- Weave dashboard at `wandb.ai/<user>/advent-one/weave` shows traces for both ops with latency
- Lovable-generated Next.js renders the React Flow graph from `/graph` data

### Phase 3 — done when:
- ESP32 over wifi successfully POSTs `/trigger`, flipping the UI's status pill from SLEEP to AWAKE
- The 5 Sakura Logistics documents produce a coherent workflow graph that visibly flags the 社長 bottleneck
- Two complete dry-runs of the 5-minute demo finish in under 5 minutes

### Phase 4–5 — done when:
- Demo runs end-to-end on the Ryzen AI PC with the same code that ran on the Mac
- W&B Weave dashboard is ready to project
- Submission package (§10) is uploaded before 13:30 Day 2

---

## 13. Build order for the coding agent

If you hand this whole document to your agent, instruct it to generate files in this order and run the relevant acceptance check from §12 before moving on:

1. `pyproject.toml`, `.env.example`, `.gitignore`, `src/advent_one/__init__.py`
2. `src/advent_one/schemas.py`
3. `src/advent_one/extract_schemas.py`
4. `src/advent_one/llm_client.py`
5. `src/advent_one/main.py`
6. `scripts/run_servers.sh` (+ `chmod +x`)
7. `scripts/smoke_test.py`
8. `esp32/pir_trigger.py`
9. `README.md` (final, summarizing how to run on Mac tonight and Ryzen tomorrow)
