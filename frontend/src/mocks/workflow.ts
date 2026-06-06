export type WorkflowNode = {
  id: string;
  label: string;
  sub: string;
  evidenceIds: string[];
  manualPaperSignals: string[];
};
export type WorkflowEdge = { from: string; to: string; label?: string };

export type WorkflowMock = {
  target: string;
  record_count: number;
  document_types_observed: { type: string; count: number }[];
  repeated_manual_paper_signals: { signal: string; count: number }[];
  missing_documentation_signals: string[];
  workflow_nodes: WorkflowNode[];
  workflow_edges: WorkflowEdge[];
};

export const workflowMock: WorkflowMock = {
  target: "Sakura Logistics",
  record_count: 6,
  document_types_observed: [
    { type: "delivery_slip", count: 1 },
    { type: "temperature_log", count: 1 },
    { type: "whiteboard", count: 1 },
    { type: "invoice", count: 1 },
    { type: "sop_page", count: 1 },
    { type: "handwritten_note", count: 1 },
  ],
  repeated_manual_paper_signals: [
    { signal: "Handwritten temperature readings", count: 5 },
    { signal: "Paper delivery slips", count: 1 },
    { signal: "Whiteboard process handoff", count: 1 },
    { signal: "Operator memo (loose paper)", count: 1 },
  ],
  missing_documentation_signals: [
    "No digital timestamp on temperature log entries",
    "Vendor invoice total partially unreadable (fold crease)",
    "Whiteboard centre section wiped before capture",
  ],
  workflow_nodes: [
    {
      id: "n1",
      label: "Receive order",
      sub: "vendor invoice arrives",
      evidenceIds: ["EV-0045"],
      manualPaperSignals: ["paper invoice"],
    },
    {
      id: "n2",
      label: "Manual temperature log",
      sub: "handwritten every 2 hours",
      evidenceIds: ["EV-0043", "EV-0047"],
      manualPaperSignals: ["handwritten log", "operator memo"],
    },
    {
      id: "n3",
      label: "Paper delivery slip",
      sub: "stamped at bay 12",
      evidenceIds: ["EV-0042"],
      manualPaperSignals: ["paper slip", "ink stamp"],
    },
    {
      id: "n4",
      label: "Whiteboard handoff",
      sub: "morning shift change",
      evidenceIds: ["EV-0044"],
      manualPaperSignals: ["whiteboard"],
    },
    {
      id: "n5",
      label: "Warehouse board update",
      sub: "SOP-CC-007 step 3",
      evidenceIds: ["EV-0046"],
      manualPaperSignals: ["printed SOP"],
    },
  ],
  workflow_edges: [
    { from: "n1", to: "n2" },
    { from: "n2", to: "n3" },
    { from: "n3", to: "n4" },
    { from: "n4", to: "n5" },
  ],
};