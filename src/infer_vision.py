import os
import sys
import json
import time
import argparse
import subprocess
import re
from dotenv import load_dotenv

# Ensure we can import from src
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.utils.logger import log_inference, logger
from src.aggregate import aggregate_evidence

# Load environment variables
load_dotenv()


def parse_schema_args(schema_inline: str | None, schema_file: str | None) -> dict | None:
    if schema_inline and schema_file:
        raise ValueError("Provide either --schema or --schema-file, not both.")

    if schema_inline:
        try:
            return json.loads(schema_inline)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse JSON schema string: {e}") from e

    if schema_file:
        if not os.path.exists(schema_file):
            raise ValueError(f"Schema file not found: {schema_file}")
        try:
            with open(schema_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            raise ValueError(f"Schema file is not valid JSON: {e}") from e
        except OSError as e:
            raise ValueError(f"Failed to read schema file: {e}") from e

    return None


def validate_output_shape(output_text: str, schema_dict: dict | None) -> None:
    if not schema_dict:
        return

    try:
        parsed = json.loads(output_text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Model output is not valid JSON: {e}") from e

    if not isinstance(parsed, dict):
        raise ValueError("Model output must be a JSON object when schema guidance is enabled.")

    required = schema_dict.get("required", [])
    if isinstance(required, list):
        missing = [key for key in required if key not in parsed]
        if missing:
            raise ValueError(f"Model output is missing required keys: {missing}")

    properties = schema_dict.get("properties", {})
    additional_properties = schema_dict.get("additionalProperties", True)
    if isinstance(properties, dict) and additional_properties is False:
        unexpected = [key for key in parsed.keys() if key not in properties]
        if unexpected:
            raise ValueError(f"Model output contains unexpected keys: {unexpected}")


def strip_ansi(text: str) -> str:
    ansi_pattern = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]")
    return ansi_pattern.sub("", text)


def extract_last_balanced_json_object(text: str) -> str | None:
    in_string = False
    escaped = False
    depth = 0
    start = -1
    candidates: list[str] = []

    for i, ch in enumerate(text):
        if escaped:
            escaped = False
            continue
        if ch == "\\":
            escaped = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue

        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            if depth > 0:
                depth -= 1
                if depth == 0 and start != -1:
                    candidates.append(text[start:i + 1])
                    start = -1

    if candidates:
        return candidates[-1]

    first = text.find("{")
    last = text.rfind("}")
    if first != -1 and last != -1 and first < last:
        return text[first:last + 1]
    return None


def parse_mtmd_json_output(stdout_text: str, stderr_text: str) -> str:
    cleaned_stdout = strip_ansi(stdout_text)
    candidate = extract_last_balanced_json_object(cleaned_stdout)
    if not candidate:
        raise ValueError(
            "Failed to find JSON object in llama-mtmd-cli output.\n"
            f"STDOUT:\n{stdout_text}\n\nSTDERR:\n{stderr_text}"
        )

    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"Extracted JSON block is invalid: {e}.\n"
            f"Extracted block:\n{candidate}\n\nSTDOUT:\n{stdout_text}\n\nSTDERR:\n{stderr_text}"
        ) from e

    if not isinstance(parsed, dict):
        raise ValueError(
            "llama-mtmd-cli output JSON must be an object for this workflow.\n"
            f"STDOUT:\n{stdout_text}\n\nSTDERR:\n{stderr_text}"
        )

    return json.dumps(parsed, ensure_ascii=False)


def run_mtmd_cli(args: argparse.Namespace) -> tuple[str, float, int | None]:
    if not args.mmproj:
        raise ValueError("--mmproj is required when --backend mtmd_cli is used.")
    if not os.path.exists(args.mmproj):
        raise ValueError(f"Multimodal projector file not found: {args.mmproj}")
    if not os.path.exists(args.image):
        raise ValueError(f"Input image not found: {args.image}")

    mtmd_cli_path = args.mtmd_cli_path or os.getenv("MTMD_CLI_PATH") or "llama-mtmd-cli"

    command = [
        mtmd_cli_path,
        "-m", args.model,
        "--mmproj", args.mmproj,
        "--image", args.image,
        "-p", args.prompt,
        "-n", str(args.max_tokens),
        "--temp", str(args.temp),
        "--repeat-penalty", str(args.repeat_penalty),
        "-ngl", str(args.n_gpu_layers),
        "--threads", str(args.threads),
    ]

    if args.grammar_file:
        if not os.path.exists(args.grammar_file):
            raise ValueError(f"Grammar file not found: {args.grammar_file}")
        command.extend(["--grammar-file", args.grammar_file])
    else:
        logger.warning(
            "No --grammar-file provided for mtmd_cli backend. Free-form output may not be valid JSON."
        )

    logger.info(f"Running mtmd backend via executable: {mtmd_cli_path}")
    start_time = time.perf_counter()
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    latency = time.perf_counter() - start_time

    if result.returncode != 0:
        raise RuntimeError(
            f"llama-mtmd-cli failed with exit code {result.returncode}.\n"
            f"STDOUT:\n{result.stdout}\n\nSTDERR:\n{result.stderr}"
        )

    output_text = parse_mtmd_json_output(result.stdout, result.stderr)
    return output_text, latency, None

def main():
    parser = argparse.ArgumentParser(description="Liquid Hackathon: Vision/Text Edge Inference Boilerplate")
    parser.add_argument("--mode", choices=["extract", "aggregate"], default="extract", help="Run extraction inference (default) or deterministic Stage-2 aggregation over existing Stage-1 records.")
    parser.add_argument("--backend", choices=["python_llama_cpp", "mtmd_cli"], default="python_llama_cpp", help="Inference backend. Keep python_llama_cpp for existing behavior; use mtmd_cli for validated Liquid VLM multimodal path.")
    parser.add_argument("--model", type=str, default=None, help="Path to local GGUF model file.")
    parser.add_argument("--mmproj", type=str, default=None, help="Path to multimodal projector GGUF file (required for LLaVA/vision models).")
    parser.add_argument("--image", type=str, default="data/samples/sample_image.jpg", help="Path to input image file.")
    parser.add_argument("--prompt", type=str, default="Describe the image in detail.", help="Inference prompt.")
    parser.add_argument("--schema", type=str, default=None, help="JSON string representing the target output JSON schema for guided generation.")
    parser.add_argument("--schema-file", type=str, default=None, help="Path to JSON schema file for guided generation.")
    parser.add_argument("--grammar-file", type=str, default=None, help="Path to GBNF grammar file (recommended for --backend mtmd_cli structured output).")
    parser.add_argument("--mtmd-cli-path", type=str, default=None, help="Path to llama-mtmd-cli executable. Can also be set via MTMD_CLI_PATH.")
    parser.add_argument("--max-tokens", type=int, default=512, help="Maximum number of tokens to generate.")
    parser.add_argument("--temp", type=float, default=0.2, help="Temperature for inference sampling.")
    parser.add_argument("--repeat-penalty", type=float, default=1.1, help="Repeat penalty used for inference (mtmd_cli backend).")
    parser.add_argument("--n-gpu-layers", type=int, default=0, help="Number of layers to offload to GPU. Use 0 for CPU compatibility; test higher values (e.g., 99) on validated Vulkan demo hardware.")
    parser.add_argument("--threads", type=int, default=4, help="Number of CPU threads for inference (mtmd_cli backend).")
    parser.add_argument("--records-file", type=str, default=None, help="Path to a JSON file containing a list of Stage-1 extraction records for --mode aggregate.")
    
    args = parser.parse_args()

    if args.mode == "aggregate":
        if not args.records_file:
            logger.error("--records-file is required when --mode aggregate is used.")
            sys.exit(1)
        if not os.path.exists(args.records_file):
            logger.error(f"Records file not found: {args.records_file}")
            sys.exit(1)

        try:
            with open(args.records_file, "r", encoding="utf-8") as f:
                records = json.load(f)
        except json.JSONDecodeError as e:
            logger.error(f"Records file is not valid JSON: {e}")
            sys.exit(1)
        except OSError as e:
            logger.error(f"Failed to read records file: {e}")
            sys.exit(1)

        if not isinstance(records, list):
            logger.error("Records file JSON must be an array of extraction record objects.")
            sys.exit(1)

        aggregated = aggregate_evidence(records)
        print(json.dumps(aggregated, ensure_ascii=False, indent=2))
        return

    # Verify model file exists
    if not args.model:
        logger.error("--model is required when --mode extract is used.")
        sys.exit(1)
    if not os.path.exists(args.model):
        logger.error(f"Model file not found: {args.model}")
        sys.exit(1)
        
    # Check for image if vision is requested
    image_bytes = None
    if args.backend == "python_llama_cpp" and args.mmproj:
        if not os.path.exists(args.mmproj):
            logger.error(f"Multimodal projector file not found: {args.mmproj}")
            sys.exit(1)
        if not os.path.exists(args.image):
            logger.error(f"Input image not found: {args.image}")
            sys.exit(1)
        
        # Read the image and prepare bytes (llama-cpp-python expectations)
        try:
            with open(args.image, "rb") as f:
                image_bytes = f.read()
            logger.info(f"Loaded image: {args.image}")
        except Exception as e:
            logger.error(f"Failed to read image {args.image}: {e}")
            sys.exit(1)

    # Parse JSON schema if provided
    response_format = None
    schema_dict = None
    if args.backend == "python_llama_cpp":
        try:
            schema_dict = parse_schema_args(args.schema, args.schema_file)
        except ValueError as e:
            logger.error(str(e))
            sys.exit(1)

        if schema_dict is not None:
            response_format = {
                "type": "json_object",
                "schema": schema_dict
            }
            logger.info("Structured JSON schema guided generation enabled.")
    else:
        if args.schema or args.schema_file:
            logger.warning("--schema/--schema-file are only applied by --backend python_llama_cpp. Use --grammar-file with --backend mtmd_cli.")

    if args.backend == "mtmd_cli":
        try:
            output_text, latency, tokens_generated = run_mtmd_cli(args)
        except (ValueError, RuntimeError) as e:
            logger.error(str(e))
            sys.exit(1)
    else:
        # Initialize llama-cpp-python
        logger.info(f"Loading model: {args.model} with llama-cpp-python backend...")

        try:
            from llama_cpp import Llama

            # Initialize Llama model
            llm = Llama(
                model_path=args.model,
                n_gpu_layers=args.n_gpu_layers,
                n_ctx=2048,
                verbose=False
            )

            # Setup Multimodal chat handler if vision projector is passed
            chat_handler = None
            if args.mmproj:
                from llama_cpp.llama_chat_format import LlamaLlavaChatHandler
                # NOTE: This LlamaLlavaChatHandler path is currently experimental for
                # Liquid LFM2.5-VL Extract models. The known-good validated path so far
                # is llama-mtmd-cli + mmproj + grammar-constrained output.
                # Runtime-verify both paths before relying on this in demos.
                logger.info("Initializing Llava Chat Handler with projector...")
                chat_handler = LlamaLlavaChatHandler(clip_model_path=args.mmproj, verbose=False)

        except ImportError as e:
            logger.error(f"llama-cpp-python or required components not installed correctly: {e}")
            logger.error("Verify your llama-cpp-python installation for your target platform.")
            sys.exit(1)
        except Exception as e:
            logger.error(f"Failed to load GGUF model: {e}")
            sys.exit(1)

        # Prepare chat prompt / messages
        if chat_handler:
            # Multimodal Vision Prompt
            # We need to construct a message structure with image URLs/data
            # Standard llava format uses base64 data url
            import base64
            ext = os.path.splitext(args.image)[1].lower().replace(".", "")
            if ext == "jpg":
                ext = "jpeg"
            base64_image = base64.b64encode(image_bytes).decode("utf-8")
            image_url = f"data:image/{ext};base64,{base64_image}"

            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": args.prompt},
                        {"type": "image_url", "image_url": {"url": image_url}}
                    ]
                }
            ]

            # Let's perform Chat completion with clip handler
            logger.info("Starting multimodal inference...")
            start_time = time.perf_counter()

            # Note: Guided generation is usually passed to create_chat_completion via response_format
            response = llm.create_chat_completion(
                messages=messages,
                chat_handler=chat_handler,
                max_tokens=args.max_tokens,
                temperature=args.temp,
                response_format=response_format
            )
            latency = time.perf_counter() - start_time

            # Extract text response
            output_text = response["choices"][0]["message"]["content"]
            tokens_generated = response["usage"]["completion_tokens"]

        else:
            # Standard Text-only Prompt / Structured guided generation
            logger.info("Starting text-only inference...")

            # Note: If no schema, standard generation is used
            start_time = time.perf_counter()
            if response_format:
                response = llm.create_chat_completion(
                    messages=[{"role": "user", "content": args.prompt}],
                    max_tokens=args.max_tokens,
                    temperature=args.temp,
                    response_format=response_format
                )
                latency = time.perf_counter() - start_time
                output_text = response["choices"][0]["message"]["content"]
                tokens_generated = response["usage"]["completion_tokens"]
            else:
                response = llm(
                    prompt=f"User: {args.prompt}\nAssistant:",
                    max_tokens=args.max_tokens,
                    temperature=args.temp,
                    stop=["User:", "\n"]
                )
                latency = time.perf_counter() - start_time
                output_text = response["choices"][0]["text"]
                # llama_cpp prompt/completion token usage is structured as:
                tokens_generated = response["usage"]["completion_tokens"]

        try:
            validate_output_shape(output_text, schema_dict)
        except ValueError as e:
            logger.error(str(e))
            sys.exit(1)

    # Log results
    log_inference(
        latency_sec=latency,
        prompt=args.prompt,
        tokens_generated=tokens_generated,
        extra_metrics={
            "model_path": args.model,
            "backend": args.backend,
            "has_vision": args.mmproj is not None,
            "has_schema": schema_dict is not None,
            "has_grammar": args.grammar_file is not None
        }
    )

    # Output response
    print("\n" + "=" * 40 + " MODEL OUTPUT " + "=" * 40)
    try:
        parsed_output = json.loads(output_text)
        print(json.dumps(parsed_output, ensure_ascii=False, indent=2))
    except json.JSONDecodeError:
        print(output_text)
    print("=" * 94 + "\n")

if __name__ == "__main__":
    main()
