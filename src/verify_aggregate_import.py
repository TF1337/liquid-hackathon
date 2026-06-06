import json
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.aggregate import aggregate_evidence


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    records = [
        {
            "document_type": "invoice",
            "language": "ja",
            "fields": [
                {"key": "vendor", "value": "Sakura Logistics"},
                {"key": "channel", "value": "FAX"}
            ],
            "line_items": [
                {"description": "ice packs", "quantity": "10", "unit": "box"}
            ],
            "unreadable_text": []
        },
        {
            "document_type": "delivery_slip",
            "language": "ja",
            "fields": [
                {"key": "approval", "value": "社長承認"},
                {"key": "note", "value": "手書き"}
            ],
            "line_items": [],
            "unreadable_text": []
        }
    ]

    aggregated = aggregate_evidence(records)
    print(json.dumps(aggregated, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()