#!/usr/bin/env bash

# Advent One Server Orchestrator
# Launches both llama-server instances and the FastAPI web backend.

set -eo pipefail

mkdir -p logs

VL_MODEL="./models/LFM2.5-VL-450M-Extract-Q4_0.gguf"
VL_MMPROJ="./models/mmproj-LFM2.5-VL-450M-Extract-F16.gguf"
JP_MODEL="./models/LFM2.5-1.2B-JP-202606-Q4_0.gguf"

VL_PORT=8001
JP_PORT=8002
API_PORT=8000

echo "🌋 Starting Advent One Server Orchestrator..."

# Cleanup handlers for exit/sigint/sigterm
cleanup() {
    echo "🛑 Shutting down server processes..."
    if [ -n "$VL_PID" ]; then
        echo "Killing VL Server (PID: $VL_PID)"
        kill "$VL_PID" 2>/dev/null || true
    fi
    if [ -n "$JP_PID" ]; then
        echo "Killing JP Server (PID: $JP_PID)"
        kill "$JP_PID" 2>/dev/null || true
    fi
    exit 0
}

trap cleanup EXIT INT TERM

# 1. Start VL llama-server
if [ -f "$VL_MODEL" ] && [ -f "$VL_MMPROJ" ]; then
    echo "🚀 Launching VL llama-server on port $VL_PORT..."
    llama-server \
        -m "$VL_MODEL" \
        --mmproj "$VL_MMPROJ" \
        --port "$VL_PORT" \
        --n-gpu-layers -1 \
        --ctx-size 8192 \
        > logs/vl_server.log 2>&1 &
    VL_PID=$!
else
    echo "⚠️  VL model files not found. VL Server will not be started."
    VL_PID=""
fi

# 2. Start JP llama-server
if [ -f "$JP_MODEL" ]; then
    echo "🚀 Launching JP text llama-server on port $JP_PORT..."
    llama-server \
        -m "$JP_MODEL" \
        --port "$JP_PORT" \
        --n-gpu-layers -1 \
        --ctx-size 8192 \
        > logs/jp_server.log 2>&1 &
    JP_PID=$!
else
    echo "⚠️  JP text model file not found ($JP_MODEL). JP Server will not be started."
    JP_PID=""
fi

# 3. Wait/Poll health checks
poll_health() {
    local name=$1
    local port=$2
    local pid=$3
    if [ -z "$pid" ]; then
        return 0
    fi
    echo "⏳ Waiting for $name to initialize on port $port..."
    for i in {1..60}; do
        if curl -s "http://localhost:$port/health" >/dev/null; then
            echo "✅ $name is online!"
            return 0
        fi
        if ! kill -0 "$pid" 2>/dev/null; then
            echo "❌ $name crashed during startup. See logs/..."
            return 1
        fi
        sleep 1
    done
    echo "❌ Timeout waiting for $name to boot."
    return 1
}

poll_health "VL Server" "$VL_PORT" "$VL_PID"
poll_health "JP Server" "$JP_PORT" "$JP_PID"

# 4. Launch FastAPI app
echo "🚀 Booting FastAPI web service on port $API_PORT..."
uv run python -m uvicorn src.advent_one.main:app --host 0.0.0.0 --port "$API_PORT" --reload
