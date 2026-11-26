#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================="
echo "  Email Cards"
echo "========================================="
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is required (v22+ recommended). Please install Node.js and try again."
  read -r -p "Press Enter to close..."
  exit 1
fi

if [ ! -d "node_modules" ] || [ ! -d "server/node_modules" ] || [ ! -d "client/node_modules" ]; then
  echo "Installing dependencies (first-time setup)..."
  npm run install:all
fi

echo "Starting Email Cards server (port 3456) and client (port 5173)..."

(
  for i in $(seq 1 40); do
    if curl -s http://localhost:3456/api/health >/dev/null 2>&1 && curl -s http://localhost:5173 >/dev/null 2>&1; then
      open "http://localhost:5173"
      exit 0
    fi
    sleep 0.5
  done
  open "http://localhost:5173"
) &

npm run dev
