from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ExtractedFact(BaseModel):
    document_type: Literal[
        "receipt",
        "invoice",
        "fax",
        "whiteboard",
        "sticky_note",
        "memo",
        "delivery_slip",
        "form",
        "other",
    ] = "other"
    actors: list[str] = Field(default_factory=list)
    actions: str = ""
    date: str | None = None
    amount: str | None = None
    counterparties: list[str] = Field(default_factory=list)
    summary_jp: str = ""
    id: str | None = None
    captured_at: datetime | None = None


class WorkflowNode(BaseModel):
    id: str
    label_jp: str
    label_en: str = ""
    role: str | None = None
    node_type: Literal["start", "step", "decision", "external", "end"] = "step"
    observed_signals: list[str] = Field(default_factory=list)
    source_fact_ids: list[str] = Field(default_factory=list)
    requires_human_review: bool = False


class WorkflowEdge(BaseModel):
    source: str
    target: str
    label: str | None = None


class WorkflowGraph(BaseModel):
    nodes: list[WorkflowNode] = Field(default_factory=list)
    edges: list[WorkflowEdge] = Field(default_factory=list)
    observed_manual_or_paper_signals: list[str] = Field(default_factory=list)
    approval_reference_count: int = 0
    owner_or_president_mentions: int = 0
    workflow_observations_jp: str = ""
    workflow_observations_en: str = ""


class IngestionState(BaseModel):
    status: Literal["SLEEP", "AWAKE", "PROCESSING", "READY"] = "SLEEP"
    last_trigger_at: datetime | None = None
    captured_count: int = 0


class TriggerEvent(BaseModel):
    source: str = "esp32-pir"
    triggered_at: datetime | None = None
