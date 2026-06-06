import os
import time
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
    manual_keywords = ["FAX", "手書き", "電話", "紙", "whiteboard", "manual", "approval", "paper", "承認"]
    owner_keywords = ["社長", "オーナー", "owner", "president"]
    approval_keywords = ["承認", "approval"]

    nodes: list[WorkflowNode] = []
    edges: list[WorkflowEdge] = []
    observed_manual_or_paper_signals: list[str] = []
    approval_reference_count = 0
    owner_or_president_mentions = 0

    for i, fact in enumerate(facts):
        fact_id = fact.id or f"fact-{i + 1}"
        node_id = f"node-{i + 1}"
        text_blob = _fact_text(fact)
        lowered = text_blob.lower()

        observed_signals: list[str] = []
        for keyword in manual_keywords:
            if keyword.lower() in lowered and keyword not in observed_signals:
                observed_signals.append(keyword)
            if keyword.lower() in lowered and keyword not in observed_manual_or_paper_signals:
                observed_manual_or_paper_signals.append(keyword)

        approval_reference_count += sum(1 for kw in approval_keywords if kw.lower() in lowered)
        owner_or_president_mentions += sum(1 for kw in owner_keywords if kw.lower() in lowered)

        nodes.append(
            WorkflowNode(
                id=node_id,
                label_jp=fact.summary_jp or fact.document_type,
                label_en=fact.document_type,
                node_type="step",
                observed_signals=observed_signals,
                source_fact_ids=[fact_id],
                requires_human_review=bool(observed_signals),
            )
        )

        if i > 0:
            edges.append(WorkflowEdge(source=f"node-{i}", target=node_id, label="sequence"))

    return WorkflowGraph(
        nodes=nodes,
        edges=edges,
        observed_manual_or_paper_signals=observed_manual_or_paper_signals,
        approval_reference_count=approval_reference_count,
        owner_or_president_mentions=owner_or_president_mentions,
        workflow_observations_jp="抽出済み事実に基づく観測結果のみを表示しています。",
        workflow_observations_en="Only evidence-grounded workflow observations are shown.",
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
    graph = _deterministic_synthesis(facts)

    if JP_CLIENT is None:
        return graph

    try:
        facts_payload = [fact.model_dump(mode="json") for fact in facts]
        messages = [
            {
                "role": "system",
                "content": (
                    "You reconstruct workflow observations from extracted facts. "
                    "Do not infer acquisition risk, ROI, modernization plans, founder dependency, "
                    "or final business judgments. Use only evidence-grounded observations with source fact IDs."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Given these extracted facts, produce JSON with fields: "
                    "workflow_observations_jp, workflow_observations_en, observed_manual_or_paper_signals, "
                    "approval_reference_count, owner_or_president_mentions.\n"
                    f"facts={facts_payload}"
                ),
            },
        ]
        jp_result = await JP_CLIENT.chat_json(messages=messages, max_tokens=1024)

        if isinstance(jp_result.get("workflow_observations_jp"), str):
            graph.workflow_observations_jp = jp_result["workflow_observations_jp"]
        if isinstance(jp_result.get("workflow_observations_en"), str):
            graph.workflow_observations_en = jp_result["workflow_observations_en"]
        if isinstance(jp_result.get("observed_manual_or_paper_signals"), list):
            graph.observed_manual_or_paper_signals = [str(x) for x in jp_result["observed_manual_or_paper_signals"]]
        if isinstance(jp_result.get("approval_reference_count"), int):
            graph.approval_reference_count = jp_result["approval_reference_count"]
        if isinstance(jp_result.get("owner_or_president_mentions"), int):
            graph.owner_or_president_mentions = jp_result["owner_or_president_mentions"]
    except Exception:
        return graph

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
