import os
import time
import json
from src.utils.logger import logger
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from src.advent_one.extract_schemas import get_schema
from src.advent_one.llm_client import JPClient, VLClient
from src.advent_one.schemas import (
    ExtractedFact,
    IngestionState,
    TriggerEvent,
    WorkflowEdge,
    WorkflowGraph,
    WorkflowNode,
)

load_dotenv()

FACTS: list[ExtractedFact] = []
INGESTION_STATE = IngestionState()
LAST_GRAPH: WorkflowGraph | None = None

VL_CLIENT: VLClient | None = None
JP_CLIENT: JPClient | None = None


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _safe_weave_init() -> None:
    weave_project = os.getenv("WEAVE_PROJECT", "advent-one")
    try:
        import weave  # type: ignore

        weave.init(weave_project)
    except Exception:
        return


def _fact_text(fact: ExtractedFact) -> str:
    parts = [
        fact.document_type,
        ",".join(fact.actors),
        fact.actions,
        fact.date or "",
        fact.amount or "",
        ",".join(fact.counterparties),
        fact.summary_jp,
    ]
    return " ".join(parts)


def _deterministic_synthesis(facts: list[ExtractedFact]) -> WorkflowGraph:
    owner_keywords = ["社長", "オーナー", "owner", "president"]
    
    nodes: list[WorkflowNode] = []
    edges: list[WorkflowEdge] = []
    has_bottleneck = False

    for i, fact in enumerate(facts):
        fact_id = fact.id or f"fact-{i + 1}"
        node_id = f"node-{i + 1}"
        text_blob = _fact_text(fact)
        lowered = text_blob.lower()

        # Check for owner/founder dependency
        is_founder_dep = any(kw.lower() in lowered for kw in owner_keywords)
        is_bottleneck = is_founder_dep  # For this simple rules engine, bottleneck = founder dependent
        if is_bottleneck:
            has_bottleneck = True

        nodes.append(
            WorkflowNode(
                id=node_id,
                label_jp=fact.summary_jp or fact.document_type,
                label_en=fact.document_type,
                node_type="step",
                bottleneck=is_bottleneck,
                founder_dependent=is_founder_dep,
                source_fact_ids=[fact_id],
            )
        )

        if i > 0:
            edges.append(WorkflowEdge(source=f"node-{i}", target=node_id, label="sequence"))

    # Construct safe, grounded bottleneck summaries
    if has_bottleneck:
        bottleneck_jp = "口頭承認や社長判断への依存が観察され、ワークフローが一時停止する可能性があります。"
        bottleneck_en = "Dependence on owner/founder approval observed; workflow halts when owner is out."
    else:
        bottleneck_jp = "明示的な社長承認への依存は観察されませんでした。"
        bottleneck_en = "No explicit dependence on owner/founder approval observed."

    return WorkflowGraph(
        nodes=nodes,
        edges=edges,
        bottleneck_summary_jp=bottleneck_jp,
        bottleneck_summary_en=bottleneck_en,
    )


async def extract_document(image_bytes: bytes, schema_name: str) -> ExtractedFact:
    if VL_CLIENT is None:
        raise RuntimeError("VL client is not initialized.")

    yaml_schema = get_schema(schema_name)
    payload = await VL_CLIENT.extract(image_bytes=image_bytes, yaml_schema=yaml_schema)
    fact = ExtractedFact.model_validate(payload)
    if not fact.id:
        fact.id = str(uuid4())
    if fact.captured_at is None:
        fact.captured_at = _utc_now()
    return fact


async def synthesize_workflow(facts: list[ExtractedFact]) -> WorkflowGraph:
    # First get the deterministic fallback
    graph = _deterministic_synthesis(facts)

    if JP_CLIENT is None:
        return graph

    try:
        facts_payload = [fact.model_dump(mode="json") for fact in facts]
        system_content = (
            "You are an operations analyst reconstructing a Japanese SME's undocumented workflow from physical document fragments.\n"
            "Produce a JSON object representing the workflow graph. The JSON must follow this structure:\n"
            "{\n"
            "  \"nodes\": [\n"
            "    {\n"
            "      \"id\": \"node-1\",\n"
            "      \"label_jp\": \"社長の承認\",\n"
            "      \"label_en\": \"President Approval\",\n"
            "      \"role\": \"社長\",\n"
            "      \"node_type\": \"step\",\n"
            "      \"bottleneck\": true,\n"
            "      \"founder_dependent\": true,\n"
            "      \"source_fact_ids\": [\"fact-1\"]\n"
            "    }\n"
            "  ],\n"
            "  \"edges\": [\n"
            "    {\n"
            "      \"source\": \"node-1\",\n"
            "      \"target\": \"node-2\",\n"
            "      \"label\": \"sequence\"\n"
            "    }\n"
            "  ],\n"
            "  \"bottleneck_summary_jp\": \"summary in Japanese\",\n"
            "  \"bottleneck_summary_en\": \"summary in English\"\n"
            "}\n\n"
            "CRITICAL: Set founder_dependent=true and bottleneck=true on any step requiring the 社長 (president) or オーナー (owner) personally.\n"
            "Return ONLY the raw JSON object."
        )
        
        user_content = (
            "Given these extracted facts, reconstruct the workflow.\n\n"
            f"FACTS:\n{json.dumps(facts_payload, ensure_ascii=False)}"
        )
        
        messages = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": user_content}
        ]
        
        jp_result = await JP_CLIENT.chat_json(messages=messages, max_tokens=2048)
        
        # Validate model output structure using WorkflowGraph
        validated_graph = WorkflowGraph.model_validate(jp_result)
        return validated_graph

    except Exception as e:
        logger.warning(f"AI synthesis failed: {e}. Falling back to deterministic synthesis.")
        return graph


@asynccontextmanager
async def lifespan(_: FastAPI):
    global VL_CLIENT, JP_CLIENT
    VL_CLIENT = VLClient()
    JP_CLIENT = JPClient()
    _safe_weave_init()
    yield


app = FastAPI(title="Advent One Backend", version="0.1.0", lifespan=lifespan)

frontend_origin = os.getenv("FRONTEND_ORIGIN", "*")
allow_credentials = frontend_origin != "*"

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin],
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, Any]:
    vl_ok = await VL_CLIENT.health() if VL_CLIENT else False
    jp_ok = await JP_CLIENT.health() if JP_CLIENT else False
    return {
        "status": "ok",
        "vl_server": vl_ok,
        "jp_server": jp_ok,
        "ingestion_status": INGESTION_STATE.status,
        "captured_count": INGESTION_STATE.captured_count,
    }


@app.post("/trigger", response_model=IngestionState)
async def trigger(event: TriggerEvent | None = None) -> IngestionState:
    INGESTION_STATE.status = "AWAKE"
    INGESTION_STATE.last_trigger_at = event.triggered_at if event and event.triggered_at else _utc_now()
    return INGESTION_STATE


@app.post("/extract")
async def extract(file: UploadFile = File(...), schema: str = Query(default=os.getenv("ACTIVE_SCHEMA", "sakura_logistics"))) -> dict[str, Any]:
    INGESTION_STATE.status = "PROCESSING"
    start = time.perf_counter()
    try:
        get_schema(schema)

        if VL_CLIENT is None:
            raise HTTPException(status_code=503, detail="VL server client is not initialized.")

        if not await VL_CLIENT.health():
            raise HTTPException(
                status_code=503,
                detail=(
                    "VL server is unavailable. Start local llama-server for vision extraction "
                    "or use the fallback mtmd_cli path."
                ),
            )

        image_bytes = await file.read()
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        fact = await extract_document(image_bytes=image_bytes, schema_name=schema)
        FACTS.append(fact)
        INGESTION_STATE.captured_count = len(FACTS)
        INGESTION_STATE.status = "READY"
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        return {"fact": fact.model_dump(mode="json"), "latency_ms": latency_ms}
    except HTTPException:
        INGESTION_STATE.status = "AWAKE"
        raise
    except RuntimeError as e:
        INGESTION_STATE.status = "AWAKE"
        raise HTTPException(status_code=503, detail=f"Extraction backend unavailable: {e}") from e
    except ValueError as e:
        INGESTION_STATE.status = "AWAKE"
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        INGESTION_STATE.status = "AWAKE"
        raise HTTPException(status_code=500, detail=f"Extraction failed: {e}") from e


@app.post("/synthesize")
async def synthesize() -> dict[str, Any]:
    global LAST_GRAPH
    if not FACTS:
        return {
            "graph": WorkflowGraph().model_dump(mode="json"),
            "latency_ms": 0.0,
            "facts_synthesized": 0,
        }

    start = time.perf_counter()
    graph = await synthesize_workflow(FACTS)
    LAST_GRAPH = graph
    latency_ms = round((time.perf_counter() - start) * 1000, 2)
    return {
        "graph": graph.model_dump(mode="json"),
        "latency_ms": latency_ms,
        "facts_synthesized": len(FACTS),
    }


@app.get("/state", response_model=IngestionState)
async def get_state() -> IngestionState:
    return INGESTION_STATE


@app.get("/facts")
async def get_facts() -> list[dict[str, Any]]:
    return [fact.model_dump(mode="json") for fact in FACTS]


@app.get("/graph")
async def get_graph() -> dict[str, Any] | None:
    return LAST_GRAPH.model_dump(mode="json") if LAST_GRAPH else None


@app.post("/reset")
async def reset() -> dict[str, str]:
    global LAST_GRAPH
    FACTS.clear()
    LAST_GRAPH = None
    INGESTION_STATE.status = "SLEEP"
    INGESTION_STATE.last_trigger_at = None
    INGESTION_STATE.captured_count = 0
    return {"status": "reset"}
