import argparse
import json
import os
import traceback

import httpx


def pretty(title: str, payload: object) -> None:
    print(f"\n=== {title} ===")
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def _dump_http_error(step: str, exc: httpx.HTTPStatusError) -> None:
    response = exc.response
    print(f"\n[ERROR] Step '{step}' failed with HTTP {response.status_code}")
    print(f"[ERROR] URL: {response.request.method} {response.request.url}")
    body = response.text
    if body:
        print("[ERROR] Response body:")
        print(body)


def main() -> int:
    parser = argparse.ArgumentParser(description="Advent One backend smoke test")
    parser.add_argument("image_path", help="Path to test image")
    args = parser.parse_args()

    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")

    if not os.path.exists(args.image_path):
        raise FileNotFoundError(f"Image file not found: {args.image_path}")

    with httpx.Client(timeout=120.0) as client:
        try:
            health = client.get(f"{backend_url}/health")
            health.raise_for_status()
            pretty("health", health.json())

            trigger = client.post(f"{backend_url}/trigger", json={"source": "smoke-test"})
            trigger.raise_for_status()
            pretty("trigger", trigger.json())

            with open(args.image_path, "rb") as f:
                extract = client.post(
                    f"{backend_url}/extract",
                    params={"schema": os.getenv("ACTIVE_SCHEMA", "sakura_logistics")},
                    files={"file": (os.path.basename(args.image_path), f, "image/jpeg")},
                )
            extract.raise_for_status()
            pretty("extract", extract.json())

            synthesize = client.post(f"{backend_url}/synthesize")
            synthesize.raise_for_status()
            synth_data = synthesize.json()
            pretty("synthesize", synth_data)
            print(f"Synthesis source: {synth_data.get('source')}")

            facts = client.get(f"{backend_url}/facts")
            facts.raise_for_status()
            pretty("facts", facts.json())

            graph = client.get(f"{backend_url}/graph")
            graph.raise_for_status()
            pretty("graph", graph.json())
        except httpx.HTTPStatusError as e:
            _dump_http_error("request", e)
            raise
        except Exception:
            print("\n[ERROR] Smoke test failed with unexpected exception:")
            print(traceback.format_exc())
            raise

    print("\n🟢 end-to-end pipeline OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
