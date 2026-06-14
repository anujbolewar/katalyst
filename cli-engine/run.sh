#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"

# Create venv if missing
if [ ! -d "$VENV_DIR" ]; then
  echo "[cli-engine] Creating virtual environment..." >&2
  python3 -m venv "$VENV_DIR"
  "$VENV_DIR/bin/pip" install -r "$SCRIPT_DIR/requirements.txt" >&2
  echo "[cli-engine] Virtual environment ready." >&2
fi

# Run the engine, passing all args through
exec "$VENV_DIR/bin/python3" "$SCRIPT_DIR/main.py" "$@"
