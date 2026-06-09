#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Katalyst — Full Setup & Run Script
# Usage: ./setup.sh [--no-browser] [--daemon]
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

KATALYST_DB="data/katalyst.db"
PORT=3000
URL="http://localhost:$PORT"
NO_BROWSER=false
START_DAEMON=false

for arg in "$@"; do
  case $arg in
    --no-browser) NO_BROWSER=true ;;
    --daemon)     START_DAEMON=true ;;
  esac
done

# ─── 1. Check prerequisites ─────────────────────────────────────────────────
echo ""
echo "=== Katalyst Setup ==="
echo ""

command -v node  &>/dev/null || { echo "❌ Node.js not found. Install via nvm or apt."; exit 1; }
command -v pnpm  &>/dev/null || { echo "❌ pnpm not found. Install: npm i -g pnpm"; exit 1; }
echo "✓ Node $(node -v), pnpm $(pnpm -v)"

# Check LLM backend
if command -v opencode &>/dev/null; then
  echo "✓ opencode detected (primary LLM)"
elif command -v claude &>/dev/null; then
  echo "✓ claude detected (fallback LLM)"
else
  echo "⚠ No LLM backend found — goal decomposition won't work."
  echo "  Install: npm i -g @anthropic-ai/claude-code"
fi

# ─── 2. Install dependencies ────────────────────────────────────────────────
echo ""
echo "Installing dependencies..."
pnpm install --silent 2>&1 | tail -1
echo "✓ Dependencies installed"

# ─── 3. Database setup ──────────────────────────────────────────────────────
echo ""
if [ -f "$KATALYST_DB" ]; then
  echo "✓ SQLite database found (data/katalyst.db)"
else
  echo "Setting up SQLite database..."
  if [ -f "data/tasks.json" ]; then
    echo "  Migrating JSON → SQLite..."
    npx tsx scripts/migrate-to-sqlite.ts 2>&1 | tail -3
    echo "✓ Migration complete — backup at data/backup-json/"
  else
    echo "  Fresh database — run seed:demo later to populate"
  fi
fi

# ─── 4. Build check (optional, fast) ────────────────────────────────────────
echo ""
echo "Running type check..."
npx tsc --noEmit 2>/dev/null && echo "✓ TypeScript OK" || echo "⚠ TypeScript warnings (safe to ignore)"

# ─── 5. Start server ────────────────────────────────────────────────────────
echo ""
echo "=== Starting Katalyst ==="
echo "  URL:  $URL"
echo "  Stop: Ctrl+C"
echo ""

# Cleanup handler
cleanup() {
  echo ""
  echo "[Katalyst] Shutting down..."
  kill $DEV_PID 2>/dev/null || true
  kill $DAEMON_PID 2>/dev/null || true
  echo "[Katalyst] Stopped."
}
trap cleanup EXIT INT TERM

# Start dev server
pnpm dev &
DEV_PID=$!
echo "[Katalyst] Dev server PID: $DEV_PID"

# Start daemon if requested
if $START_DAEMON; then
  sleep 3
  npx tsx scripts/daemon/index.ts start &
  DAEMON_PID=$!
  echo "[Katalyst] Agent daemon PID: $DAEMON_PID"
fi

# Open browser
if ! $NO_BROWSER; then
  (
    for i in $(seq 1 30); do
      sleep 2
      if curl -s -o /dev/null "$URL" 2>/dev/null; then
        if command -v xdg-open &>/dev/null; then xdg-open "$URL" 2>/dev/null
        elif command -v open &>/dev/null; then open "$URL" 2>/dev/null
        fi
        break
      fi
    done
  ) &
fi

# Wait for server
wait $DEV_PID 2>/dev/null || true
