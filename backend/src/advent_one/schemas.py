from datetime import datetime
from typing import Literal, Optional

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
    label_en: str
    role: Optional[str] = None
    node_type: Literal["start", "step", "decision", "external", "end"] = "step"
    bottleneck: bool = False
    founder_dependent: bool = False
    source_fact_ids: list[str] = Field(default_factory=list)


class WorkflowEdge(BaseModel):
    source: str
    target: str
    label: Optional[str] = None


class WorkflowGraph(BaseModel):
    nodes: list[WorkflowNode] = Field(default_factory=list)
    edges: list[WorkflowEdge] = Field(default_factory=list)
    bottleneck_summary_jp: str = ""
    bottleneck_summary_en: str = ""


class IngestionState(BaseModel):
    status: Literal["SLEEP", "AWAKE", "PROCESSING", "READY"] = "SLEEP"
    last_trigger_at: datetime | None = None
    captured_count: int = 0


class TriggerEvent(BaseModel):
    source: str = "esp32-pir"
    triggered_at: datetime | None = None
