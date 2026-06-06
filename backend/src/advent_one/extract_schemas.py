SAKURA_LOGISTICS_SCHEMA = """type: object
required:
  - document_type
  - actors
  - actions
  - date
  - amount
  - counterparties
  - summary_jp
properties:
  document_type:
    type: string
    enum: [receipt, invoice, fax, whiteboard, sticky_note, memo, delivery_slip, form, other]
  actors:
    type: array
    items:
      type: string
    maxItems: 10
  actions:
    type: string
  date:
    description: visible date string if present, null if absent
    type: [string, "null"]
  amount:
    description: visible monetary value or quantity string if present, null if absent
    type: [string, "null"]
  counterparties:
    type: array
    items:
      type: string
    maxItems: 10
  summary_jp:
    type: string
additionalProperties: false
"""


GOVERNMENT_LETTER_SCHEMA = """type: object
required:
  - document_type
  - actors
  - actions
  - date
  - amount
  - counterparties
  - summary_jp
properties:
  document_type:
    type: string
    enum: [form, memo, other]
  actors:
    type: array
    items:
      type: string
    maxItems: 8
  actions:
    type: string
  date:
    description: visible date string if present, null if absent
    type: [string, "null"]
  amount:
    description: visible monetary value or quantity string if present, null if absent
    type: [string, "null"]
  counterparties:
    type: array
    items:
      type: string
    maxItems: 8
  summary_jp:
    type: string
additionalProperties: false
"""


def get_schema(name: str) -> str:
    normalized = (name or "").strip().lower()
    if normalized in ("sakura_logistics", "sakura", "default"):
        return SAKURA_LOGISTICS_SCHEMA
    if normalized in ("government_letter", "gov_letter"):
        return GOVERNMENT_LETTER_SCHEMA
    raise ValueError(f"Unknown extraction schema: {name}")
