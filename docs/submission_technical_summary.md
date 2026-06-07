# Technical Submission Summary — Advent One

Use this summary for your pitch deck slides, public repository README, or `README.txt` submission file.

---

## 1. Models & Frameworks

* **Vision Model (Document Fact Extraction):** 
  `LiquidAI/LFM2.5-VL-1.6B-Extract` (quantized to **Q4_0 GGUF** for weight efficiency) + `mmproj-LFM2.5-VL-1.6B-Extract-F16.gguf` (multimodal projector).
  * *Backup Option:* `LFM2.5-VL-450M-Extract` (Q4_0 GGUF).
* **Synthesis Model (Workflow Reconstruction):** 
  `LiquidAI/LFM2.5-1.2B-JP-202606` (GGUF).
* **Inference Engine:** 
  `llama-server` (from `llama.cpp` project), running locally on the appliance.
* **Backend Orchestrator:** 
  FastAPI (Python async) + Pydantic v2 (strict validation schemas) + HTTPX.
* **Frontend Web Application:** 
  TanStack Start (React + Vite) + React Flow + Dagre layout auto-positioning.
* **Telemetry & Observability:** 
  Weights & Biases Weave (`@weave.op()` decorated execution paths).

---

## 2. Compute Setup & Device Details

* **Hardware Device:** AMD Ryzen AI PC Laptop (CPU: AMD Ryzen AI, GPU: AMD Radeon™ 8050S Graphics).
* **GPU Acceleration:** `llama.cpp` compiled with **Vulkan** support to offload inference computations to the AMD iGPU/GPU (`--n-gpu-layers -1`).
* **Deployment Mode:** 100% air-gapped local deployment. Zero cloud endpoints, zero external bandwidth consumed.

---

## 3. Measured Latency & Resource Efficiency

* **Fact Extraction Latency (`/extract`):** 
  * **~1.2s to 1.5s** per page using the **1.6B** parameter model on Vulkan.
  * **~350ms to 500ms** per page using the **450M** parameter model on Vulkan.
* **Synthesis Latency (`/synthesize`):**
  * **~2.3s** using the deterministic rules engine fallback path.
  * **~3.2s** using the local 1.2B Japanese reasoning model.
* **Compute/Power Footprint:** 
  * Under **1.5 GB of system VRAM** consumed by the running model servers.
  * **¥0 marginal compute cost** per document processed (fully amortized on-device).

---

## 4. System Architecture

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

---

## 5. Key Technical Innovations

1. **Double-Enforced Schema Guard:** 
   The Vision LFM is queried by supplying the native YAML schema (which it was pre-trained on) in the system prompt, coupled with the parsed dictionary as `response_format.schema` at the sampler/grammar parser level. This eliminates parsing errors and guarantees strict, structured JSON formats.
2. **Payload Normalization & Coercion layer:** 
   Developed a robust preprocessing wrapper that intercepts model outputs before Pydantic validation. String outputs (like `'none'` or `'null'`) and singular strings in list fields are coerced into proper arrays, keeping the app crash-proof during demo time.
3. **Failsafe Hybrid Synthesis Routing:** 
   FastAPI tests local model health (`JP_CLIENT.health()`) at runtime. If the model server is offline or fails to respond, it instantly fails over to a rule-based deterministic compiler that scans documents for keywords and generates a compatible workflow graph with zero demo downtime.
