import deliverySlip from "@/assets/evidence-delivery-slip.jpg";
import tempLog from "@/assets/evidence-temp-log.jpg";
import whiteboard from "@/assets/evidence-whiteboard.jpg";
import invoice from "@/assets/evidence-invoice.jpg";

export type EvidenceField = { key: string; value: string };
export type EvidenceLineItem = { description: string; quantity: string; unit: string };
export type EvidenceUnreadable = {
  region_or_label: string;
  reason: string;
  /** percentage box on image: [x, y, w, h] in 0..1 */
  bbox?: [number, number, number, number];
};

export type EvidenceExtraction = {
  document_type: string;
  language: string;
  fields: EvidenceField[];
  line_items: EvidenceLineItem[];
  unreadable_text: EvidenceUnreadable[];
};

export type EvidenceRecord = {
  id: string;
  title: string;
  image: string;
  capturedAt: string; // ISO
  source: "manual" | "trigger";
  extraction: EvidenceExtraction;
  telemetry: {
    backend: "mtmd_cli";
    model: "LFM2.5-VL Extract";
    mode: "local";
    n_gpu_layers: 0 | 99;
    latency_sec: string; // labelled "sample"
    tokens_per_sec: string;
    rss_mb: string;
  };
};

const sampleTelemetry: EvidenceRecord["telemetry"] = {
  backend: "mtmd_cli",
  model: "LFM2.5-VL Extract",
  mode: "local",
  n_gpu_layers: 0,
  latency_sec: "sample",
  tokens_per_sec: "sample",
  rss_mb: "sample",
};

export const evidenceRecords: EvidenceRecord[] = [
  {
    id: "EV-0042",
    title: "Cold-chain delivery slip · Bay 12",
    image: deliverySlip,
    capturedAt: "2024-05-12T09:14:00+09:00",
    source: "manual",
    telemetry: sampleTelemetry,
    extraction: {
      document_type: "delivery_slip",
      language: "ja",
      fields: [
        { key: "日付", value: "2024-05-12" },
        { key: "担当", value: "田中" },
        { key: "発行元", value: "さくら物流 株式会社" },
        { key: "温度区分", value: "-18°C" },
      ],
      line_items: [
        { description: "冷凍鮪 (Frozen tuna)", quantity: "12", unit: "ケース" },
        { description: "冷凍鯖 (Frozen mackerel)", quantity: "10", unit: "ケース" },
        { description: "冷凍鮭 (Frozen salmon)", quantity: "4", unit: "ケース" },
      ],
      unreadable_text: [
        { region_or_label: "右上スタンプ脇", reason: "smudge", bbox: [0.66, 0.04, 0.22, 0.16] },
        { region_or_label: "左下端", reason: "cut off", bbox: [0.02, 0.78, 0.22, 0.14] },
      ],
    },
  },
  {
    id: "EV-0043",
    title: "Warehouse temperature log · Unit 12-A",
    image: tempLog,
    capturedAt: "2024-05-12T11:02:00+09:00",
    source: "trigger",
    telemetry: { ...sampleTelemetry, n_gpu_layers: 99 },
    extraction: {
      document_type: "temperature_log",
      language: "ja",
      fields: [
        { key: "ユニット", value: "12-A" },
        { key: "記録日", value: "2024-05-12" },
        { key: "担当者", value: "佐藤" },
      ],
      line_items: [
        { description: "08:00 measurement", quantity: "-18", unit: "°C" },
        { description: "10:00 measurement", quantity: "-19", unit: "°C" },
        { description: "12:00 measurement", quantity: "-20", unit: "°C" },
        { description: "14:00 measurement", quantity: "-18", unit: "°C" },
        { description: "16:00 measurement", quantity: "-18", unit: "°C" },
      ],
      unreadable_text: [
        { region_or_label: "右上隅", reason: "coffee stain", bbox: [0.62, 0.0, 0.34, 0.18] },
      ],
    },
  },
  {
    id: "EV-0044",
    title: "Warehouse whiteboard · morning handoff",
    image: whiteboard,
    capturedAt: "2024-05-12T08:05:00+09:00",
    source: "manual",
    telemetry: sampleTelemetry,
    extraction: {
      document_type: "whiteboard",
      language: "ja",
      fields: [
        { key: "シフト", value: "朝番" },
        { key: "場所", value: "出荷ベイ" },
      ],
      line_items: [
        { description: "受注 → 仕分け", quantity: "1", unit: "step" },
        { description: "仕分け → 温度確認", quantity: "1", unit: "step" },
        { description: "温度確認 → 出荷", quantity: "1", unit: "step" },
      ],
      unreadable_text: [
        { region_or_label: "中央右側", reason: "wiped off", bbox: [0.45, 0.45, 0.4, 0.35] },
      ],
    },
  },
  {
    id: "EV-0045",
    title: "Vendor invoice · 請求書",
    image: invoice,
    capturedAt: "2024-05-11T16:48:00+09:00",
    source: "manual",
    telemetry: sampleTelemetry,
    extraction: {
      document_type: "invoice",
      language: "ja",
      fields: [
        { key: "請求書番号", value: "INV-2024-0511" },
        { key: "請求先", value: "さくら物流 株式会社" },
        { key: "発行日", value: "2024-05-11" },
        { key: "合計", value: "unreadable" },
      ],
      line_items: [
        { description: "ドライアイス", quantity: "20", unit: "kg" },
        { description: "段ボール (大)", quantity: "150", unit: "枚" },
        { description: "保冷材", quantity: "60", unit: "個" },
      ],
      unreadable_text: [
        { region_or_label: "合計金額欄", reason: "fold crease", bbox: [0.55, 0.72, 0.36, 0.08] },
      ],
    },
  },
  {
    id: "EV-0046",
    title: "SOP page · 冷凍庫入庫手順",
    image: tempLog,
    capturedAt: "2024-05-10T10:30:00+09:00",
    source: "manual",
    telemetry: sampleTelemetry,
    extraction: {
      document_type: "sop_page",
      language: "ja",
      fields: [
        { key: "手順書番号", value: "SOP-CC-007" },
        { key: "版", value: "v3 (2022改訂)" },
      ],
      line_items: [
        { description: "1. 温度確認", quantity: "1", unit: "step" },
        { description: "2. 伝票記入", quantity: "1", unit: "step" },
        { description: "3. 入庫位置記録", quantity: "1", unit: "step" },
      ],
      unreadable_text: [],
    },
  },
  {
    id: "EV-0047",
    title: "Handwritten note · operator memo",
    image: deliverySlip,
    capturedAt: "2024-05-12T13:21:00+09:00",
    source: "trigger",
    telemetry: sampleTelemetry,
    extraction: {
      document_type: "handwritten_note",
      language: "ja",
      fields: [
        { key: "メモ作成者", value: "山本" },
        { key: "対象ユニット", value: "12-B" },
      ],
      line_items: [
        { description: "「センサー一時的に -8°C 表示」", quantity: "1", unit: "note" },
        { description: "「再起動で復帰」", quantity: "1", unit: "note" },
      ],
      unreadable_text: [
        { region_or_label: "末尾署名", reason: "illegible", bbox: [0.55, 0.85, 0.4, 0.1] },
      ],
    },
  },
];

export const getEvidenceById = (id: string) => evidenceRecords.find((r) => r.id === id);