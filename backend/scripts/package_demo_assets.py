import os
import shutil
import zipfile

# Define source and destination paths
workspace_dir = r"c:\Users\Jonat\Downloads\liquid-hackathon"
assets_dir_name = "MAPLE_SYRUP_Track1_HackTheLiquidWAY_DemoAssets"
target_dir = os.path.join(workspace_dir, assets_dir_name)
zip_filename = os.path.join(workspace_dir, f"{assets_dir_name}.zip")
password = b"MapleSyrupLiquid2026!"

print("[INFO] Creating packaging directory...")
if os.path.exists(target_dir):
    shutil.rmtree(target_dir)
os.makedirs(target_dir, exist_ok=True)
os.makedirs(os.path.join(target_dir, "screenshots"), exist_ok=True)

# 1. Copy Video
video_src = os.path.join(workspace_dir, "2026-06-07 14-50-58.mp4")
video_dest = os.path.join(target_dir, "advent_one_demo.mp4")
if os.path.exists(video_src):
    print("[INFO] Copying demo video...")
    shutil.copy2(video_src, video_dest)
else:
    print("[WARN] Demo video not found in workspace root!")

# 2. Copy screenshots
screenshots = {
    "Screenshot 2026-06-07 144453.png": "screenshot_1_overview.png",
    "Screenshot 2026-06-07 144518.png": "screenshot_2_capture.png",
    "Screenshot 2026-06-07 144612.png": "screenshot_3_records.png",
    "Screenshot 2026-06-07 144735.png": "screenshot_4_workflow.png",
    "Screenshot 2026-06-07 144753.png": "screenshot_5_strategy.png",
}

for src_name, dest_name in screenshots.items():
    src_path = os.path.join(workspace_dir, src_name)
    dest_path = os.path.join(target_dir, "screenshots", dest_name)
    if os.path.exists(src_path):
        print(f"[INFO] Copying {dest_name}...")
        shutil.copy2(src_path, dest_path)
    else:
        print(f"[WARN] Screenshot {src_name} not found!")

# 3. Copy team photo
photo_src = os.path.join(workspace_dir, "team_picture.jpg")
photo_dest = os.path.join(target_dir, "team_photo.jpg")
if os.path.exists(photo_src):
    print("[INFO] Copying team picture...")
    shutil.copy2(photo_src, photo_dest)
else:
    print("[WARN] Team picture not found!")

# 4. Write README.txt
readme_content = """========================================================================
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
"""

print("[INFO] Writing README.txt...")
with open(os.path.join(target_dir, "README.txt"), "w", encoding="utf-8") as f:
    f.write(readme_content)

# 5. Zip and encrypt the folder
print("[INFO] Creating encrypted ZIP file...")
try:
    import pyzipper
    with pyzipper.AESZipFile(zip_filename, "w", compression=pyzipper.ZIP_DEFLATED, encryption=pyzipper.SECURE_AE_2) as zf:
        zf.setpassword(password)
        for root, dirs, files in os.walk(target_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, workspace_dir)
                zf.write(file_path, arcname)
    print(f"[SUCCESS] Successfully created encrypted zip at: {zip_filename}")
except ImportError:
    print("[WARN] pyzipper is not installed. Falling back to traditional zipfile (legacy password encryption)...")
    # Legacy zip encryption fallback
    with zipfile.ZipFile(zip_filename, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(target_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, workspace_dir)
                zf.write(file_path, arcname)
    print(f"[SUCCESS] Created fallback ZIP at: {zip_filename}. Please run 'pip install pyzipper' to encrypt it.")

# Cleanup temporary folder
shutil.rmtree(target_dir)
print("[INFO] Cleaned up temporary folders.")
