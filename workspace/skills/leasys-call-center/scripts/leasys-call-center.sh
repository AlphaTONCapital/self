#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
PID_FILE="$SKILL_DIR/.server.pid"
LOG_FILE="$SKILL_DIR/server.log"

start() {
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "Server already running (PID $(cat "$PID_FILE"))"
    exit 0
  fi

  cd "$SKILL_DIR"

  if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install --production 2>&1
  fi

  echo "Starting Leasys Call Center server..."
  nohup node src/server.mjs > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  sleep 1

  if kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "Server started (PID $(cat "$PID_FILE"))"
    echo "Webhook URL: http://localhost:${LEASYS_WEBHOOK_PORT:-3100}/voice/incoming"
    echo "Health: http://localhost:${LEASYS_WEBHOOK_PORT:-3100}/health"
    echo "Logs: $LOG_FILE"
  else
    echo "Failed to start server. Check $LOG_FILE"
    exit 1
  fi
}

stop() {
  if [ ! -f "$PID_FILE" ]; then
    echo "No server running"
    exit 0
  fi

  local pid
  pid=$(cat "$PID_FILE")
  if kill -0 "$pid" 2>/dev/null; then
    echo "Stopping server (PID $pid)..."
    kill "$pid"
    rm -f "$PID_FILE"
    echo "Server stopped"
  else
    echo "Server not running (stale PID file)"
    rm -f "$PID_FILE"
  fi
}

status() {
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "Server running (PID $(cat "$PID_FILE"))"
    curl -s "http://localhost:${LEASYS_WEBHOOK_PORT:-3100}/health" 2>/dev/null || echo "Health check failed"
  else
    echo "Server not running"
  fi
}

logs() {
  if [ -f "$LOG_FILE" ]; then
    tail -f "$LOG_FILE"
  else
    echo "No log file found"
  fi
}

test_skill() {
  cd "$SKILL_DIR"
  if [ ! -d "node_modules" ]; then
    npm install 2>&1
  fi
  node --test test/*.test.mjs
}

case "${1:-help}" in
  start)  start ;;
  stop)   stop ;;
  restart) stop; start ;;
  status) status ;;
  logs)   logs ;;
  test)   test_skill ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs|test}"
    exit 1
    ;;
esac
