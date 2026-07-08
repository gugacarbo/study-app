#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_SCRIPT="/home/gustavo/Desktop/study-app/.super-planning/log-task.sh"
exec bash "$ROOT_SCRIPT" \
  --plan "0033-geracao-provas-por-conteudo" \
  --task "Task-D-001" \
  --log-dir "$SCRIPT_DIR" \
  "$@"
