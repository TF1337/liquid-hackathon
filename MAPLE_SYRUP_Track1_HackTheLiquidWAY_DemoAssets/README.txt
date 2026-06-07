========================================================================
             TEAM MAPLE SYRUP - TRACK 1 HACKATHON DEMO ASSETS
========================================================================

Project Name: Advent One
Team Name: Maple Syrup
Track: Track 1 (Cold-Chain Logistics / M&A Intelligence Platform)

------------------------------------------------------------------------
1. File Descriptions
------------------------------------------------------------------------
- advent_one_demo.mp4: 60-90 second walkthrough of the physical appliance
  and UI flow, highlighting edge vision document extraction and workflow
  synthesis.
- team_photo.jpg: Team photo of Maple Syrup.
- screenshots/:
  * screenshot_1_overview.png: Main dashboard showing key M&A telemetry.
  * screenshot_2_capture.png: Capture interface showing webcam and USB serial.
  * screenshot_3_records.png: List of extracted document facts.
  * screenshot_4_workflow.png: Interactive reconstructed React Flow graph.
  * screenshot_5_strategy.png: Modernization strategy results dashboard.

------------------------------------------------------------------------
2. Team Biographies
------------------------------------------------------------------------
- Jonathan Setiawan: Frontend Architect & Design Lead
  Built the React-based real-time telemetry console, custom Reaction Flow
  graph builder, and webcam auto-trigger countdown.

- Danett Dellano: ML Operations & Vulkan Model Deployment Specialist
  Quantized and set up Liquid Extract LFM models on-device, enabling
  Vulkan-accelerated document extraction under 1.5s.

- Freek Wijn: Embedded Systems & Microcontroller Integrator
  Integrated the physical ESP32 PIR sensor link over COM3 serial interface
  to enable automatic document scanning.

------------------------------------------------------------------------
3. Demo Setup & Execution Instructions
------------------------------------------------------------------------
Advent One is built for 100% offline edge processing on an AMD Ryzen AI PC.

Prerequisites:
- Python 3.10+
- Node.js 18+
- llama.cpp pre-installed

Step 1: Hardware Ingestion Setup (Optional Link)
- Plug your ESP32 PIR microcontroller board into the USB port.
- Confirm it attaches to COM3.

Step 2: Model Servers & Backend Startup
- Navigate to the backend directory:
  cd backend
- Run the startup script to load LFM2.5-VL and JP reasoning model servers:
  ./scripts/run_servers.sh
- This will boot the LLM servers and start the FastAPI orchestrator on port 8000.

Step 3: Frontend Startup
- Navigate to the frontend directory:
  cd frontend
- Start the Vite development server:
  npm run dev
- Open your browser and navigate to http://localhost:8080/

Step 4: Real-time Ingestion Demo
- Click on 'Capture' in the sidebar.
- Toggle 'Auto-Trigger Mode' to ON (USB Serial status should display Connected).
- Wave your hand in front of the PIR sensor.
- The UI will trigger a 3-second camera countdown overlay and take a webcam photo.
- Click 'Approve Ingestion' to extract JSON facts instantly and generate post-acquisition strategy maps.
