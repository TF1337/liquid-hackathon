import os
import sys
import json
import time
import argparse
from PIL import Image
from dotenv import load_dotenv

# Ensure we can import from src
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.utils.logger import log_inference, logger

# Load environment variables
load_dotenv()

def main():
    parser = argparse.ArgumentParser(description="Liquid Hackathon: Vision/Text Edge Inference Boilerplate")
    parser.add_argument("--model", type=str, required=True, help="Path to local GGUF model file.")
    parser.add_argument("--mmproj", type=str, default=None, help="Path to multimodal projector GGUF file (required for LLaVA/vision models).")
    parser.add_argument("--image", type=str, default="data/samples/sample_image.jpg", help="Path to input image file.")
    parser.add_argument("--prompt", type=str, default="Describe the image in detail.", help="Inference prompt.")
    parser.add_argument("--schema", type=str, default=None, help="JSON string representing the target output JSON schema for guided generation.")
    parser.add_argument("--max-tokens", type=int, default=512, help="Maximum number of tokens to generate.")
    parser.add_argument("--temp", type=float, default=0.2, help="Temperature for inference sampling.")
    
    args = parser.parse_args()

    # Verify model file exists
    if not os.path.exists(args.model):
        logger.error(f"Model file not found: {args.model}")
        sys.exit(1)
        
    # Check for image if vision is requested
    image_bytes = None
    if args.mmproj:
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
    if args.schema:
        try:
            schema_dict = json.loads(args.schema)
            response_format = {
                "type": "json_object",
                "schema": schema_dict
            }
            logger.info("Structured JSON schema guided generation enabled.")
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON schema string: {e}")
            sys.exit(1)

    # Initialize llama-cpp-python with Metal support (-1 offloads all layers to Apple Silicon GPU)
    logger.info(f"Loading model: {args.model} with Apple Silicon Metal acceleration enabled...")
    
    try:
        from llama_cpp import Llama
        
        # Initialize Llama model
        llm = Llama(
            model_path=args.model,
            n_gpu_layers=-1,  # Offload all layers to GPU (Metal)
            n_ctx=2048,       # Context window size
            verbose=False     # Suppress spammy C level output
        )
        
        # Setup Multimodal chat handler if vision projector is passed
        chat_handler = None
        if args.mmproj:
            from llama_cpp.llama_chat_format import LlamaLlavaChatHandler
            logger.info("Initializing Llava Chat Handler with projector...")
            chat_handler = LlamaLlavaChatHandler(clip_model_path=args.mmproj, verbose=False)
            
    except ImportError as e:
        logger.error(f"llama-cpp-python or required components not installed correctly: {e}")
        logger.error("Verify your installation: CMAKE_ARGS='-DGGML_METAL=on' uv pip install llama-cpp-python --no-binary llama-cpp-python")
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

    # Log results
    log_inference(
        latency_sec=latency,
        prompt=args.prompt,
        tokens_generated=tokens_generated,
        extra_metrics={
            "model_path": args.model,
            "has_vision": args.mmproj is not None,
            "has_schema": args.schema is not None
        }
    )

    # Output response
    print("\n" + "=" * 40 + " MODEL OUTPUT " + "=" * 40)
    print(output_text)
    print("=" * 94 + "\n")

if __name__ == "__main__":
    main()
