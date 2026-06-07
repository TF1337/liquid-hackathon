# Osaka Demo Scenario — Yoshimura Transport K.K.

This document outlines a high-fidelity demonstration scenario centered around an Osaka-based logistics SME. Use this scenario and the search keywords below to build a realistic dataset for your diligence copilot demo.

---

## 1. The Target Company (Rollup Target)

* **Company Name:** **Yoshimura Transport Co., Ltd. (吉村運送株式会社)**
* **Location:** Higashiosaka, Osaka (東大阪市) — the manufacturing heart of the Kansai region.
* **Established:** 1992 (34 years of operation).
* **Founder & CEO:** **吉村社長 (President Yoshimura)** — age 71, looking to retire with no successor.
* **Business Profile:** 
  A small-to-medium enterprise (SME) specializing in regional cargo transport, warehousing, and logistics dispatch for local manufacturing factories (町工場) in Higashiosaka.
* **Problem Statement:** 
  The company relies entirely on paper-based documents and verbal confirmations from 吉村社長. The operation suffers from severe owner-dependency; no major order or route plan can proceed without his direct verbal sign-off.

---

## 2. The 5 Diligence Documents (Sample Set)

You can collect real-world document layouts from the web to simulate this scenario. Save these images to your `backend/data/samples/` directory and run the extraction engine on them.

### Document 1: Gas/Fuel Receipt
* **Context:** Driver refueling expense receipt.
* **Google Images Search Term:** `出光 領収書 画像` or `ガソリンスタンド 領収書`
* **Target Data:** A thermal paper receipt from Idemitsu (or Cosmo Oil) showing a charge of `8,500円` for truck fuel.

### Document 2: Courier Delivery Slip
* **Context:** Handwritten dispatch slip from a local delivery run.
* **Google Images Search Term:** `赤帽 伝票 画像` or `運送 送り状 手書き`
* **Target Data:** A carbon-copy manual shipping label showing a local Osaka delivery address (e.g. `大阪府東大阪市...`) and driver signatures.

### Document 3: Daily Dispatch Board
* **Context:** The company's daily truck dispatch and route scheduling board.
* **Google Images Search Term:** `配車表 ホワイトボード` or `運行管理 ホワイトボード 運送`
* **Target Data:** A whiteboard schedule detailing truck numbers, routes, and driver names written in dry-erase marker.

### Document 4: Order Form / Invoice
* **Context:** Transaction form from a local manufacturer requesting shipping services.
* **Google Images Search Term:** `注文書 サンプル freee` or `請求書 テンプレート 無料`
* **Target Data:** A standard business invoice template showing cargo dispatch details billed to local manufacturing clients.

### Document 5: Hand-Annotated Sticky Note
* **Context:** An urgent memo attached to the order sheet.
* **Creation Method:** Write **`吉村社長確認待ち`** (Waiting for President Yoshimura's confirmation) on a real sticky note, stick it to one of your printouts, and snap a picture of it.
* **Significance:** The presence of the keyword `吉村社長` will trigger the synthesis engine to flag this node as a founder-dependent bottleneck in the workflow graph.

---

## 3. Testing the Pipeline

Once the images are saved in `backend/data/samples/`, you can test the extraction and synthesis end-to-end:

1. **Activate Environment:**
   ```powershell
   cd backend
   .venv\Scripts\activate
   ```

2. **Run the Smoke Test for a single image:**
   ```powershell
   python scripts/smoke_test.py data/samples/your_downloaded_image.jpg
   ```
   *Verify that the extraction latency is logged under 3 seconds and the Pydantic type validator passes without errors.*
