import os
import time
import logging
import platform
from typing import Optional, Any, Dict
from dotenv import load_dotenv

try:
    import resource
except ImportError:
    resource = None

# Load env variables from .env
load_dotenv()

# Setup local console logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("liquid-hackathon")

# Check for wandb and initialize if api key is provided
WANDB_ENABLED = False
try:
    if os.getenv("WANDB_API_KEY"):
        import wandb
        wandb.init(
            project="liquid-hackathon-baseline",
            config={
                "platform": platform.platform(),
                "processor": platform.processor(),
                "python_version": platform.python_version()
            }
        )
        WANDB_ENABLED = True
        logger.info("Weights & Biases initialized successfully.")
    else:
        logger.warning("WANDB_API_KEY not found in environment. Running in console-only logging mode.")
except Exception as e:
    logger.error(f"Failed to initialize Weights & Biases: {e}. Falling back to console logging.")

def get_system_metrics() -> Dict[str, Any]:
    """Retrieves basic system resource usage metrics."""
    max_rss_mb: float | None = None
    if resource is not None:
        max_rss_bytes = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        max_rss_mb = max_rss_bytes / (1024 * 1024)

    return {
        "max_rss_mb": round(max_rss_mb, 2) if max_rss_mb is not None else None,
        "timestamp": time.time()
    }

def log_inference(
    latency_sec: float,
    prompt: str,
    tokens_generated: Optional[int] = None,
    extra_metrics: Optional[Dict[str, Any]] = None
) -> None:
    """Logs the inference metrics to console and optionally to Weights & Biases."""
    system_metrics = get_system_metrics()
    
    # Calculate tokens per second if applicable
    tokens_per_sec = None
    if tokens_generated and latency_sec > 0:
        tokens_per_sec = tokens_generated / latency_sec

    # Combine all metrics
    metrics = {
        "inference_latency_sec": latency_sec,
        "max_rss_mb": system_metrics["max_rss_mb"],
    }
    if tokens_generated:
        metrics["tokens_generated"] = tokens_generated
    if tokens_per_sec:
        metrics["tokens_per_second"] = tokens_per_sec
        
    if extra_metrics:
        metrics.update(extra_metrics)

    # Log to Console
    log_msg = f"Inference Complete | Latency: {latency_sec:.4f}s"
    if tokens_per_sec:
        log_msg += f" | {tokens_per_sec:.2f} tok/s"
    if metrics["max_rss_mb"] is not None:
        log_msg += f" | Mem: {metrics['max_rss_mb']} MB"
    else:
        log_msg += " | Mem: unavailable"
    logger.info(log_msg)
    logger.info(f"Prompt content: {prompt[:100]}...")

    # Log to Weights & Biases
    if WANDB_ENABLED:
        try:
            import wandb
            wandb.log(metrics)
        except Exception as e:
            logger.error(f"Failed to log to wandb: {e}")
