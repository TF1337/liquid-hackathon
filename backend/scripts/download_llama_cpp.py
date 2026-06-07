import os
import sys
import json
import urllib.request
import zipfile

def main():
    print("🔍 Fetching latest llama.cpp release from GitHub...")
    api_url = "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest"
    
    headers = {"User-Agent": "Mozilla/5.0"}
    req = urllib.request.Request(api_url, headers=headers)
    
    try:
        with urllib.request.urlopen(req) as response:
            release_data = json.loads(response.read().decode())
    except Exception as e:
        print(f"❌ Failed to query GitHub API: {e}")
        return 1

    assets = release_data.get("assets", [])
    download_url = None
    file_name = None
    
    for asset in assets:
        name = asset.get("name", "")
        if "win-vulkan" in name and name.endswith(".zip"):
            download_url = asset.get("browser_download_url")
            file_name = name
            break
            
    if not download_url:
        print("❌ Could not find a Windows Vulkan build (.zip) in the latest release assets.")
        return 1

    print(f"📥 Found build: {file_name}")
    print(f"📥 Downloading from {download_url}...")
    
    target_zip = os.path.join(os.getcwd(), file_name)
    
    try:
        # Download the file
        urllib.request.urlretrieve(download_url, target_zip)
        print("✅ Download completed.")
    except Exception as e:
        print(f"❌ Failed to download file: {e}")
        return 1
        
    # Extract zip
    extract_dir = os.path.join(os.getcwd(), "llama-bin")
    print(f"📦 Extracting to {extract_dir}...")
    os.makedirs(extract_dir, exist_ok=True)
    
    try:
        with zipfile.ZipFile(target_zip, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
        print("✅ Extraction completed successfully.")
    except Exception as e:
        print(f"❌ Failed to extract zip: {e}")
        return 1
    finally:
        # Clean up zip file
        if os.path.exists(target_zip):
            os.remove(target_zip)
            
    print("\n🎉 Success! llama.cpp is set up.")
    print(f"You can now run llama-server.exe from: {os.path.join(extract_dir, 'llama-server.exe')}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
