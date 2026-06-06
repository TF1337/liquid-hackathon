from typing import Any


def aggregate_evidence(records: list[dict[str, Any]]) -> dict[str, Any]:
    keyword_patterns = [
        "fax", "handwritten", "phone", "manual", "approval", "paper", "whiteboard", "stamp",
        "印", "手書き", "電話", "承認", "書類"
    ]

    def add_unique(target: list[str], value: str) -> None:
        if value and value not in target:
            target.append(value)

    def collect_text_fragments(record: dict[str, Any]) -> list[str]:
        fragments: list[str] = []
        for key in ("document_type", "language"):
            value = record.get(key)
            if isinstance(value, str):
                fragments.append(value)

        for field in record.get("fields", []) if isinstance(record.get("fields"), list) else []:
            if isinstance(field, dict):
                key = field.get("key")
                value = field.get("value")
                if isinstance(key, str):
                    fragments.append(key)
                if isinstance(value, str):
                    fragments.append(value)

        for item in record.get("line_items", []) if isinstance(record.get("line_items"), list) else []:
            if isinstance(item, dict):
                for k in ("description", "quantity", "unit"):
                    value = item.get(k)
                    if isinstance(value, str):
                        fragments.append(value)

        for item in record.get("unreadable_text", []) if isinstance(record.get("unreadable_text"), list) else []:
            if isinstance(item, dict):
                for k in ("region_or_label", "reason"):
                    value = item.get(k)
                    if isinstance(value, str):
                        fragments.append(value)

        return fragments

    document_types: list[str] = []
    observed_fields: list[str] = []
    observed_manual_or_paper_signals: list[str] = []

    workflow_nodes: list[dict[str, str]] = []
    workflow_edges: list[dict[str, Any]] = []
    node_ids_seen: set[str] = set()
    edge_counts: dict[tuple[str, str], int] = {}

    previous_node_id: str | None = None

    for record in records:
        if not isinstance(record, dict):
            continue

        document_type = record.get("document_type")
        if not isinstance(document_type, str) or not document_type.strip():
            document_type = "unknown_document"
        document_type = document_type.strip()
        add_unique(document_types, document_type)

        current_node_id = f"doc:{document_type}"
        if current_node_id not in node_ids_seen:
            workflow_nodes.append({"id": current_node_id, "label": document_type, "kind": "document_type"})
            node_ids_seen.add(current_node_id)

        for field in record.get("fields", []) if isinstance(record.get("fields"), list) else []:
            if not isinstance(field, dict):
                continue
            key = field.get("key")
            if isinstance(key, str):
                normalized = key.strip()
                if normalized:
                    add_unique(observed_fields, normalized)
                    field_node_id = f"field:{normalized}"
                    if field_node_id not in node_ids_seen:
                        workflow_nodes.append({"id": field_node_id, "label": normalized, "kind": "field"})
                        node_ids_seen.add(field_node_id)

        fragments = collect_text_fragments(record)
        lower_blob = " ".join(fragments).lower()
        for keyword in keyword_patterns:
            matcher = keyword.lower()
            if matcher in lower_blob:
                add_unique(observed_manual_or_paper_signals, keyword)

        if previous_node_id is not None:
            edge_key = (previous_node_id, current_node_id)
            edge_counts[edge_key] = edge_counts.get(edge_key, 0) + 1

        previous_node_id = current_node_id

    for idx, ((source, target), count) in enumerate(edge_counts.items(), start=1):
        workflow_edges.append(
            {
                "id": f"edge:{idx}",
                "source": source,
                "target": target,
                "kind": "sequence",
                "count": count,
            }
        )

    return {
        "record_count": len(records),
        "document_types": document_types,
        "observed_fields": observed_fields,
        "observed_manual_or_paper_signals": observed_manual_or_paper_signals,
        "workflow_nodes": workflow_nodes,
        "workflow_edges": workflow_edges,
    }